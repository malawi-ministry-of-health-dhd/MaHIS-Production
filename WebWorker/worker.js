// Updated worker.js with separated DatabaseManager and SyncManager
importScripts("db.js", "sync_manager.js", "../databaseConfig.js");

// Global vars
let LOCATION_ID = "";
let FACILITY_LOCATION_ID = "";
let DEVICE_ID = "";
let USE_LOCAL_STORAGE = "";
let USE_LAN_CONNECTION = "";
let SYNC_BATCH_SIZE = "";
let SYNC_PARALLEL_LIMIT = 2;
const editablePeriodicSyncsInFlight = {};
let syncStartupPromise = null;
let startSyncCommandPromise = null;
let syncStartupRunId = 0;

const getSyncConfiguration = () => ({
    liveSyncDatabases: databaseConfig.liveSyncDatabases,
    periodicSyncDatabases: databaseConfig.periodicSyncDatabases,
    periodicInterval: "30 minutes",
    batchSize: SYNC_BATCH_SIZE,
    parallelSyncDatabases: SYNC_PARALLEL_LIMIT,
});

const isStartupSyncRunning = () => Boolean(syncStartupPromise || DatabaseManager.isInitialSyncInProgress);
const hasOfflineDataSource = (useLocalStorage = USE_LOCAL_STORAGE, useLanConnection = USE_LAN_CONNECTION) =>
    Boolean(useLocalStorage || useLanConnection);
const canUseRemoteCouchDb = (useLocalStorage = USE_LOCAL_STORAGE, useLanConnection = USE_LAN_CONNECTION) =>
    Boolean(useLocalStorage || useLanConnection);
const COMMANDS_ALLOWED_WITHOUT_OFFLINE_SOURCE = new Set([
    "closeAllDatabases",
    "stopSync",
    "ping",
    "getSyncStatus",
    "getSyncConfiguration",
    "primeRemoteStats",
]);

const getSyncAlreadyRunningResult = (message = "Selective sync is already running") => ({
    success: true,
    alreadyRunning: true,
    message,
    syncConfiguration: getSyncConfiguration(),
});

const syncEditablePeriodicDatabase = (dbName, remoteUrl, auth) => {
    if (!DatabaseManager.useLocalStorage || !remoteUrl || !dbName || !SyncManager.isEditablePeriodicSyncDatabase(dbName)) return;
    if (editablePeriodicSyncsInFlight[dbName]) return;

    editablePeriodicSyncsInFlight[dbName] = PeriodicSyncManager.runPeriodicSync(dbName, remoteUrl, auth)
        .catch((error) => {
            console.warn(`[SYNC] Deferred editable periodic sync failed for ${dbName}:`, error);
        })
        .finally(() => {
            delete editablePeriodicSyncsInFlight[dbName];
        });
};

const refreshRemoteStatsInBackground = (remoteUrl, auth, options = {}) => {
    if (!canUseRemoteCouchDb()) return;
    if (!remoteUrl || !DatabaseManager.isInitialized) return;

    DatabaseManager.refreshRemoteStatsProgressively(remoteUrl, auth, {
        parallelLimit: Math.max(1, Math.floor(Number(options.parallelLimit) || 1)),
        forceRemote: options.forceRemote === true,
    }).catch((error) => {
        console.warn("[DB] Remote stats refresh failed:", error);
    });
};

const publishLocalStatsBeforeSync = async (remoteUrl, auth) => {
    try {
        await DatabaseManager.getStats(remoteUrl, auth, null, { skipRemote: true });
    } catch (error) {
        console.warn("[SYNC] Initial local stats refresh failed:", error);
    }
};

const primeRemoteStatsBeforeSync = async (remoteUrl, auth, options = {}) => {
    if (!canUseRemoteCouchDb()) return;

    try {
        await DatabaseManager.primeRemoteStatsBeforeSync(remoteUrl, auth, {
            parallelLimit: Math.max(1, Math.floor(Number(options.parallelLimit) || 1)),
        });
    } catch (error) {
        console.warn("[SYNC] mahis_sync_stats preload failed; continuing sync without cached targets:", error);
    }
};

