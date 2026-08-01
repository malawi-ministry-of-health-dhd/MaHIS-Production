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

    // ── Multiplexed remote watching (one held connection, not one per database) ──
    //
    // A browser allows ~6 persistent connections per origin over HTTP/1.1. One
    // longpoll _changes feed per watched database held 4 of those 6 open
    // permanently, leaving ~2 for every query. Measured consequence: four
    // concept_names/_find requests that CouchDB itself served in 2-3ms each were
    // reported by the browser as 48,246ms — ~48 SECONDS spent queued client-side
    // waiting for a free socket, all four completing the instant slots freed.
    //
    // Instead hold ONE longpoll connection to /_db_updates (a global feed naming
    // the databases that changed) and, when a watched database is named, make a
    // SHORT-LIVED _changes request for just that database, which returns the
    // socket immediately. 4 held connections -> 1, so 5 of the 6 slots stay
    // available for queries instead of 2.
    // `generation` is what actually guarantees a single loop. Clearing a boolean is
    // not enough: several sync entry points call watchDirectRemoteChanges (worker
    // init AND syncAll), and if the previous loop's fetch had already resolved when
    // the next start flipped `running` back to true, the old loop simply carried on
    // — every extra call leaking another 60s longpoll connection and starving
    // queries of sockets, the exact problem this design removes. Each loop captures
    // its generation and exits the moment it is superseded.
    dbUpdatesState: { generation: 0, running: false, abort: null, watched: new Map(), since: "now", signature: null },

    async startMultiplexedRemoteWatch(remoteUrl, options = {}, watchers = []) {
        if (!watchers.length) return false;

        // Idempotent: re-requesting the same watch set is a no-op rather than a
        // restart, so repeated calls cannot churn connections.
        const signature = `${remoteUrl}|${watchers.map((w) => w.dbName).sort().join(",")}`;
        if (this.dbUpdatesState.running && this.dbUpdatesState.signature === signature) {
            console.log("[SYNC] Multiplexed remote watch already running for this set; not restarting");
            return true;
        }

        this.stopMultiplexedRemoteWatch();

        // Confirm the endpoint exists before committing to it; older/locked-down
        // servers may not expose it, in which case the caller falls back to
        // per-database feeds.
        try {
            const probeUrl = `${remoteUrl}/_db_updates?feed=longpoll&timeout=1000`;
            const probe = await fetch(probeUrl, { headers: buildAuthHeaders(options) });
            if (!probe.ok) throw new Error(`_db_updates unavailable (${probe.status})`);
            await probe.json().catch(() => null);
        } catch (error) {
            console.warn("[SYNC] /_db_updates not usable; falling back to per-database feeds:", error.message || error);
            return false;
        }

        // Anchor each database at its CURRENT update_seq before the loop starts.
        //
        // `since: "now"` cannot be used here. Unlike a live feed — which opens at
        // "now" and then streams — our drain runs AFTER a notification, and "now"
        // is resolved server-side at drain time, i.e. after the write we were told
        // about. Measured against a real CouchDB: the drain returned [] for the
        // very patient that triggered the event, while the same drain from a
        // sequence captured at watch start returned it. That is why another
        // device's new patient stopped appearing on the OPD list.
        await Promise.all(
            watchers.map(async (watcher) => {
                try {
                    const response = await fetch(`${remoteUrl}/${watcher.dbName}`, { headers: buildAuthHeaders(options) });
                    if (!response.ok) return;
                    const info = await response.json();
                    if (info?.update_seq !== undefined && info.update_seq !== null) watcher.since = info.update_seq;
                } catch (error) {
                    // Keep "now": we may miss one change rather than watch nothing.
                    console.warn(`[SYNC] Could not read update_seq for ${watcher.dbName}; first change may be missed:`, error.message || error);
                }
            })
        );

        watchers.forEach((watcher) => this.dbUpdatesState.watched.set(watcher.dbName, watcher));
        const generation = ++this.dbUpdatesState.generation;
        // Global sequences belong to one server timeline. Never carry one across
        // a watcher restart or a change of remote URL.
        this.dbUpdatesState.since = "now";
        this.dbUpdatesState.signature = signature;
        this.dbUpdatesState.running = true;
        void this.runDbUpdatesLoop(remoteUrl, options, generation);
        console.log(`[SYNC] Multiplexed remote watch active on 1 connection for: ${watchers.map((w) => w.dbName).join(", ")}`);
        return true;
    },

    stopMultiplexedRemoteWatch() {
        // Bump the generation FIRST so any loop that is mid-await retires itself
        // even if its fetch resolves after a new watch has started.
        this.dbUpdatesState.generation += 1;
        this.dbUpdatesState.running = false;
        this.dbUpdatesState.signature = null;
        try {
            this.dbUpdatesState.abort?.abort();
        } catch {
            /* already gone */
        }
        this.dbUpdatesState.abort = null;
        this.dbUpdatesState.watched = new Map();
    },

    isCurrentDbUpdatesGeneration(generation) {
        return this.dbUpdatesState.running && this.dbUpdatesState.generation === generation;
    },

    async runDbUpdatesLoop(remoteUrl, options, generation) {
        const authHeaders = buildAuthHeaders(options);
        let backoffMs = 1000;

        while (this.isCurrentDbUpdatesGeneration(generation)) {
            const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
            this.dbUpdatesState.abort = controller;

            try {
                const since = encodeURIComponent(this.dbUpdatesState.since || "now");
                const response = await fetch(`${remoteUrl}/_db_updates?feed=longpoll&timeout=60000&since=${since}`, {
                    headers: authHeaders,
                    signal: controller?.signal,
                });
                if (!response.ok) throw new Error(`_db_updates failed (${response.status})`);

                const payload = await response.json();
                if (payload?.last_seq) this.dbUpdatesState.since = payload.last_seq;
                backoffMs = 1000;

                if (!this.isCurrentDbUpdatesGeneration(generation)) break;

                const changed = new Set(
                    (payload?.results || [])
                        .map((row) => row?.db_name)
                        .filter((name) => name && this.dbUpdatesState.watched.has(name))
                );
                // Drain each changed database on its own short-lived request.
                for (const dbName of changed) {
                    if (!this.isCurrentDbUpdatesGeneration(generation)) break;
                    await this.drainRemoteChanges(dbName, remoteUrl, options);
                }
            } catch (error) {
                if (!this.isCurrentDbUpdatesGeneration(generation) || error?.name === "AbortError") break;
                console.warn(`[SYNC] _db_updates loop error (retrying in ${backoffMs}ms):`, error.message || error);
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
                backoffMs = Math.min(backoffMs * 2, 30000);
                if (!this.isCurrentDbUpdatesGeneration(generation)) break;
            }
        }
    },

    // One-shot changes read for a single database. Uses PouchDB so the selector
    // filtering and sequence handling stay identical to the per-database feeds
    // this replaces; `live: false` means the socket is released immediately.
    async drainRemoteChanges(dbName, remoteUrl, options) {
        const watcher = this.dbUpdatesState.watched.get(dbName);
        if (!watcher) return;

        const changeOptions = {
            since: watcher.since ?? "now",
            include_docs: true,
            live: false,
            limit: 200,
        };
        if (watcher.selector && typeof watcher.selector === "object") changeOptions.selector = watcher.selector;

        try {
            const result = await watcher.db.changes(changeOptions);
            // Only ever advance to a REAL sequence. If last_seq is missing, keep the
            // previous one: falling back to "now" would silently skip every change
            // from here on, which is the failure this watcher is recovering from.
            if (result?.last_seq !== undefined && result.last_seq !== null) watcher.since = result.last_seq;
            for (const change of result?.results || []) {
                this.emitRemoteChange(dbName, change, watcher, remoteUrl, options);
            }
        } catch (error) {
            console.error(`[REMOTE-CHANGE] ${dbName} drain error:`, error);
        }
    },

    emitRemoteChange(dbName, change, watcher, remoteUrl, options) {
        console.log(`[REMOTE-CHANGE] ${dbName}:`, change);
        if (watcher.refreshStats !== false) {
            void DatabaseManager.getStats(remoteUrl, options, dbName);
        }
        self.postMessage({
            type: "syncChange",
            dbName,
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
