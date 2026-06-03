/**
 * Handles live sync operations
 */
const LiveSyncManager = {
    syncHandlers: {},

    async startLiveSync(dbName, remoteUrl, options = {}) {
        if (typeof self.PouchDB === "undefined") {
            throw new Error("PouchDB is not available");
        }

        if (!DatabaseManager.isLiveSyncDatabase(dbName)) {
            console.log(`[SYNC] Skipping live sync for ${dbName} - not configured for live sync`);
            return;
        }

        if (this.syncHandlers[dbName]) {
            this.syncHandlers[dbName].cancel();
            delete this.syncHandlers[dbName];
        }

        const localDB = DatabaseManager.getDatabaseInstance(dbName);
        let remoteDB;
        try {
            remoteDB = await SyncUtils.ensureDatabaseExists(remoteUrl, dbName, options);
        } catch (error) {
            console.warn(`[LIVE-SYNC] Skipping live sync for ${dbName}; remote database is not available:`, error);
            return;
        }

        const syncOptions = {
            live: true,
            retry: true,
            heartbeat: SYNC_CONFIG.INTERVALS.HEARTBEAT,
            timeout: SYNC_CONFIG.TIMEOUTS.DEFAULT,
            batch_size: SYNC_BATCH_SIZE,
            batches_limit: 5,
            back_off_function: (delay) => {
                if (delay === 0) return 5000;
                return Math.min(delay * 2, 30000);
            },
        };

        const selector = SyncManager.getLocationSelector(dbName);

        if (selector?.location_id) {
            const locationId = selector.location_id;

            syncOptions.pull = {
                selector: {
                    $or: [
                        { location_id: locationId },
                        { location_id: Number(locationId) },
                        { deleted_location_id: locationId },
                        { deleted_location_id: Number(locationId) },
                    ],
                },
            };

            console.log(`[LIVE-SYNC] Using location filter for ${dbName}: ${locationId}`);
        }

        const handler = localDB
            .sync(remoteDB, syncOptions)
            .on("change", async (info) => {
                console.log(`[LIVE-SYNC] ${dbName} change: ${info.direction} - docs: ${info.change?.docs_written || 0}`);
                DatabaseManager.getStats(remoteUrl, options, dbName, { skipRemote: true }).catch((error) => {
                    console.warn(`[LIVE-SYNC] Failed to refresh local stats for ${dbName}:`, error);
                });
                self.postMessage({
                    type: "syncChange",
                    dbName: dbName,
                    info: info,
                    timestamp: new Date().toISOString(),
                });
            })
            .on("paused", (err) => {
                // Do NOT trigger compact here. On a large DB (300k+ docs)
                // compact takes 5+ minutes and holds the IDB write queue,
                // freezing every search/query/index build. The previous
                // implementation kicked off compact on every sync catch-up,
                // which is precisely when the user is most likely to query.
                // Use window.mahisCompactNow() to compact on demand.
                if (err) {
                    console.warn(`[LIVE-SYNC] ${dbName} paused due to error:`, err);
                } else {
                    console.log(`[LIVE-SYNC] ${dbName} paused (up to date)`);
                }
            })
            .on("active", async () => {
                console.log(`[LIVE-SYNC] ${dbName} resumed`);
                DatabaseManager.getStats(remoteUrl, options, dbName, { skipRemote: true }).catch((error) => {
                    console.warn(`[LIVE-SYNC] Failed to refresh local stats for ${dbName}:`, error);
                });
                self.postMessage({
                    type: "liveSyncActive",
                    dbName: dbName,
                    timestamp: new Date().toISOString(),
                });
            })
            .on("denied", (err) => {
                console.error(`[LIVE-SYNC] ${dbName} access denied:`, err);
            })
            .on("complete", (info) => {
                console.log(`[LIVE-SYNC] ${dbName} sync complete:`, info);
                delete this.syncHandlers[dbName];
            })
            .on("error", (err) => {
                console.error(`[LIVE-SYNC] ${dbName} sync error:`, err);
            });

        this.syncHandlers[dbName] = handler;
    },

    // verbose=false suppresses the per-DB log line; stopAllLiveSync uses this to
    // avoid spamming the console with 30 "Stopped sync for X" messages when the
    // search auto-pause kicks in.
    stopLiveSync(dbName, verbose = true) {
        if (this.syncHandlers[dbName]) {
            try {
                this.syncHandlers[dbName].cancel();
            } catch (error) {
                console.warn(`[SYNC] cancel() threw for ${dbName}:`, error);
            }
            // PouchDB sync handlers only expose cancel(); there is no destroy().
            delete this.syncHandlers[dbName];
            if (verbose) console.log(`[SYNC] Stopped live sync for ${dbName}`);
            return true;
        }
        return false;
    },

    stopAllLiveSync() {
        const names = Object.keys(this.syncHandlers);
        for (const dbName of names) {
            this.stopLiveSync(dbName, false);
        }
        if (names.length > 0) console.log(`[SYNC] Stopped ${names.length} live sync(s)`);
    },

    isLiveSyncActive(dbName) {
        return !!this.syncHandlers[dbName];
    },

    listenToRemoteChanges(dbName, remoteUrl, options = {}, listenerOptions = {}) {
        const remoteDB = new self.PouchDB(`${remoteUrl}/${dbName}`, {
            skip_setup: true,
            auth: options,
            ajax: { timeout: 60000, cache: false },
        });
        if (this.syncHandlers[dbName]) {
            this.syncHandlers[dbName].cancel();
            delete this.syncHandlers[dbName];
        }
        const changeOptions = {
            live: true, // keep listening
            retry: true,
            since: "now", // start from current state
            include_docs: true, // include the changed docs
            heartbeat: 30000, // keep the connection alive
            timeout: 60000,
        };

        const selector = listenerOptions.selector;
        if (selector && typeof selector === "object") {
            changeOptions.selector = selector;
        }

        const handler = remoteDB
            .changes(changeOptions)
            .on("change", async (change) => {
                console.log(`[REMOTE-CHANGE] ${dbName}:`, change);
                if (listenerOptions.refreshStats !== false) {
                    await DatabaseManager.getStats(remoteUrl, options, dbName);
                }
                self.postMessage({
                    type: "syncChange",
                    dbName: dbName,
                    info: {
                        direction: "pull",
                        change: {
                            docs: change?.doc ? [change.doc] : [],
                            docs_written: change?.doc ? 1 : 0,
                            last_seq: change?.seq,
                        },
                    },
                    timestamp: new Date().toISOString(),
                });
            })
            .on("error", (err) => {
                console.error(`[REMOTE-CHANGE] ${dbName} error:`, err);
            });

        this.syncHandlers[dbName] = handler;
    },
};
