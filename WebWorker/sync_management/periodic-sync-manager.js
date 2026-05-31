/**
 * Handles periodic sync operations
 */
const PeriodicSyncManager = {
    periodicSyncIntervals: {},

    waitForReplication(replication) {
        return new Promise((resolve, reject) => {
            replication.on("complete", resolve);
            replication.on("error", reject);
        });
    },

    async setupPeriodicSync(dbName, remoteUrl, options = {}) {
        if (typeof self.PouchDB === "undefined") {
            throw new Error("PouchDB is not available");
        }

        if (!DatabaseManager.isPeriodicSyncDatabase(dbName)) {
            console.log(`[SYNC] Skipping periodic sync for ${dbName} - not configured for periodic sync`);
            return;
        }

        if (this.periodicSyncIntervals[dbName]) {
            clearInterval(this.periodicSyncIntervals[dbName]);
        }

        const performSync = async () => this.runPeriodicSync(dbName, remoteUrl, options);

        const intervalId = setInterval(performSync, SYNC_CONFIG.INTERVALS.PERIODIC_SYNC);
        this.periodicSyncIntervals[dbName] = intervalId;
    },

    async runPeriodicSync(dbName, remoteUrl, options = {}) {
        const selector = SyncManager.getLocationSelector(dbName);
        const syncDirection = SyncManager.getPeriodicSyncDirection(dbName);

        try {
            const localDB = DatabaseManager.getDatabaseInstance(dbName);
            const remoteDB = await SyncUtils.ensureDatabaseExists(remoteUrl, dbName, options);

            const syncOptions = {
                batch_size: SYNC_BATCH_SIZE,
                batches_limit: 10,
                timeout: SYNC_CONFIG.TIMEOUTS.PERIODIC_SYNC,
                retry: false,
            };

            if (selector?.location_id) {
                const locationId = selector.location_id;
                const locationSelector = {
                    $or: [
                        { location_id: locationId },
                        { location_id: Number(locationId) },
                        { deleted_location_id: locationId },
                        { deleted_location_id: Number(locationId) },
                    ],
                };

                if (syncDirection === "pull") {
                    syncOptions.selector = locationSelector;
                } else {
                    syncOptions.pull = {
                        selector: locationSelector,
                    };
                }

                console.log(`[LIVE-SYNC] Using location filter for ${dbName}: ${locationId}`);
            }

            const replication = syncDirection === "pull" ? localDB.replicate.from(remoteDB, syncOptions) : localDB.sync(remoteDB, syncOptions);

            replication.on("change", async (info) => {
                DatabaseManager.getStats(remoteUrl, options, dbName, { skipRemote: true }).catch((error) => {
                    console.warn(`[PERIODIC-SYNC] Failed to refresh stats for ${dbName}:`, error);
                });
                self.postMessage({
                    type: "syncChange",
                    dbName: dbName,
                    info: {
                        ...info,
                        direction: info.direction || (syncDirection === "pull" ? "pull" : undefined),
                    },
                    timestamp: new Date().toISOString(),
                });
            });

            const result = await this.waitForReplication(replication);

            self.postMessage({
                type: "periodicSyncComplete",
                dbName: dbName,
                result: result,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error(`[PERIODIC-SYNC] Sync failed for ${dbName}:`, error);
        }
    },

    stopPeriodicSync(dbName, verbose = true) {
        if (this.periodicSyncIntervals[dbName]) {
            clearInterval(this.periodicSyncIntervals[dbName]);
            delete this.periodicSyncIntervals[dbName];
            if (verbose) console.log(`[SYNC] Stopped periodic sync for ${dbName}`);
            return true;
        }
        return false;
    },

    stopAllPeriodicSync() {
        const names = Object.keys(this.periodicSyncIntervals);
        for (const dbName of names) {
            this.stopPeriodicSync(dbName, false);
        }
        if (names.length > 0) console.log(`[SYNC] Stopped ${names.length} periodic sync(s)`);
    },

    isPeriodicSyncActive(dbName) {
        return !!this.periodicSyncIntervals[dbName];
    },
};
