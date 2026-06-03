importScripts(
    "./sync_management/sync-config.js",
    "./sync_management/sync-utils.js",
    "./sync_management/initial-sync-manager.js",
    "./sync_management/live-sync-manager.js",
    "./sync_management/periodic-sync-manager.js",
    "./sync_management/dde-manager.js"
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

        return {
            location_id: LOCATION_ID,
        };
    },

    getPeriodicSyncDirection(dbName) {
        return databaseConfig.editablePeriodicSyncDatabases?.includes(dbName) ? "bidirectional" : "pull";
    },

    isEditablePeriodicSyncDatabase(dbName) {
        return this.getPeriodicSyncDirection(dbName) === "bidirectional";
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
        remoteLiveDatabases.forEach((dbName) => {
            LiveSyncManager.listenToRemoteChanges(dbName, remoteBaseUrl, options, {
                selector: this.getLocationChangeSelector(dbName),
                refreshStats: false,
            });
        });

        if (remoteLiveDatabases.length > 0) {
            console.log(`[SYNC] Watching remote changes for direct CouchDB mode: ${remoteLiveDatabases.join(", ")}`);
        }
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
                    if (dbName === "dde") {
                        const deviceId = options.deviceId || LOCATION_ID || `device_not_provided`;
                        await DdeManager.claimDdeIds(remoteBaseUrl, options, deviceId, 10);
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
            if (DatabaseManager.useLocalStorage) {
                DatabaseManager.autoCompactAll();
            }
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
        try {
            const deviceId = options.deviceId || LOCATION_ID || `device_not_provided`;
            await DdeManager.claimDdeIds(remoteBaseUrl, options, deviceId, 10);
        } catch (error) {
            console.error("[SYNC] Failed to sync DDE IDs:", error);
        }
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