const startLocalSyncInBackground = (remoteUrl, auth, syncOptions) => {
    const runId = ++syncStartupRunId;

    syncStartupPromise = SyncManager.syncAll(remoteUrl, syncOptions)
        .then(() => {
            if (runId !== syncStartupRunId) return;
            // Don't refresh remote stats here — they'd compete with the
            // index builds that start when syncStartupComplete fires.
            // The main thread triggers refresh after indexing is done
            // via the refreshRemoteStats command.
            self.postMessage({
                type: "syncStartupComplete",
                timestamp: new Date().toISOString(),
            });
        })
        .catch((error) => {
            if (runId !== syncStartupRunId) return;
            console.error("[SYNC] Background startup sync failed:", error);
            self.postMessage({
                type: "syncStartupError",
                error: error.message || String(error),
                timestamp: new Date().toISOString(),
            });
        })
        .finally(() => {
            if (runId === syncStartupRunId) {
                syncStartupPromise = null;
            }
        });

    return syncStartupPromise;
};

const runStartSyncCommand = async ({ remoteUrl, auth, locationId, deviceId, apiConfig = {}, useLocalStorage, useLanConnection, resetCheckpoints = false }) => {
    if (!hasOfflineDataSource(useLocalStorage, useLanConnection)) {
        SyncManager.stopAllSync();
        if (DatabaseManager.isInitialized) {
            await DatabaseManager.closeAllDatabases();
        }
        return {
            success: true,
            skipped: true,
            message: "Synchronization skipped because offline storage and LAN mode are disabled",
            syncConfiguration: getSyncConfiguration(),
        };
    }

    if (!remoteUrl) {
        throw new Error("remoteUrl is required to start synchronization.");
    }

    try {
        if (useLocalStorage && isStartupSyncRunning()) {
            return getSyncAlreadyRunningResult();
        }

        if (DatabaseManager.isInitialized && (DatabaseManager.useLocalStorage !== useLocalStorage || DatabaseManager.remoteBaseUrl !== remoteUrl)) {
            SyncManager.stopAllSync();
            await DatabaseManager.closeAllDatabases();
        }

        if (useLocalStorage) {
            syncStartupRunId += 1;
            syncStartupPromise = null;

            // Previously this branch also closed every database before restarting
            // sync. That caused "database is closed" errors on any in-flight
            // db.find / db.get / replication callback when startSync was invoked
            // as a *resume* (e.g. after a search-driven pause). The config-change
            // close above is still in effect, so a true config switch still
            // tears down cleanly; a plain resume now reuses existing DB handles.
        }

        const syncOptions = { ...auth, deviceId: deviceId || locationId, apiConfig, resetCheckpoints: resetCheckpoints === true };
        if (useLocalStorage) {
            await DatabaseManager.init(remoteUrl, useLocalStorage, auth);
            SyncManager.init();

            // Fill the modal before replication starts: local counts first,
            // then remote targets from mahis_sync_stats. Missing cache rows are
            // counted and written back to mahis_sync_stats here, so future app
            // refreshes can paint the progress bars immediately.
            await publishLocalStatsBeforeSync(remoteUrl, auth);
            await primeRemoteStatsBeforeSync(remoteUrl, auth, { parallelLimit: 1 });

            startLocalSyncInBackground(remoteUrl, auth, syncOptions);
        } else {
            // LAN-only mode: prepare stats first too, so the progress UI uses
            // mahis_sync_stats before any remote work starts.
            await DatabaseManager.init(remoteUrl, useLocalStorage, auth);
            SyncManager.init();
            await publishLocalStatsBeforeSync(remoteUrl, auth);
            await primeRemoteStatsBeforeSync(remoteUrl, auth, { parallelLimit: 1 });
            await SyncManager.syncPeriodicDde(remoteUrl, syncOptions);
            await SyncManager.syncLabAccessionNumbers(remoteUrl, syncOptions);
            SyncManager.watchDirectRemoteChanges(remoteUrl, syncOptions);
            refreshRemoteStatsInBackground(remoteUrl, auth, { parallelLimit: 1 });
        }

        return {
            success: true,
            message: useLocalStorage ? "Selective sync started in background" : "LAN remote mode ready",
            syncConfiguration: getSyncConfiguration(),
        };
    } catch (error) {
        throw new Error(`Failed to start sync: ${error.message}`);
    }
};

