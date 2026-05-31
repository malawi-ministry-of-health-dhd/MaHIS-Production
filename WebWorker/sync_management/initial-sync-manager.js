/**
 * Handles initial one-time sync operations
 */
const INITIAL_SYNC_MAX_DURATION_MS = 10 * 60 * 1000;

const InitialSyncManager = {
    initialSyncComplete: {},

    waitForReplication(replication, dbName, timeoutMs = INITIAL_SYNC_MAX_DURATION_MS) {
        return new Promise((resolve, reject) => {
            let settled = false;
            let timeout = null;
            const settle = (handler, value) => {
                if (settled) return;
                settled = true;
                if (timeout) clearTimeout(timeout);
                handler(value);
            };
            timeout = setTimeout(() => {
                try {
                    replication.cancel();
                } catch (error) {
                    console.warn(`[SYNC] Failed to cancel timed-out initial sync for ${dbName}:`, error);
                }

                settle(reject, new Error(`Initial sync timed out for ${dbName} after ${Math.round(timeoutMs / 1000)}s`));
            }, timeoutMs);

            replication.on("complete", (result) => settle(resolve, result));
            replication.on("error", (error) => settle(reject, error));
        });
    },

    async performInitialSync(dbName, remoteUrl, options = {}, syncDirection = "bidirectional") {
        if (typeof self.PouchDB === "undefined") {
            throw new Error("PouchDB is not available");
        }

        const localDB = DatabaseManager.getDatabaseInstance(dbName);
        const remoteDB = await SyncUtils.ensureDatabaseExists(remoteUrl, dbName, options);

        try {
            const selector = SyncManager.getLocationSelector(dbName);

            if (options.resetCheckpoints === true) {
                await SyncUtils.clearSyncCheckpoints(localDB, dbName);
            }

            const syncOptions = {
                batch_size: SYNC_BATCH_SIZE,
                batches_limit: 20,
                timeout: SYNC_CONFIG.TIMEOUTS.DEFAULT,
                live: false,
                retry: false,
                auto_compaction: false,
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
            const startedAt = Date.now();

            console.log(
                `[SYNC] Initial sync starting for ${dbName}:`,
                JSON.stringify({
                    direction: syncDirection,
                    batchSize: syncOptions.batch_size,
                    batchesLimit: syncOptions.batches_limit,
                    locationFilter: selector ? selector.location_id : "none",
                })
            );

            replication.on("change", async (info) => {
                DatabaseManager.getStats(remoteUrl, options, dbName, { skipRemote: true }).catch((error) => {
                    console.warn(`[SYNC] Failed to refresh stats during initial sync for ${dbName}:`, error);
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

            const result = await this.waitForReplication(replication, dbName);

            console.log(
                `[SYNC] Initial sync complete for ${dbName}:`,
                JSON.stringify({
                    push: syncDirection === "pull" ? 0 : result.push?.docs_written || 0,
                    pull: syncDirection === "pull" ? result.docs_written || 0 : result.pull?.docs_written || 0,
                    docsRead: syncDirection === "pull" ? result.docs_read || 0 : (result.pull?.docs_read || 0) + (result.push?.docs_read || 0),
                    durationMs: Date.now() - startedAt,
                    direction: syncDirection,
                    locationFilter: selector ? selector.location_id : "none",
                })
            );

            this.initialSyncComplete[dbName] = true;
            self.postMessage({
                type: "initialSyncComplete",
                dbName,
                timestamp: new Date().toISOString(),
            });
            return result;
        } catch (error) {
            console.error(`[SYNC] Initial sync failed for ${dbName}:`, error);
            throw error;
        }
    },

    isInitialSyncComplete(dbName) {
        return this.initialSyncComplete[dbName] || false;
    },

    resetInitialSyncStatus(dbName) {
        this.initialSyncComplete[dbName] = false;
    },
};
