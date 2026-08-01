const SYNC_MANAGER_ASSET_QUERY = self.location?.search || "";
importScripts(
    `./sync_management/sync-config.js${SYNC_MANAGER_ASSET_QUERY}`,
    `./sync_management/sync-utils.js${SYNC_MANAGER_ASSET_QUERY}`,
    `./sync_management/initial-sync-manager.js${SYNC_MANAGER_ASSET_QUERY}`,
    `./sync_management/live-sync-manager.js${SYNC_MANAGER_ASSET_QUERY}`,
    `./sync_management/periodic-sync-manager.js${SYNC_MANAGER_ASSET_QUERY}`
);
/**
 * Main SyncManager - coordinates all sync operations
 */
const SyncManager = {
    isInitialized: false,
    locationFilterManager: null,
    initialSyncManager: null,
    liveSyncManager: null,
    periodicSyncManager: null,

    init() {
        if (this.isInitialized) return;

        if (typeof DatabaseManager === "undefined") {
            throw new Error("DatabaseManager is required. Make sure it's loaded before SyncManager.");
        }

        this.isInitialized = true;
        console.log("[SYNC] SyncManager initialized successfully");
    },

    getLocationSelector(dbName) {
        const filterByLocation = databaseConfig.locationFilters[dbName];
        if (!filterByLocation) return null;

        const idPoolDatabases = new Set(["dde", "lab_accession_numbers"]);
        const locationId = idPoolDatabases.has(dbName) ? (typeof FACILITY_LOCATION_ID !== "undefined" && FACILITY_LOCATION_ID) || LOCATION_ID : LOCATION_ID;

        return {
            location_id: locationId,
        };
    },

    getPeriodicSyncDirection(dbName) {
        return databaseConfig.editablePeriodicSyncDatabases?.includes(dbName) ? "bidirectional" : "pull";
    },

    isEditablePeriodicSyncDatabase(dbName) {
        return this.getPeriodicSyncDirection(dbName) === "bidirectional";
    },

    getIdPoolTarget(dbName) {
        return {
            dde: 10,
            lab_accession_numbers: 25,
        }[dbName] || 0;
    },

    isDeviceIdPoolDatabase(dbName) {
        return ["dde", "lab_accession_numbers"].includes(dbName);
    },

    buildApiUrl(path, options = {}, params = {}) {
        const apiConfig = options.apiConfig || {};
        const protocol = String(apiConfig.protocol || "http").replace(/:$/, "");
        const host = String(apiConfig.host || "").trim();
        const port = apiConfig.port ? `:${String(apiConfig.port).replace(/^:/, "")}` : "";
        const normalizedPath = String(path || "").replace(/^\/+/, "");
        const query = Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== null && value !== "")
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join("&");

        if (!host) throw new Error("API host is not configured for worker ID pool sync");

        return `${protocol}://${host}${port}/api/v1/${normalizedPath}${query ? `?${query}` : ""}`;
    },

    async apiJson(method, path, options = {}, { params = {}, body = null } = {}) {
        const apiConfig = options.apiConfig || {};
        const apiKey = String(apiConfig.apiKey || "");
        if (!apiKey) throw new Error("API key is not available for worker ID pool sync");

        const response = await fetch(this.buildApiUrl(path, options, params), {
            method,
            headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });

        if (!response.ok) {
            throw new Error(`API ${method} ${path} failed (${response.status})`);
        }

        return response.json();
    },

    async countLocalPoolDocs(dbName) {
        const target = this.getIdPoolTarget(dbName);
        const db = DatabaseManager.getDatabaseInstance(dbName);

        const selector =
            dbName === "dde"
                ? {
                      assignedTo: self.DEVICE_ID || "",
                      status: "used",
                  }
                : {
                      type: "lab_accession_number",
                      location_id: String((typeof FACILITY_LOCATION_ID !== "undefined" && FACILITY_LOCATION_ID) || LOCATION_ID || ""),
                      assigned_to_device_id: self.DEVICE_ID || "",
                      status: "reserved",
                  };

        const result = await db.find({ selector, limit: target });
        return result.docs?.length || 0;
    },

    extractNpids(response) {
        const source = Array.isArray(response?.npids) ? response.npids : Array.isArray(response) ? response : [];
        return source
            .map((npidData) => (typeof npidData === "string" ? npidData : npidData?.npid))
            .filter(Boolean);
    },

    async insertPoolDocs(dbName, docs) {
        if (!docs.length) return [];
        const db = DatabaseManager.getDatabaseInstance(dbName);
        const results = await db.bulkDocs(docs);
        const failures = results.filter((result) => result.error && result.error !== "conflict");
        if (failures.length) {
            console.warn(`[SYNC] ${dbName} ID pool insert had errors:`, failures);
        }
        return results;
    },

    async syncDdeDevicePool(remoteBaseUrl, options = {}) {
        const target = this.getIdPoolTarget("dde");
        const currentCount = await this.countLocalPoolDocs("dde");
        const needed = Math.max(0, target - currentCount);
        if (needed <= 0) return { currentCount, inserted: 0, target };

        const response = await this.apiJson("GET", "dde/patients/sync_npids", options, {
            params: {
                count: needed,
                program_id: options.apiConfig?.programId || 14,
            },
        });
        const locationId = String((typeof FACILITY_LOCATION_ID !== "undefined" && FACILITY_LOCATION_ID) || LOCATION_ID || "");
        const deviceId = self.DEVICE_ID || "";
        const assignedAt = new Date().toISOString();
        const docs = this.extractNpids(response).map((npid) => ({
            _id: `dde_id_${locationId}_${npid}`,
            dde_id: npid,
            location_id: locationId,
            npid,
            assigned: true,
            allocated: true,
            status: "used",
            assignedTo: deviceId,
            assignedAt,
            reservation_source: "api_worker",
        }));

        const results = await this.insertPoolDocs("dde", docs);
        const inserted = results.filter((result) => !result.error).length;
        return { currentCount: await this.countLocalPoolDocs("dde"), inserted, requested: needed, target };
    },

    async syncLabAccessionDevicePool(remoteBaseUrl, options = {}) {
        const target = this.getIdPoolTarget("lab_accession_numbers");
        const currentCount = await this.countLocalPoolDocs("lab_accession_numbers");
        const needed = Math.max(0, target - currentCount);
        if (needed <= 0) return { currentCount, inserted: 0, target };

        const locationId = String((typeof FACILITY_LOCATION_ID !== "undefined" && FACILITY_LOCATION_ID) || LOCATION_ID || "");
        const deviceId = self.DEVICE_ID || "";
        const response = await this.apiJson("POST", "lab/accession_numbers/reserve", options, {
            body: {
                count: needed,
                location_id: locationId,
                device_id: deviceId,
            },
        });
        const docs = Array.isArray(response?.accession_numbers) ? response.accession_numbers : [];

        const results = await this.insertPoolDocs("lab_accession_numbers", docs.map(({ _rev, ...doc }) => doc));
        const inserted = results.filter((result) => !result.error).length;
        return { currentCount: await this.countLocalPoolDocs("lab_accession_numbers"), inserted, requested: needed, target };
    },

    async syncDeviceIdPool(dbName, remoteBaseUrl, options = {}) {
        if (!DatabaseManager.useLocalStorage || USE_LAN_CONNECTION) {
            return { skipped: true, reason: "ID pool API sync only runs in local-storage live-server mode" };
        }

        try {
            const result =
                dbName === "dde"
                    ? await this.syncDdeDevicePool(remoteBaseUrl, options)
                    : await this.syncLabAccessionDevicePool(remoteBaseUrl, options);

            await DatabaseManager.getStats(remoteBaseUrl, options, dbName, { skipRemote: true, throttleMs: 0 });
            return result;
        } catch (error) {
            const fallbackResult = {
                currentCount: 0,
                inserted: 0,
                target: this.getIdPoolTarget(dbName),
                error: error.message || String(error),
            };

            try {
                fallbackResult.currentCount = await this.countLocalPoolDocs(dbName);
                await DatabaseManager.getStats(remoteBaseUrl, options, dbName, { skipRemote: true, throttleMs: 0 });
            } catch (statsError) {
                fallbackResult.statsError = statsError.message || String(statsError);
            }

            console.warn(`[SYNC] ${dbName} device ID pool API refill failed:`, error);
            return fallbackResult;
        }
    },

    getLocationChangeSelector(dbName) {
        const selector = this.getLocationSelector(dbName);
        if (!selector?.location_id) return null;

        const locationId = selector.location_id;
        return {
            $or: [
                { location_id: locationId },
                { location_id: Number(locationId) },
                { deleted_location_id: locationId },
                { deleted_location_id: Number(locationId) },
            ],
        };
    },

    getRemoteLiveChangeDatabases() {
        const liveDatabases = this.uniqueDatabaseNames(databaseConfig.liveSyncDatabases);
        const syncPatientsLocally = self.SYNC_PATIENTS_LOCALLY === true;

        if (!DatabaseManager.useLocalStorage) return liveDatabases;
        if (syncPatientsLocally) return [];

        return liveDatabases.filter((dbName) => dbName === "patients_records");
    },

    watchDirectRemoteChanges(remoteBaseUrl, options = {}) {
        if (!remoteBaseUrl) return;

        const remoteLiveDatabases = this.getRemoteLiveChangeDatabases();
        if (remoteLiveDatabases.length === 0) return;

        console.log(`[SYNC] Opening persistent remote change feeds for: ${remoteLiveDatabases.join(", ")}`);
        LiveSyncManager.stopMultiplexedRemoteWatch();

        // Use the original per-database live feeds. Each feed holds one CouchDB
        // long-poll socket and only wakes when that database changes (or when its
        // heartbeat/timeout reconnects), avoiding continuous short polling.
        remoteLiveDatabases.forEach((dbName) => {
            LiveSyncManager.listenToRemoteChanges(dbName, remoteBaseUrl, options, {
                selector: this.getLocationChangeSelector(dbName),
                refreshStats: false,
            });
        });
    },

    watchDirectPatientRecordChanges(remoteBaseUrl, options = {}) {
        this.watchDirectRemoteChanges(remoteBaseUrl, options);
    },

    uniqueDatabaseNames(databaseNames = []) {
        return [...new Set(databaseNames.filter(Boolean))];
    },

    getSyncParallelLimit() {
        const parsedLimit = Number(SYNC_PARALLEL_LIMIT);
        return Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 2;
    },

    async runWithConcurrency(items, limit, handler) {
        let currentIndex = 0;
        const workerCount = Math.min(Math.max(1, limit), items.length);
        const activeItems = new Set();

        const workers = Array.from({ length: workerCount }, async (_, workerIndex) => {
            while (currentIndex < items.length) {
                const item = items[currentIndex++];
                const itemName = `${item.syncType}:${item.dbName}`;
                activeItems.add(itemName);
                console.log(`[SYNC-QUEUE] Started ${itemName} on slot ${workerIndex + 1}/${workerCount}`, {
                    active: [...activeItems],
                });

                try {
                    await handler(item);
                } finally {
                    activeItems.delete(itemName);
                    console.log(`[SYNC-QUEUE] Finished ${itemName} on slot ${workerIndex + 1}/${workerCount}`, {
                        active: [...activeItems],
                    });
                }
            }
        });

        await Promise.all(workers);
    },

    // Main sync orchestration
    async syncAll(remoteBaseUrl, options = {}) {
        if (!DatabaseManager.isInitialized) {
            throw new Error("DatabaseManager not initialized. Call DatabaseManager.init() first.");
        }

        const parallelLimit = this.getSyncParallelLimit();

        console.log(`[SYNC] Starting sync with max ${parallelLimit} database(s) at a time...`);
        DatabaseManager.isInitialSyncInProgress = true;

        // Honor the per-DB toggle (set by main thread via worker message
        // envelope; self.SYNC_PATIENTS_LOCALLY mirrors the flag here). Only
        // syncs patients_records when explicitly enabled — default is to
        // exclude it. Other tables continue syncing regardless.
        const syncPatientsLocally = self.SYNC_PATIENTS_LOCALLY === true;
        const excludePatients = (list) => syncPatientsLocally ? list : list.filter((n) => n !== "patients_records");

        const liveSyncDatabases = excludePatients(this.uniqueDatabaseNames(databaseConfig.liveSyncDatabases));
        const periodicSyncDatabases = excludePatients(this.uniqueDatabaseNames(databaseConfig.periodicSyncDatabases));
        if (!syncPatientsLocally) {
            console.log("[SYNC] patients_records excluded from sync (sync_patients_locally = false)");
            this.watchDirectRemoteChanges(remoteBaseUrl, options);
        }
        const syncTasks = [
            ...liveSyncDatabases.map((dbName) => ({ dbName, syncType: "live" })),
            ...periodicSyncDatabases.map((dbName) => ({ dbName, syncType: "periodic" })),
        ];
        const completedLiveSyncDatabases = [];

        try {
            await this.runWithConcurrency(syncTasks, parallelLimit, async ({ dbName, syncType }) => {
                if (syncType === "live") {
                    try {
                        DatabaseManager.getStats(remoteBaseUrl, options, dbName, { skipRemote: true, throttleMs: 0 }).catch((error) => {
                            console.warn(`[SYNC] Local stats refresh failed before syncing ${dbName}:`, error);
                        });
                        await InitialSyncManager.performInitialSync(dbName, remoteBaseUrl, options);
                        completedLiveSyncDatabases.push(dbName);

                        console.log(`[SYNC] Live database initial sync complete for ${dbName}`);
                    } catch (error) {
                        console.error(`[SYNC] Live database failed to sync ${dbName}:`, error);
                    }
                    return;
                }

                try {
                    if (this.isDeviceIdPoolDatabase(dbName)) {
                        const result = await this.syncDeviceIdPool(dbName, remoteBaseUrl, options);
                        InitialSyncManager.initialSyncComplete[dbName] = true;
                        self.postMessage({
                            type: "initialSyncComplete",
                            dbName,
                            result,
                            timestamp: new Date().toISOString(),
                        });
                        PeriodicSyncManager.setupPeriodicSync(dbName, remoteBaseUrl, options);
                        console.log(`[SYNC] ${dbName} device ID pool sync complete`, result);
                        return;
                    }

                    const syncDirection = this.getPeriodicSyncDirection(dbName);

                    // Most periodic databases are reference/config data and stay pull-only.
                    // Editable periodic databases must also push local changes back.
                    DatabaseManager.getStats(remoteBaseUrl, options, dbName, { skipRemote: true, throttleMs: 0 }).catch((error) => {
                        console.warn(`[SYNC] Local stats refresh failed before syncing ${dbName}:`, error);
                    });
                    await InitialSyncManager.performInitialSync(dbName, remoteBaseUrl, options, syncDirection);

                    PeriodicSyncManager.setupPeriodicSync(dbName, remoteBaseUrl, options);

                    console.log(`[SYNC] Periodic sync active for ${dbName}`);
                } catch (error) {
                    console.error(`[SYNC] Failed to sync periodic database ${dbName}:`, error);
                }
            });
        } finally {
            DatabaseManager.isInitialSyncInProgress = false;
        }

        completedLiveSyncDatabases.forEach((dbName) => {
            LiveSyncManager.startLiveSync(dbName, remoteBaseUrl, options);
            console.log(`[SYNC] Live sync active for ${dbName}`);
        });

        console.log("[SYNC] Parallel sync initialization complete", {
            liveSyncDatabases: liveSyncDatabases.length,
            periodicSyncDatabases: periodicSyncDatabases.length,
            parallelLimit,
        });
    },
    // Standalone DDE sync — used when in LAN mode (no full IndexedDB sync)
    async syncPeriodicDde(remoteBaseUrl, options = {}) {
        console.log("[SYNC] DDE IDs are claimed on demand by DDEService in LAN mode");
    },

    async syncLabAccessionNumbers(remoteBaseUrl, options = {}) {
        console.log("[SYNC] Lab accession numbers are claimed on demand by LabAccessionNumberService in LAN mode");
    },

    // Stop sync methods
    stopSync(dbName) {
        let stopped = false;

        stopped = LiveSyncManager.stopLiveSync(dbName) || stopped;
        stopped = PeriodicSyncManager.stopPeriodicSync(dbName) || stopped;

        if (stopped) {
            InitialSyncManager.resetInitialSyncStatus(dbName);
        }

        return stopped;
    },

    stopAllSync() {
        LiveSyncManager.stopAllLiveSync();
        PeriodicSyncManager.stopAllPeriodicSync();
        console.log("[SYNC] All sync processes stopped");
    },

    // Status methods
    getSyncStatus() {
        const status = {};
        for (const dbName of DatabaseManager.databaseNames) {
            status[dbName] = {
                syncType: DatabaseManager.isLiveSyncDatabase(dbName) ? "live" : "periodic",
                isLiveSyncActive: LiveSyncManager.isLiveSyncActive(dbName),
                isPeriodicSyncActive: PeriodicSyncManager.isPeriodicSyncActive(dbName),
                initialSyncComplete: InitialSyncManager.isInitialSyncComplete(dbName),
                handler: LiveSyncManager.isLiveSyncActive(dbName)
                    ? "live-active"
                    : PeriodicSyncManager.isPeriodicSyncActive(dbName)
                    ? "periodic-active"
                    : "inactive",
            };
        }
        if (!status.patients_records && LiveSyncManager.isLiveSyncActive("patients_records")) {
            status.patients_records = {
                syncType: "remote-listener",
                isLiveSyncActive: true,
                isPeriodicSyncActive: false,
                initialSyncComplete: true,
                handler: "remote-change-listener",
            };
        }
        return status;
    },
};