// ── Index building (moved off the main thread) ─────────────────────────────
// PouchDB's createIndex() only writes the _design document; the Mango view is
// materialised lazily on the first query that uses it. To genuinely keep index
// work off the UI thread we (1) create the design doc and (2) force the view to
// build right here with a tiny find() that uses the index. Both steps run in
// the worker, so the main thread never pays the build cost.
const warmUpWorkerIndex = async (db, indexDef) => {
    const field = indexDef && indexDef.index && indexDef.index.fields && indexDef.index.fields[0];
    if (!field) return false;
    const useIndex = indexDef.ddoc || indexDef.name;
    const selectors = [{ [field]: { $gte: null } }, { [field]: { $exists: true } }];
    for (let i = 0; i < selectors.length; i++) {
        try {
            await db.find({ selector: selectors[i], use_index: useIndex, limit: 1 });
            return true;
        } catch (error) {
            // Try the next selector shape. If all fail the design doc still
            // exists and the view will build lazily on first real query.
            if (i === selectors.length - 1) {
                console.warn(`[Index] Warm-up failed for ${indexDef && indexDef.name}:`, (error && error.message) || error);
            }
        }
    }
    return false;
};

// createIndex resolves with { result: "created" | "exists" } — it does NOT
// throw when the index already exists. We surface that so the main thread can
// distinguish a fresh build from an already-present index honestly.
const buildWorkerIndex = async (db, indexDef) => {
    const res = await db.createIndex(indexDef);
    const built = await warmUpWorkerIndex(db, indexDef);
    return { result: res && res.result === "exists" ? "exists" : "created", built };
};

const resolveWorkerDatabase = (dbName, remoteUrl, useLocalStorage, auth) => {
    if (DatabaseManager.databases && DatabaseManager.databases[dbName]) return DatabaseManager.databases[dbName];
    return DatabaseManager.getDatabaseHandle(remoteUrl, useLocalStorage, auth, dbName);
};

// Existence-only probe (cheap _design doc reads) used by the modal to reconcile
// persisted "ready/verified" status against what is actually on disk.
const checkWorkerIndexesExist = async (configs, remoteUrl, useLocalStorage, auth) => {
    const exists = {};
    for (const [dbName, defs] of Object.entries(configs || {})) {
        if (dbName === PATIENT_RECORDS_DB && self.SYNC_PATIENTS_LOCALLY !== true) continue;
        let db;
        try {
            db = resolveWorkerDatabase(dbName, remoteUrl, useLocalStorage, auth);
        } catch (error) {
            continue;
        }
        if (!db) continue;
        for (const def of defs || []) {
            const ddocId = def.ddoc && def.ddoc.indexOf("_design/") === 0 ? def.ddoc : `_design/${def.ddoc}`;
            const fullName = `${dbName}/${def.name}`;
            try {
                await db.get(ddocId);
                exists[fullName] = true;
            } catch (error) {
                exists[fullName] = error && (error.status === 404 || error.name === "not_found") ? false : null;
            }
        }
    }
    return { exists };
};

// Enhanced Web Worker Message Handler
self.onmessage = async (event) => {
    const {
        requestId,
        command,
        location_id,
        facilityLocationId,
        deviceId,
        apiConfig,
        remoteUrl,
        auth,
        storeName,
        data,
        useLocalStorage,
        useLanConnection,
        sync_batch_size,
        sync_parallel_limit,
        sync_patients_locally,
    } = event.data;

    LOCATION_ID = location_id;
    FACILITY_LOCATION_ID = facilityLocationId || location_id;
    DEVICE_ID = deviceId || "";
    self.DEVICE_ID = DEVICE_ID;
    self.FACILITY_LOCATION_ID = FACILITY_LOCATION_ID;
    USE_LOCAL_STORAGE = useLocalStorage;
    USE_LAN_CONNECTION = useLanConnection;
    SYNC_BATCH_SIZE = Math.max(1, Number(sync_batch_size) || 10);
    SYNC_PARALLEL_LIMIT = Math.max(1, Math.floor(Number(sync_parallel_limit) || 2));
    // Stored on a self-level global so SyncManager can read it without
    // accessing localStorage (workers can't). Default: false (don't sync
    // patients_records to local) — must be explicitly set to true.
    const syncPatientsLocally = sync_patients_locally === true;
    self.SYNC_PATIENTS_LOCALLY = syncPatientsLocally;

    // Helper function to send response
    const sendResponse = (response) => {
        self.postMessage({
            ...response,
            requestId,
            command,
            storeName,
        });
    };

    try {
        if (command === "startSync") {
            if (startSyncCommandPromise) {
                sendResponse({
                    success: true,
                    result: getSyncAlreadyRunningResult("Selective sync startup is already in progress"),
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            startSyncCommandPromise = runStartSyncCommand({
                remoteUrl,
                auth,
                locationId: location_id,
                deviceId,
                apiConfig,
                useLocalStorage,
                useLanConnection,
                resetCheckpoints: data?.resetCheckpoints === true,
            });

            try {
                const result = await startSyncCommandPromise;
                sendResponse({
                    success: true,
                    result,
                    timestamp: new Date().toISOString(),
                });
                return;
            } finally {
                startSyncCommandPromise = null;
            }
        }

        if (!hasOfflineDataSource(useLocalStorage, useLanConnection) && !COMMANDS_ALLOWED_WITHOUT_OFFLINE_SOURCE.has(command)) {
            SyncManager.stopAllSync();
            if (DatabaseManager.isInitialized) {
                await DatabaseManager.closeAllDatabases();
            }
            sendResponse({
                success: true,
                skipped: true,
                message: "Worker command skipped because offline storage and LAN mode are disabled",
                timestamp: new Date().toISOString(),
            });
            return;
        }

        // Ensure DatabaseManager is initialized
        if (
            DatabaseManager.isInitialized &&
            (DatabaseManager.useLocalStorage !== useLocalStorage ||
                DatabaseManager.remoteBaseUrl !== remoteUrl ||
                DatabaseManager.syncPatientsLocally !== syncPatientsLocally)
        ) {
            SyncManager.stopAllSync();
            await DatabaseManager.closeAllDatabases();
        }

        const commandInitializesDatabase = command === "startSync";

        if (!DatabaseManager.isInitialized && !commandInitializesDatabase) {
            // Check PouchDB availability before trying to initialize
            if (typeof self.PouchDB === "undefined") {
                throw new Error("PouchDB is not available in worker context");
            }

            await DatabaseManager.init(remoteUrl, useLocalStorage, auth);
        }
        let result;

        switch (command) {
            case "upsertDocument":
                result = await DatabaseManager.upsertDocument(storeName, data, auth);
                if (!USE_LOCAL_STORAGE && canUseRemoteCouchDb()) await DatabaseManager.getStats(remoteUrl, auth, storeName);
                syncEditablePeriodicDatabase(storeName, remoteUrl, auth);
                break;

            case "get":
                result = await DatabaseManager.get(storeName, data || {});
                break;

            case "deleteData":
                result = await DatabaseManager.deleteData(storeName, data);
                syncEditablePeriodicDatabase(storeName, remoteUrl, auth);
                break;

            case "getCount":
                result = await DatabaseManager.getCount(storeName, data);
                break;

            case "bulkOperation":
                const { docs, operation = "insert" } = data;
                result = await DatabaseManager.bulkOperation(storeName, docs, operation);
                syncEditablePeriodicDatabase(storeName, remoteUrl, auth);
                break;

            case "getStats":
                result = await DatabaseManager.getStats(remoteUrl, auth, data?.databaseName || null, {
                    skipRemote: data?.skipRemote === true,
                    throttleMs: data?.throttleMs,
                });
                break;

            case "refreshRemoteStats":
                if (canUseRemoteCouchDb()) {
                    // Await by default so callers (e.g. the Sync All Data
                    // button) can sequence "refresh stats → start indexes".
                    // Pass {data: {await: false}} to revert to fire-and-forget.
                    if (data?.await === false) {
                        refreshRemoteStatsInBackground(remoteUrl, auth, {
                            parallelLimit: data?.parallelLimit || 1,
                            forceRemote: data?.forceRemote === true,
                        });
                        result = { success: true, message: "Remote stats refresh started (background)" };
                    } else {
                        try {
                            await DatabaseManager.refreshRemoteStatsProgressively(remoteUrl, auth, {
                                parallelLimit: data?.parallelLimit || 2,
                                forceRemote: data?.forceRemote === true,
                            });
                            result = { success: true, message: "Remote stats refresh complete" };
                        } catch (error) {
                            console.warn("[DB] Awaited remote stats refresh failed:", error);
                            result = { success: false, message: error.message || String(error) };
                        }
                    }
                } else {
                    result = { success: true, skipped: true, message: "Remote stats skipped because LAN mode is disabled" };
                }
                break;

            case "primeRemoteStats":
                if (canUseRemoteCouchDb()) {
                    result = await DatabaseManager.primeRemoteStatsBeforeSync(remoteUrl, auth, {
                        parallelLimit: data?.parallelLimit || 1,
                    });
                } else {
                    result = { success: true, skipped: true, message: "Remote stats preload skipped because LAN mode is disabled" };
                }
                break;

            case "closeAllDatabases":
                // Stop all sync processes first
                SyncManager.stopAllSync();
                // Then close databases
                await DatabaseManager.closeAllDatabases();
                result = { success: true, message: "All sync processes stopped and databases closed" };
                break;

            case "ping":
                result = {
                    initialized: {
                        database: DatabaseManager.isInitialized,
                        sync: SyncManager.isInitialized,
                    },
                    initialSyncInProgress: DatabaseManager.isInitialSyncInProgress || !!syncStartupPromise || !!startSyncCommandPromise,
                    timestamp: new Date().toISOString(),
                    syncStatus: SyncManager.getSyncStatus(),
                };
                break;

            case "stopSync":
                if (storeName) {
                    const stopped = SyncManager.stopSync(storeName);
                    result = {
                        success: stopped,
                        message: stopped ? `Sync stopped for ${storeName}` : `No active sync found for ${storeName}`,
                        syncType: DatabaseManager.isLiveSyncDatabase(storeName) ? "live" : "periodic",
                    };
                } else {
                    SyncManager.stopAllSync();
                    result = { success: true, message: "All sync processes stopped" };
                }
                break;

            case "testConnection":
                if (remoteUrl) {
                    try {
                        // Test connection to a specific database
                        const testDb = storeName;
                        const remoteDB = new self.PouchDB(`${remoteUrl}/${testDb}`, {
                            auth: auth || undefined,
                            ajax: { timeout: 10000 },
                        });
                        const info = await remoteDB.info();
                        result = {
                            success: true,
                            message: `Connection successful to ${testDb}`,
                            info: info,
                            syncType: DatabaseManager.isLiveSyncDatabase(testDb) ? "live" : "periodic",
                        };
                    } catch (error) {
                        throw new Error(`Connection test failed: ${error.message}`);
                    }
                } else {
                    throw new Error("remoteUrl is required for connection test");
                }
                break;

            case "getSyncConfiguration":
                result = {
                    ...getSyncConfiguration(),
                    totalDatabases: DatabaseManager.databaseNames.length,
                };
                break;

            case "buildIndex": {
                const targetDbName = data && data.dbName;
                const indexDef = data && data.index;
                if (!targetDbName || !indexDef) {
                    throw new Error("buildIndex requires data.dbName and data.index");
                }
                if (targetDbName === PATIENT_RECORDS_DB && self.SYNC_PATIENTS_LOCALLY !== true) {
                    result = { skipped: true, reason: "patient local sync disabled" };
                    break;
                }
                const indexDb = resolveWorkerDatabase(targetDbName, remoteUrl, useLocalStorage, auth);
                result = await buildWorkerIndex(indexDb, indexDef);
                break;
            }

            case "checkIndexes":
                result = await checkWorkerIndexesExist(data && data.configs, remoteUrl, useLocalStorage, auth);
                break;

            default:
                sendResponse({
                    error: `Unknown command: ${command}. Available commands: upsertDocument, get, deleteData, getCount, bulkOperation, getStats, refreshRemoteStats, primeRemoteStats, closeAllDatabases, ping, reinitialize, startSync, stopSync, getSyncStatus, testConnection, getSyncConfiguration, buildIndex, checkIndexes`,
                });
                return;
        }

        sendResponse({
            success: true,
            result,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error(`Error executing command ${command}:`, error);

        sendResponse({
            error: error.message,
            errorType: error.name || "Error",
            stack: error.stack,
            timestamp: new Date().toISOString(),
        });
    }
};

// Handle worker errors
self.onerror = (error) => {
    console.error("Worker error:", error);
    self.postMessage({
        error: "Worker error occurred",
        details: error.message,
        filename: error.filename,
        lineno: error.lineno,
        timestamp: new Date().toISOString(),
    });
};

// Handle unhandled promise rejections. "database is closed" / "database not open"
// errors typically come from in-flight PouchDB ops (replication change handlers,
// pending find/get calls) whose underlying handle was closed by a teardown step.
// Now that we no longer close DBs on every startSync these should be rare; if
// they reappear we log and swallow because the operation is already cancelled.
self.addEventListener("unhandledrejection", (event) => {
    const message = event.reason?.message || String(event.reason || "");
    const isHarmlessClose = /database is closed|database not open/i.test(message);
    if (isHarmlessClose) {
        console.warn("[Worker] Swallowed harmless closed-DB rejection:", message);
        event.preventDefault?.();
        return;
    }
    console.error("Unhandled promise rejection in worker:", event.reason);
    self.postMessage({
        error: "Unhandled promise rejection",
        details: message,
        timestamp: new Date().toISOString(),
    });
});
