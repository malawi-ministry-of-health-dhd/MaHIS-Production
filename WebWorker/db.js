// Initialize PouchDB instances
importScripts("../script/pouchdb.min.js", "../script/pouchdb.find.min.js");

const buildAuthHeaders = (options = {}) => {
    if (!options?.username && !options?.password) return {};

    return {
        Authorization: `Basic ${btoa(`${options.username || ""}:${options.password || ""}`)}`,
    };
};

const LOCATION_COUNT_DDOC_ID = "_design/mahis_location_counts";
const LOCATION_COUNT_VIEW_NAME = "by_location";
const LOCATION_COUNT_VIEW_TIMEOUT_MS = 10000;
const REMOTE_STATS_CACHE_DB = "mahis_sync_stats";
const REMOTE_STATS_CACHE_TTL_MS = 10 * 60 * 1000;
const PATIENT_RECORDS_DB = "patients_records";
const DEVICE_ID_POOL_TARGETS = {
    dde: 10,
    lab_accession_numbers: 25,
};
const LOCATION_COUNT_VIEW_MAP = `function (doc) {
  if (doc._id && doc._id.indexOf('_design/') === 0) return;

  var locations = {};
  function addLocation(value) {
    if (value === null || value === undefined || value === '') return;
    locations[String(value)] = true;
  }

  addLocation(doc.location_id);
  addLocation(doc.deleted_location_id);

  for (var locationId in locations) {
    emit(locationId, 1);
  }
}`;

const fetchWithTimeout = (url, options = {}, timeoutMs = 0) => {
    if (!timeoutMs || typeof AbortController === "undefined") {
        return fetch(url, options);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { ...options, signal: controller.signal }).finally(() => {
        clearTimeout(timeoutId);
    });
};

const normalizePatientSearchText = (value) =>
    String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const firstPresent = (...values) => values.find((value) => value !== null && value !== undefined && String(value).trim() !== "");

const joinSearchParts = (...parts) => parts.filter(Boolean).join(" ");

const normalizePatientRecordSearchFields = (storeName, doc) => {
    if (storeName !== "patients_records" || !doc || typeof doc !== "object" || doc._deleted) return doc;

    const info = doc.personInformation || {};
    const person = doc.person || {};
    const personName = Array.isArray(person.names) && person.names.length > 0 ? person.names[0] : {};

    const givenSearch = normalizePatientSearchText(firstPresent(info.given_name, doc.given_name, personName.given_name, personName.first_name));
    const middleSearch = normalizePatientSearchText(firstPresent(info.middle_name, doc.middle_name, personName.middle_name));
    const familySearch = normalizePatientSearchText(firstPresent(info.family_name, doc.family_name, personName.family_name, personName.last_name));

    doc.given_name_search = givenSearch;
    doc.middle_name_search = middleSearch;
    doc.family_name_search = familySearch;
    doc.full_name_search = joinSearchParts(givenSearch, familySearch);
    doc.full_name_with_middle_search = joinSearchParts(givenSearch, middleSearch, familySearch);
    doc.gender_search = normalizePatientSearchText(firstPresent(info.gender, doc.gender, person.gender));
    doc.location_id_search = String(firstPresent(doc.location_id, doc.deleted_location_id) || "").trim();

    return doc;
};

const REFERENCE_SEARCH_FIELDS = {
    concept_names: {
        name_search: "name",
    },
    concept_sets: {
        concept_set_name_search: "concept_set_name",
    },
    diagnoses: {
        name_search: "name",
        code_search: "code",
    },
    villages: {
        name_search: "name",
        parent_location_search: "parent_location",
    },
    traditional_authorities: {
        name_search: "name",
        parent_location_search: "parent_location",
    },
    districts: {
        name_search: "name",
        parent_location_search: "parent_location",
    },
    wards: {
        name_search: "name",
        parent_location_search: "parent_location",
    },
};

const normalizeReferenceDataSearchFields = (storeName, doc) => {
    if (!doc || typeof doc !== "object" || doc._deleted) return doc;

    const fieldConfig = REFERENCE_SEARCH_FIELDS[storeName];
    if (!fieldConfig) return doc;

    Object.entries(fieldConfig).forEach(([searchField, sourceField]) => {
        const rawValue = doc[sourceField];
        doc[searchField] = searchField === "parent_location_search" ? String(rawValue || "").trim() : normalizePatientSearchText(rawValue);
    });

    return doc;
};

const normalizeSearchFieldsForStore = (storeName, doc) => {
    normalizePatientRecordSearchFields(storeName, doc);
    normalizeReferenceDataSearchFields(storeName, doc);
    return doc;
};

/**
 * Core DatabaseManager - handles database operations only
 * Sync functionality moved to separate SyncManager
 */
const DatabaseManager = {
    databases: {},
    lastRemoteStats: {},
    lastLocalStats: {},
    remoteStatsFetchedAt: {},
    remoteStatsInFlight: {},
    remoteStatsRefreshInFlight: null,
    remoteStatsCacheDbReady: false,
    remoteStatsCacheDbPromise: null,
    statsPublishedAt: {},
    indexCache: new Set(),
    isInitialized: false,
    useLocalStorage: false, // Track storage mode
    syncPatientsLocally: false,
    remoteBaseUrl: null, // Store remote URL for reference
    isInitialSyncInProgress: false,
    _writeCounts: {}, // Per-database write counters for threshold-based compaction
    _compactionInterval: null, // Stored so it can be cleared on closeAllDatabases

    // Get all database names in order
    get databaseNames() {
        const allDatabaseNames = [...new Set([...databaseConfig.liveSyncDatabases, ...databaseConfig.periodicSyncDatabases].filter(Boolean))];
        return allDatabaseNames.filter((name) => this.shouldTrackDatabase(name));
    },

    shouldTrackDatabase(name) {
        return name !== PATIENT_RECORDS_DB || self.SYNC_PATIENTS_LOCALLY === true;
    },

    getDeviceIdPoolTarget(dbName) {
        return DEVICE_ID_POOL_TARGETS[dbName] || 0;
    },

    shouldUseDeviceIdPoolTargetStats(dbName) {
        return this.useLocalStorage === true && USE_LAN_CONNECTION !== true && this.getDeviceIdPoolTarget(dbName) > 0;
    },

    getDeviceIdPoolRemoteStats(dbName) {
        return {
            docCount: this.getDeviceIdPoolTarget(dbName),
            source: "device_pool_target",
        };
    },

    applyDeviceIdPoolRemoteTargets(stats = {}, databaseName = null) {
        const nextStats = { ...(stats || {}) };
        const databaseNames = databaseName ? [databaseName] : this.databaseNames;

        databaseNames.forEach((dbName) => {
            if (this.shouldUseDeviceIdPoolTargetStats(dbName)) {
                nextStats[dbName] = {
                    ...(nextStats[dbName] || {}),
                    ...this.getDeviceIdPoolRemoteStats(dbName),
                };
            }
        });

        return nextStats;
    },

    getSkippedStatsForDatabase(name) {
        return {
            docCount: 0,
            syncType: this.isLiveSyncDatabase(name) ? "live" : "periodic",
            storageMode: this.getStorageMode().mode,
            skipped: true,
            skipReason: "sync_patients_locally_disabled",
        };
    },

    // Check if database should use live sync
    isLiveSyncDatabase(dbName) {
        return databaseConfig.liveSyncDatabases.includes(dbName);
    },

    // Check if database should use periodic sync
    isPeriodicSyncDatabase(dbName) {
        return databaseConfig.periodicSyncDatabases.includes(dbName);
    },

    /**
     * Get current storage mode information
     * @returns {Object} Storage mode details
     */
    getStorageMode() {
        return {
            mode: this.useLocalStorage ? "local-with-sync" : "remote-only",
            description: this.useLocalStorage
                ? "Data is saved to local PouchDB (IndexedDB) and synced to CouchDB"
                : "Data is saved directly to remote CouchDB (no local storage)",
            useLocalStorage: this.useLocalStorage,
            isInitialized: this.isInitialized,
            remoteUrl: this.remoteBaseUrl,
        };
    },

    getDatabaseHandle(remoteBaseUrl, useLocalStorage, auth, name) {
        const PouchDB = self.PouchDB;
        // Per-DB toggle: patients_records goes REMOTE when the user has
        // disabled patient sync to local storage, even if every other table
        // is being synced locally. Otherwise reads against this handle would
        // hit an empty local IDB and silently return nothing.
        const treatAsLocal = name === PATIENT_RECORDS_DB
            ? useLocalStorage && self.SYNC_PATIENTS_LOCALLY === true
            : useLocalStorage;
        if (treatAsLocal) {
            console.log(`[DB] Creating LOCAL PouchDB handle for: ${name}`);
            return new PouchDB(name);
        } else {
            const reason = name === PATIENT_RECORDS_DB && useLocalStorage
                ? "patient toggle off"
                : "remote-only mode";
            console.log(`[DB] Creating REMOTE CouchDB handle for: ${name} (${reason})`);
            return new PouchDB(`${remoteBaseUrl}/${name}`, {
                skip_setup: true,
                ...(auth ? { auth } : {}),
            });
        }
    },

    async init(remoteBaseUrl, useLocalStorage, auth) {
        if (this.isInitialized) return;

        try {
            // Store configuration
            this.useLocalStorage = useLocalStorage;
            this.syncPatientsLocally = self.SYNC_PATIENTS_LOCALLY === true;
            this.remoteBaseUrl = remoteBaseUrl;

            // Ensure PouchDB is available
            if (typeof self.PouchDB === "undefined") {
                throw new Error("PouchDB is not loaded. Make sure to import PouchDB scripts before initializing.");
            }

            console.log(`[DB] Initializing DatabaseManager in ${useLocalStorage ? "LOCAL-WITH-SYNC" : "REMOTE-ONLY"} mode`);

            // Open all databases in parallel — each revsLimit() call is independent
            await Promise.all(
                this.databaseNames.map(async (name) => {
                    const db = this.getDatabaseHandle(remoteBaseUrl, useLocalStorage, auth, name);
                    this.databases[name] = db;

                    // Limit stored revisions to 1 to keep IndexedDB lean (local mode only)
                    if (useLocalStorage && typeof db.revsLimit === "function") {
                        await db.revsLimit(1);
                    }
                })
            );

            this.isInitialized = true;

            const modeInfo = this.getStorageMode();
            console.log("DatabaseManager initialized successfully", {
                storageMode: modeInfo.mode,
                description: modeInfo.description,
                liveSyncDbs: databaseConfig.liveSyncDatabases,
                periodicSyncDbs: databaseConfig.periodicSyncDatabases.length,
                totalDbs: this.databaseNames.length,
            });

            // Post initialization status to main thread
            self.postMessage({
                type: "db_initialized",
                storageMode: modeInfo,
            });
        } catch (error) {
            console.error("Failed to initialize databases:", error);
            throw new Error("Database initialization failed: " + error.message);
        }
    },

    async runBackgroundCompaction(targetDbName = "") {
        if (this.isInitialSyncInProgress) {
            console.log(`[Compact] Skipping${targetDbName ? ` ${targetDbName}` : ""} — initial sync still in progress`);
            return;
        }

        // Guard: skip if already compacting this DB to avoid overlapping runs
        this._compacting = this._compacting || new Set();
        if (targetDbName && this._compacting.has(targetDbName)) {
            console.log(`[Compact] Skipping ${targetDbName} — compaction already in progress`);
            return;
        }

        const dbEntries = Object.entries(this.databases);
        const filteredEntries = targetDbName ? dbEntries.filter(([name]) => name === targetDbName) : dbEntries;

        if (filteredEntries.length === 0) {
            console.warn(`[Compact] No database found with name '${targetDbName}'`);
            return;
        }

        // Mark all targets as in-progress
        filteredEntries.forEach(([name]) => this._compacting.add(name));

        try {
            const compactionPromises = filteredEntries.map(async ([name, db]) => {
                try {
                    console.log(`[Compact] Starting compaction for ${name}...`);
                    await db.compact();
                    console.log(`[Compact] ✅ Compacted ${name}`);
                } catch (err) {
                    console.warn(`[Compact] ⚠️ Failed to compact ${name}:`, err.message);
                } finally {
                    this._compacting.delete(name);
                }
            });

            await Promise.allSettled(compactionPromises);
        } catch (err) {
            console.error("[Compact] Unexpected error during compaction:", err);
            filteredEntries.forEach(([name]) => this._compacting.delete(name));
        }
    },

    validateDatabase(storeName) {
        if (!this.isInitialized) {
            throw new Error("DatabaseManager not initialized. Call init() first.");
        }
        if (!this.databases[storeName]) {
            throw new Error(`Database "${storeName}" not found. Available databases: ${Object.keys(this.databases).join(", ")}`);
        }
    },

    validateDocumentData(data) {
        if (!data || typeof data !== "object") {
            throw new Error("Document data must be a valid object");
        }
        if (!data._id) {
            throw new Error("Document must have an _id property");
        }
    },

    async ensureIndex(db, fields, storeName) {
        const indexKey = `${storeName}:${fields.sort().join(",")}`;

        if (!this.indexCache.has(indexKey)) {
            try {
                await db.createIndex({
                    index: {
                        fields: fields,
                        name: `idx_${fields.join("_")}`,
                    },
                });
                this.indexCache.add(indexKey);
            } catch (error) {
                if (!error.message.includes("exists")) {
                    console.warn(`Failed to create index for ${indexKey}:`, error);
                }
            }
        }
    },

    /**
     * Advanced record retrieval function with pagination support
     * @param {string} dbName - Database name
     * @param {Object} options - Query options
     * @param {number} options.currentPage - Current page number (default: 1)
     * @param {number} options.itemsPerPage - Items per page (0 = no pagination, default: 0)
     * @param {Object} options.selector - PouchDB selector object for filtering
     * @param {Array} options.sort - Sort array for ordering results
     * @param {Array} options.fields - Fields to return (projection)
     * @param {string} options.docType - Document type filter
     * @returns {Promise<Object|Array>} Records with pagination info or array of records
     */
    async get(dbName, options = {}) {
        try {
            this.validateDatabase(dbName);

            const { currentPage = 1, itemsPerPage = 0, selector = {}, sort, fields, docType } = options;

            console.log(`[DB] Reading from ${this.useLocalStorage ? "LOCAL PouchDB" : "REMOTE CouchDB"} - ${dbName}`);

            const db = this.databases[dbName];

            // Build final selector with docType if provided
            const finalSelector = docType ? { ...selector, $or: [{ docType }, { type: docType }] } : selector;

            // Ensure index exists for selector fields
            const selectorFields = Object.keys(finalSelector);
            if (selectorFields.length > 0) {
                await this.ensureIndex(db, selectorFields, dbName);
            }

            // ── No pagination: single query, no count needed ──────────────────
            if (itemsPerPage === 0) {
                const result = await db.find({
                    selector: finalSelector,
                    ...(sort && { sort }),
                    ...(fields && { fields }),
                });
                return result.docs;
            }

            // ── Paginated: fetch the page first, then count only if necessary ─
            const result = await db.find({
                selector: finalSelector,
                ...(sort && { sort }),
                ...(fields && { fields }),
                skip: (currentPage - 1) * itemsPerPage,
                limit: itemsPerPage,
            });

            // If the page came back with fewer records than requested we are on
            // the last (or only) page — derive totalCount without a second query.
            let totalCount;
            if (currentPage === 1 && result.docs.length < itemsPerPage) {
                totalCount = result.docs.length;
            } else {
                // Need an explicit count — fetch _id only to minimise data transfer
                const countResult = await db.find({
                    selector: finalSelector,
                    fields: ["_id"],
                });
                totalCount = countResult.docs.length;
            }

            return {
                records: result.docs,
                totalCount,
                currentPage,
                itemsPerPage,
                totalPages: Math.ceil(totalCount / itemsPerPage),
            };
        } catch (error) {
            console.error(`Error retrieving records from ${dbName}:`, error);
            throw new Error(`Failed to retrieve records from ${dbName}: ${error.message}`);
        }
    },

    async upsertDocument(storeName, data, options = {}) {
        try {
            this.validateDatabase(storeName);
            data = normalizeSearchFieldsForStore(storeName, data);
            this.validateDocumentData(data);

            const storageTarget = this.useLocalStorage ? "LOCAL PouchDB (will sync to CouchDB)" : "REMOTE CouchDB directly";

            console.log(`[DB] 💾 SAVING to ${storageTarget} - ${storeName}`, {
                docId: data._id,
                mode: this.getStorageMode().mode,
            });

            const db = this.databases[storeName];
            const { upsert = true } = options;

            let result;

            const tryPutWithLatestRev = async () => {
                const existingDoc = await db.get(data._id, { conflicts: true });
                const conflictRevisions = Array.isArray(existingDoc._conflicts) ? existingDoc._conflicts : [];
                const existingDocWithoutConflictMetadata = { ...existingDoc };
                delete existingDocWithoutConflictMetadata._conflicts;

                const updatedDoc = {
                    ...existingDocWithoutConflictMetadata,
                    ...data,
                    _rev: existingDoc._rev,
                };

                if (conflictRevisions.length > 0) {
                    updatedDoc.has_conflicts = true;
                    updatedDoc.conflict_revisions = conflictRevisions;
                    updatedDoc.conflict_detected_at = new Date().toISOString();
                }

                return db.put(updatedDoc);
            };

            if (upsert) {
                try {
                    try {
                        result = await tryPutWithLatestRev();
                    } catch (firstErr) {
                        // 409 happens when another writer (us in a previous
                        // in-flight call, sync, or another device) bumped the
                        // _rev between our get and put. Refetch the latest
                        // _rev and retry once. If THAT still 409s, surface it.
                        if (firstErr.status === 409 || firstErr.name === "conflict") {
                            console.warn(`[DB] 409 on ${storeName}/${data._id}; retrying with latest _rev`);
                            result = await tryPutWithLatestRev();
                            console.log(`[DB] ✅ UPDATED after conflict retry in ${storageTarget} - ${storeName}/${data._id}`);
                        } else {
                            throw firstErr;
                        }
                    }
                    if (!result) {
                        // Unreachable in normal control flow; here for safety.
                        result = await tryPutWithLatestRev();
                    }

                    console.log(`[DB] ✅ UPDATED in ${storageTarget} - ${storeName}/${data._id}`);

                    // Threshold-based compaction disabled. Compact holds long
                    // IDB transactions and was firing during index builds /
                    // foreground queries, causing 50+ second hangs. Use
                    // window.mahisCompactNow() to compact intentionally.
                    this._writeCounts[storeName] = (this._writeCounts[storeName] || 0) + 1;
                } catch (err) {
                    if (err.name === "not_found") {
                        result = await db.put(data);
                        console.log(`[DB] ✅ CREATED in ${storageTarget} - ${storeName}/${data._id}`);
                    } else {
                        throw err;
                    }
                }
            } else {
                result = await db.put(data);
                console.log(`[DB] ✅ SAVED to ${storageTarget} - ${storeName}/${data._id}`);
            }

            return result;
        } catch (error) {
            console.error(`Error adding data to ${storeName}:`, error);
            throw new Error(`Failed to add data to ${storeName}: ${error.message}`);
        }
    },
    async deleteData(storeName, obj) {
        try {
            this.validateDatabase(storeName);

            if (!obj) {
                console.error("Document identifier is required for deletion");
                return;
            }

            const storageTarget = this.useLocalStorage ? "LOCAL PouchDB (will sync to CouchDB)" : "REMOTE CouchDB directly";

            console.log(`[DB] 🗑️ DELETING from ${storageTarget} - ${storeName}`);

            const db = this.databases[storeName];

            let doc;
            if (typeof obj === "object") {
                const result = await db.find({ selector: obj });

                if (result.docs.length === 0) {
                    console.error(`Document not found in ${storeName}`);
                    return;
                }

                doc = result.docs[0];
            } else {
                doc = await db.get(obj);
            }

            // 🔑 Preserve selector fields BEFORE delete
            const tombstone = {
                _id: doc._id,
                _rev: doc._rev,
                _deleted: true,
                deleted_location_id: LOCATION_ID, // required for selective pull
            };

            const deleted = await db.put(tombstone);

            console.log(`[DB] ✅ Document deleted (tombstone) from ${storageTarget} - ${storeName}/${doc._id}`);

            return deleted;
        } catch (error) {
            if (error.name === "not_found") {
                throw new Error(`Document not found in ${storeName}`);
            }
            console.error(`Error deleting data from ${storeName}:`, error);
            throw new Error(`Failed to delete data from ${storeName}: ${error.message}`);
        }
    },

    async getCount(storeName, selector = null) {
        try {
            this.validateDatabase(storeName);
            const db = this.databases[storeName];

            if (selector) {
                // Bookmark-based counting — never loads all IDs into memory at once.
                // Uses the same approach as countRemoteDocs but against local IndexedDB.
                const BATCH_SIZE = 5000;
                let count = 0;
                let bookmark;

                do {
                    const result = await db.find({
                        selector,
                        fields: ["_id"],
                        limit: BATCH_SIZE,
                        ...(bookmark ? { bookmark } : {}),
                    });
                    count += result.docs.length;
                    // A partial batch means we've reached the end
                    bookmark = result.docs.length === BATCH_SIZE ? result.bookmark : null;
                } while (bookmark);

                return count;
            } else {
                // No selector — db.info() gives the total directly, no scan needed
                const info = await db.info();
                return info.doc_count;
            }
        } catch (error) {
            console.error(`Error getting count from ${storeName}:`, error);
            throw new Error(`Failed to get count from ${storeName}: ${error.message}`);
        }
    },

    async bulkOperation(storeName, docs, operation = "insert") {
        try {
            this.validateDatabase(storeName);
            if (!Array.isArray(docs) || docs.length === 0) {
                throw new Error("Documents must be a non-empty array");
            }

            const storageTarget = this.useLocalStorage ? "LOCAL PouchDB (will sync to CouchDB)" : "REMOTE CouchDB directly";
            console.log(`[DB] 📦 BULK ${operation.toUpperCase()} to ${storageTarget} - ${storeName} (${docs.length} docs)`);

            const db = this.databases[storeName];

            if (operation === "delete") {
                docs = docs.map((doc) => ({ ...doc, _deleted: true }));
            } else {
                docs = docs.map((doc) => normalizeSearchFieldsForStore(storeName, doc));
            }

            const result = await db.bulkDocs(docs);

            console.log(`[DB] ✅ Bulk ${operation} completed for ${storeName}:`, {
                totalDocs: docs.length,
                successful: result.filter((r) => !r.error).length,
                errors: result.filter((r) => r.error).length,
                target: storageTarget,
            });

            return result;
        } catch (error) {
            console.error(`Error in bulk ${operation} for ${storeName}:`, error);
            throw new Error(`Failed bulk ${operation} in ${storeName}: ${error.message}`);
        }
    },

    getDatabaseInstance(storeName) {
        this.validateDatabase(storeName);
        return this.databases[storeName];
    },

    async closeAllDatabases() {
        // Stop the scheduled compaction interval so it doesn't fire against closed databases
        if (this._compactionInterval) {
            clearInterval(this._compactionInterval);
            this._compactionInterval = null;
            console.log("[DB] Compaction interval cleared");
        }

        // Reset write counters and in-progress tracking
        this._writeCounts = {};
        if (this._compacting) this._compacting.clear();

        const closePromises = Object.values(this.databases).map((db) => {
            try {
                return db.close();
            } catch (error) {
                console.warn("Error closing database:", error);
                return Promise.resolve();
            }
        });

        await Promise.allSettled(closePromises);
        this.indexCache.clear();
        this.databases = {};
        this.isInitialized = false;
        this.useLocalStorage = false;
        this.syncPatientsLocally = false;
        this.remoteBaseUrl = null;
        this.isInitialSyncInProgress = false;
        this.lastRemoteStats = {};
        this.lastLocalStats = {};
        this.remoteStatsFetchedAt = {};
        this.remoteStatsInFlight = {};
        this.remoteStatsRefreshInFlight = null;
        this.remoteStatsCacheDbReady = false;
        this.remoteStatsCacheDbPromise = null;
        this.statsPublishedAt = {};
        console.log("[DB] All databases closed");
    },

    async getLocalStats(databaseName = null) {
        if (!this.isInitialized) {
            throw new Error("DatabaseManager not initialized");
        }

        if (databaseName && !this.shouldTrackDatabase(databaseName)) {
            return { [databaseName]: this.getSkippedStatsForDatabase(databaseName) };
        }

        // Validate that the specified database exists
        if (databaseName && !this.databases[databaseName]) {
            throw new Error(`Database '${databaseName}' not found`);
        }

        const databasesToProcess = databaseName
            ? { [databaseName]: this.databases[databaseName] }
            : Object.fromEntries(Object.entries(this.databases).filter(([name]) => this.shouldTrackDatabase(name)));
        const storageMode = this.getStorageMode().mode;

        if (!this.useLocalStorage) {
            return Object.fromEntries(
                Object.keys(databasesToProcess).map((name) => [
                    name,
                    {
                        ...(this.lastLocalStats?.[name] || {}),
                        docCount: 0,
                        syncType: this.isLiveSyncDatabase(name) ? "live" : "periodic",
                        storageMode,
                    },
                ])
            );
        }

        // Query all databases in parallel \u2014 each db.info() + db.allDocs() is independent
        const entries = Object.entries(databasesToProcess);
        const results = await Promise.all(
            entries.map(async ([name, db]) => {
                try {
                    const info = await db.info();
                    let docCount = 0;

                    if (name === "dde" && this.useLocalStorage) {
                        docCount = await this.getCount(name, {
                            assignedTo: self.DEVICE_ID || "",
                            status: "used",
                        });
                        return [
                            name,
                            {
                                docCount,
                                syncType: this.isLiveSyncDatabase(name) ? "live" : "periodic",
                                storageMode,
                            },
                        ];
                    }

                    if (name === "lab_accession_numbers" && this.useLocalStorage) {
                        docCount = await this.getCount(name, {
                            type: "lab_accession_number",
                            location_id: String((typeof FACILITY_LOCATION_ID !== "undefined" && FACILITY_LOCATION_ID) || LOCATION_ID || ""),
                            assigned_to_device_id: self.DEVICE_ID || "",
                            status: "reserved",
                        });
                        return [
                            name,
                            {
                                docCount,
                                syncType: this.isLiveSyncDatabase(name) ? "live" : "periodic",
                                storageMode,
                            },
                        ];
                    }

                    if (this.useLocalStorage || name === "dde") {
                        const designDocs = await db.allDocs({
                            startkey: "_design/",
                            endkey: "_design/\ufff0",
                            include_docs: false,
                        });
                        docCount = info.doc_count - designDocs.rows.length;
                    }

                    return [
                        name,
                        {
                            docCount,
                            syncType: this.isLiveSyncDatabase(name) ? "live" : "periodic",
                            storageMode,
                        },
                    ];
                } catch (error) {
                    return [
                        name,
                        {
                            error: error.message,
                            ...(LOCATION_ID && { location_id: LOCATION_ID }),
                        },
                    ];
                }
            })
        );

        return Object.fromEntries(results);
    },

    /**
     * Count remote documents using bookmark-based pagination.
     * Replaces the old `limit: 1000000` approach \u2014 never loads more than
     * BATCH_SIZE doc IDs at a time regardless of total document count.
     */
    async countRemoteDocs(remoteBaseUrl, dbName, selector, authHeaders) {
        const BATCH_SIZE = 50000;
        let count = 0;
        let bookmark;

        do {
            const response = await fetch(`${remoteBaseUrl}/${dbName}/_find`, {
                method: "POST",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({
                    selector,
                    fields: ["_id"],
                    limit: BATCH_SIZE,
                    ...(bookmark ? { bookmark } : {}),
                }),
            });

            if (!response.ok) throw new Error(`_find failed (${response.status})`);

            const result = await response.json();
            count += result.docs.length;

            // Continue only if we got a full batch \u2014 a partial batch means no more pages
            bookmark = result.docs.length === BATCH_SIZE ? result.bookmark : null;
        } while (bookmark);

        return count;
    },

    getLocationCountSelector(locationId) {
        return {
            $and: [
                {
                    $or: [
                        { location_id: locationId },
                        { location_id: Number(locationId) },
                        { deleted_location_id: locationId },
                        { deleted_location_id: Number(locationId) },
                    ],
                },
                { _id: { $not: { $regex: "^_design/" } } },
            ],
        };
    },

    async getRemoteDesignDocCount(remoteBaseUrl, dbName, authHeaders) {
        const response = await fetch(`${remoteBaseUrl}/${dbName}/_design_docs?limit=0`, { headers: authHeaders });

        if (!response.ok) return 0;

        const designDocs = await response.json();
        return Number(designDocs.total_rows) || 0;
    },

    normalizeRemoteStatsCachePart(value) {
        return String(value ?? "all")
            .trim()
            .replace(/[^a-zA-Z0-9_.-]/g, "_") || "all";
    },

    getRemoteStatsCacheKey(dbName, scope, locationId = "all") {
        return `remote_count:${this.normalizeRemoteStatsCachePart(dbName)}:${this.normalizeRemoteStatsCachePart(scope)}:${this.normalizeRemoteStatsCachePart(locationId)}`;
    },

    async ensureRemoteStatsCacheDb(remoteBaseUrl, authHeaders) {
        if (this.remoteStatsCacheDbReady) return true;
        if (this.remoteStatsCacheDbPromise) return this.remoteStatsCacheDbPromise;

        this.remoteStatsCacheDbPromise = (async () => {
            try {
                const response = await fetch(`${remoteBaseUrl}/${REMOTE_STATS_CACHE_DB}`, {
                    method: "PUT",
                    headers: authHeaders,
                });

                if (response.ok || response.status === 412) {
                    this.remoteStatsCacheDbReady = true;
                    return true;
                }

                console.warn(`[DB] Shared remote stats cache unavailable (${response.status}); falling back to direct counts`);
                return false;
            } catch (error) {
                console.warn("[DB] Shared remote stats cache unavailable; falling back to direct counts:", error.message || error);
                return false;
            } finally {
                this.remoteStatsCacheDbPromise = null;
            }
        })();

        return this.remoteStatsCacheDbPromise;
    },

    async fetchRemoteStatsCacheDoc(remoteBaseUrl, cacheKey, authHeaders) {
        if (!(await this.ensureRemoteStatsCacheDb(remoteBaseUrl, authHeaders))) return null;

        const response = await fetch(`${remoteBaseUrl}/${REMOTE_STATS_CACHE_DB}/${encodeURIComponent(cacheKey)}`, {
            headers: authHeaders,
        });

        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Shared stats cache read failed (${response.status})`);
        return response.json();
    },

    statsFromRemoteStatsCacheDoc(cacheDoc) {
        if (!cacheDoc) return null;
        const expiresAt = Date.parse(cacheDoc.expiresAt || "");
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

        const stats = cacheDoc.stats && typeof cacheDoc.stats === "object" ? cacheDoc.stats : cacheDoc;
        if (!Number.isFinite(Number(stats.docCount))) return null;

        return {
            ...stats,
            docCount: Number(stats.docCount),
            source: `${stats.source || cacheDoc.source || "remote_count"}_shared_cache`,
            sharedCache: true,
            cachedAt: cacheDoc.calculatedAt,
            expiresAt: cacheDoc.expiresAt,
        };
    },

    async getRemoteStatsFromSharedCache(remoteBaseUrl, cacheKey, authHeaders) {
        try {
            const cacheDoc = await this.fetchRemoteStatsCacheDoc(remoteBaseUrl, cacheKey, authHeaders);
            return this.statsFromRemoteStatsCacheDoc(cacheDoc);
        } catch (error) {
            console.warn("[DB] Shared remote stats cache read failed; falling back to direct count:", error.message || error);
            return null;
        }
    },

    hasKnownRemoteStats(stats) {
        return stats && Number.isFinite(Number(stats.docCount));
    },

    getRemoteStatsCacheKeysForDatabase(dbName) {
        try {
            const selector = SyncManager.getLocationSelector(dbName);
            const locationId = selector?.location_id;
            if (locationId !== undefined && locationId !== null && String(locationId).trim() !== "") {
                return [
                    this.getRemoteStatsCacheKey(dbName, "location", locationId),
                    this.getRemoteStatsCacheKey(dbName, "all"),
                ];
            }
        } catch {
            // Fall through to the unscoped cache key.
        }

        return [this.getRemoteStatsCacheKey(dbName, "all")];
    },

    async fetchRemoteStatsCacheDocs(remoteBaseUrl, cacheKeys, authHeaders) {
        const uniqueKeys = [...new Set(cacheKeys.filter(Boolean))];
        if (uniqueKeys.length === 0) return {};
        if (!(await this.ensureRemoteStatsCacheDb(remoteBaseUrl, authHeaders))) return {};

        try {
            const response = await fetch(`${remoteBaseUrl}/${REMOTE_STATS_CACHE_DB}/_all_docs?include_docs=true`, {
                method: "POST",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ keys: uniqueKeys }),
            });

            if (!response.ok) throw new Error(`Shared stats cache bulk read failed (${response.status})`);

            const result = await response.json();
            return (result.rows || []).reduce((map, row) => {
                if (row?.doc) map[row.id] = row.doc;
                return map;
            }, {});
        } catch (error) {
            console.warn("[DB] mahis_sync_stats bulk read failed; falling back to individual reads:", error.message || error);
            const docs = {};
            await Promise.allSettled(
                uniqueKeys.map(async (cacheKey) => {
                    try {
                        const doc = await this.fetchRemoteStatsCacheDoc(remoteBaseUrl, cacheKey, authHeaders);
                        if (doc) docs[cacheKey] = doc;
                    } catch {
                        // Missing/failed single cache docs are handled by the caller.
                    }
                })
            );
            return docs;
        }
    },

    publishStatsSnapshot(extra = {}) {
        self.postMessage({
            type: "db_stats",
            storageMode: this.getStorageMode(),
            local: this.lastLocalStats || {},
            remote: this.lastRemoteStats || {},
            isPartialUpdate: false,
            ...extra,
        });
    },

    // Stale-allowed read for startup. Same as statsFromRemoteStatsCacheDoc but
    // ignores expiresAt — stale numbers are still useful for the initial UI.
    staleStatsFromRemoteStatsCacheDoc(cacheDoc) {
        if (!cacheDoc) return null;
        const stats = cacheDoc.stats && typeof cacheDoc.stats === "object" ? cacheDoc.stats : cacheDoc;
        if (!Number.isFinite(Number(stats.docCount))) return null;
        return {
            ...stats,
            docCount: Number(stats.docCount),
            source: `${stats.source || cacheDoc.source || "remote_count"}_shared_cache_stale`,
            sharedCache: true,
            staleCacheRead: true,
            cachedAt: cacheDoc.calculatedAt,
            expiresAt: cacheDoc.expiresAt,
        };
    },

    // Read every known DB's count from mahis_sync_stats in one pass, ignoring
    // TTL. Publishes the snapshot as initial remote stats so the UI shows
    // numbers immediately — before sync runs and well before fresh counts
    // come in. Called on worker startup.
    //
    // Important: the cache uses different keys for location-filtered DBs
    // (`remote_count:<db>:location:<loc>`) vs unfiltered (`remote_count:<db>:all:all`).
    // We must look up the SAME key that getRemoteStats would write/read for
    // this DB, otherwise we miss location-scoped entries entirely.
    async loadInitialRemoteStatsFromCache(remoteBaseUrl, authHeaders, databaseNames = this.databaseNames) {
        try {
            if (!(await this.ensureRemoteStatsCacheDb(remoteBaseUrl, authHeaders))) return null;

            const snapshot = {};
            const keysByDb = Object.fromEntries(databaseNames.map((dbName) => [dbName, this.getRemoteStatsCacheKeysForDatabase(dbName)]));
            const cacheDocs = await this.fetchRemoteStatsCacheDocs(remoteBaseUrl, Object.values(keysByDb).flat(), authHeaders);

            databaseNames.forEach((dbName) => {
                const cacheKeysToTry = keysByDb[dbName] || [];
                for (const cacheKey of cacheKeysToTry) {
                    const stats = this.staleStatsFromRemoteStatsCacheDoc(cacheDocs[cacheKey]);
                    if (stats) {
                        snapshot[dbName] = stats;
                        return; // First hit wins.
                    }
                }
            });

            const targetAwareSnapshot = this.applyDeviceIdPoolRemoteTargets(snapshot);
            const hits = Object.keys(targetAwareSnapshot).length;
            if (hits === 0) {
                console.log("[DB] mahis_sync_stats: no cached remote counts found yet");
                return null;
            }
            console.log(`[DB] mahis_sync_stats: loaded ${hits}/${databaseNames.length} cached counts`, {
                hit: Object.keys(targetAwareSnapshot),
            });

            // Merge into lastRemoteStats and publish to the main thread so the
            // modal updates without waiting for the per-DB refresh.
            this.lastRemoteStats = { ...this.lastRemoteStats, ...targetAwareSnapshot };
            this.publishStatsSnapshot({
                isPartialUpdate: false,
                fromCache: true,
            });
            return targetAwareSnapshot;
        } catch (error) {
            console.warn("[DB] loadInitialRemoteStatsFromCache failed:", error.message || error);
            return null;
        }
    },

    getMissingRemoteStatsDatabases(databaseNames = this.databaseNames) {
        return databaseNames.filter((dbName) => !this.hasKnownRemoteStats(this.lastRemoteStats?.[dbName]));
    },

    async createMissingRemoteStats(remoteBaseUrl, options = {}, databaseNames = this.databaseNames, statsOptions = {}) {
        const missingDatabases = databaseNames.filter((dbName) => !this.hasKnownRemoteStats(this.lastRemoteStats?.[dbName]));
        if (missingDatabases.length === 0) return [];

        const parallelLimit = Math.max(1, Math.floor(Number(statsOptions.parallelLimit) || 1));
        console.log(`[DB] mahis_sync_stats: creating ${missingDatabases.length} missing remote count(s) before sync`, {
            missing: missingDatabases,
            parallelLimit,
        });

        await this.mapWithConcurrency(missingDatabases, parallelLimit, async (dbName) => {
            await this.getStats(remoteBaseUrl, options, dbName, {
                forceRemote: true,
                remoteCacheTtlMs: 0,
                throttleMs: 0,
                ...statsOptions,
            });
        });

        return missingDatabases;
    },

    async primeRemoteStatsBeforeSync(remoteBaseUrl, options = {}, statsOptions = {}) {
        if (!remoteBaseUrl) return { cached: 0, created: 0, skipped: true };

        const authHeaders = buildAuthHeaders(options);
        const databaseNames = statsOptions.databaseNames || this.databaseNames;

        const cachedStats = (await this.loadInitialRemoteStatsFromCache(remoteBaseUrl, authHeaders, databaseNames)) || {};
        const cached = Object.keys(cachedStats).length;

        const missingBeforeCreate = this.getMissingRemoteStatsDatabases(databaseNames);
        if (missingBeforeCreate.length > 0) {
            await this.createMissingRemoteStats(remoteBaseUrl, options, missingBeforeCreate, {
                parallelLimit: statsOptions.parallelLimit || 1,
            });
        }

        const missingAfterCreate = this.getMissingRemoteStatsDatabases(databaseNames);
        console.log("[DB] mahis_sync_stats: remote stats primed before sync", {
            cached,
            created: Math.max(0, missingBeforeCreate.length - missingAfterCreate.length),
            missing: missingAfterCreate,
        });

        this.publishStatsSnapshot({
            isPartialUpdate: false,
            fromCache: cached > 0,
            remoteStatsPrimed: true,
        });

        return {
            cached,
            created: Math.max(0, missingBeforeCreate.length - missingAfterCreate.length),
            missing: missingAfterCreate,
        };
    },

    async writeRemoteStatsSharedCache(remoteBaseUrl, cacheKey, stats, authHeaders, meta = {}) {
        if (!(await this.ensureRemoteStatsCacheDb(remoteBaseUrl, authHeaders))) return;

        const now = new Date();
        const cacheDoc = {
            _id: cacheKey,
            type: "remote_count",
            ...meta,
            stats,
            docCount: Number(stats.docCount) || 0,
            source: stats.source,
            calculatedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + REMOTE_STATS_CACHE_TTL_MS).toISOString(),
        };

        const putDoc = async (doc) =>
            fetch(`${remoteBaseUrl}/${REMOTE_STATS_CACHE_DB}/${encodeURIComponent(cacheKey)}`, {
                method: "PUT",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify(doc),
            });

        try {
            let response = await putDoc(cacheDoc);
            if (response.status === 409) {
                const existing = await this.fetchRemoteStatsCacheDoc(remoteBaseUrl, cacheKey, authHeaders);
                if (existing?._rev) {
                    response = await putDoc({ ...cacheDoc, _rev: existing._rev });
                }
            }

            if (!response.ok && response.status !== 409) {
                console.warn(`[DB] Shared remote stats cache write failed (${response.status})`);
            }
        } catch (error) {
            console.warn("[DB] Shared remote stats cache write failed:", error.message || error);
        }
    },

    async getRemoteDbSummary(remoteBaseUrl, dbName, authHeaders) {
        const cacheKey = this.getRemoteStatsCacheKey(dbName, "all");
        const cachedStats = await this.getRemoteStatsFromSharedCache(remoteBaseUrl, cacheKey, authHeaders);
        if (cachedStats) return cachedStats;

        const [response, designDocCount] = await Promise.all([
            fetch(`${remoteBaseUrl}/${dbName}`, { headers: authHeaders }),
            this.getRemoteDesignDocCount(remoteBaseUrl, dbName, authHeaders),
        ]);

        if (!response.ok) throw new Error(`DB info failed (${response.status})`);

        const info = await response.json();
        const stats = {
            docCount: Math.max(0, (Number(info.doc_count) || 0) - designDocCount),
            designDocCount,
            updateSeq: info.update_seq,
            source: "db_info",
        };
        await this.writeRemoteStatsSharedCache(remoteBaseUrl, cacheKey, stats, authHeaders, {
            dbName,
            scope: "all",
        });
        return stats;
    },

    async ensureRemoteLocationCountView(remoteBaseUrl, dbName, authHeaders) {
        const designDocUrl = `${remoteBaseUrl}/${dbName}/${LOCATION_COUNT_DDOC_ID}`;
        const desiredView = {
            map: LOCATION_COUNT_VIEW_MAP,
            reduce: "_count",
        };

        const response = await fetch(designDocUrl, { headers: authHeaders });

        if (response.ok) {
            const designDoc = await response.json();
            const currentView = designDoc.views?.[LOCATION_COUNT_VIEW_NAME];
            if (currentView?.map === desiredView.map && currentView?.reduce === desiredView.reduce) {
                return;
            }

            const updatedDesignDoc = {
                ...designDoc,
                views: {
                    ...(designDoc.views || {}),
                    [LOCATION_COUNT_VIEW_NAME]: desiredView,
                },
            };

            const updateResponse = await fetch(designDocUrl, {
                method: "PUT",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify(updatedDesignDoc),
            });

            if (!updateResponse.ok && updateResponse.status !== 409) {
                throw new Error(`Location count view update failed (${updateResponse.status})`);
            }
            return;
        }

        if (response.status !== 404) {
            throw new Error(`Location count view check failed (${response.status})`);
        }

        const createResponse = await fetch(designDocUrl, {
            method: "PUT",
            headers: { ...authHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({
                _id: LOCATION_COUNT_DDOC_ID,
                views: {
                    [LOCATION_COUNT_VIEW_NAME]: desiredView,
                },
            }),
        });

        if (!createResponse.ok && createResponse.status !== 409) {
            throw new Error(`Location count view create failed (${createResponse.status})`);
        }
    },

    async getRemoteLocationCountFromView(remoteBaseUrl, dbName, locationId, authHeaders) {
        await this.ensureRemoteLocationCountView(remoteBaseUrl, dbName, authHeaders);

        const encodedKey = encodeURIComponent(JSON.stringify(String(locationId)));
        const response = await fetchWithTimeout(
            `${remoteBaseUrl}/${dbName}/${LOCATION_COUNT_DDOC_ID}/_view/${LOCATION_COUNT_VIEW_NAME}?reduce=true&key=${encodedKey}`,
            { headers: authHeaders },
            LOCATION_COUNT_VIEW_TIMEOUT_MS
        );

        if (!response.ok) throw new Error(`Location count view failed (${response.status})`);

        const result = await response.json();
        const docCount = Number(result.rows?.[0]?.value) || 0;
        return {
            docCount,
            locationId: String(locationId),
            source: "location_count_view",
        };
    },

    async getRemoteLocationCount(remoteBaseUrl, dbName, locationId, authHeaders) {
        const cacheKey = this.getRemoteStatsCacheKey(dbName, "location", locationId);
        const cachedStats = await this.getRemoteStatsFromSharedCache(remoteBaseUrl, cacheKey, authHeaders);
        if (cachedStats) return cachedStats;

        try {
            const stats = await this.getRemoteLocationCountFromView(remoteBaseUrl, dbName, locationId, authHeaders);
            void this.writeRemoteStatsSharedCache(remoteBaseUrl, cacheKey, stats, authHeaders, {
                dbName,
                scope: "location",
                locationId: String(locationId),
            });
            return stats;
        } catch (error) {
            console.warn(`[DB] Location count view unavailable for ${dbName}; falling back to Mango count:`, error.message || error);
            const docCount = await this.countRemoteDocs(remoteBaseUrl, dbName, this.getLocationCountSelector(locationId), authHeaders);
            const stats = {
                docCount,
                locationId: String(locationId),
                source: "filtered_find_fallback",
                warning: error.message || String(error),
            };
            void this.writeRemoteStatsSharedCache(remoteBaseUrl, cacheKey, stats, authHeaders, {
                dbName,
                scope: "location",
                locationId: String(locationId),
            });
            return stats;
        }
    },

    getConfiguredParallelLimit(defaultLimit = 2) {
        const configuredLimit = typeof SYNC_PARALLEL_LIMIT === "undefined" ? defaultLimit : Number(SYNC_PARALLEL_LIMIT);
        return Number.isFinite(configuredLimit) && configuredLimit > 0 ? Math.floor(configuredLimit) : defaultLimit;
    },

    async mapWithConcurrency(items, limit, handler) {
        const results = new Array(items.length);
        let currentIndex = 0;
        const workerCount = Math.min(Math.max(1, limit), items.length);

        const workers = Array.from({ length: workerCount }, async () => {
            while (currentIndex < items.length) {
                const index = currentIndex++;
                results[index] = await handler(items[index], index);
            }
        });

        await Promise.all(workers);
        return results;
    },

    async getRemoteStats(remoteBaseUrl, options = {}, databaseName = null) {
        const authHeaders = buildAuthHeaders(options);

        if (databaseName && !this.shouldTrackDatabase(databaseName)) {
            return { [databaseName]: this.getSkippedStatsForDatabase(databaseName) };
        }

        if (databaseName && !this.databaseNames.includes(databaseName)) {
            throw new Error(`Database '${databaseName}' not found in databaseNames`);
        }

        const databasesToProcess = databaseName ? [databaseName] : this.databaseNames;
        const parallelLimit = this.getConfiguredParallelLimit();

        // Limit remote count calls so progress stats do not compete with replication.
        const results = await this.mapWithConcurrency(databasesToProcess, parallelLimit, async (dbName) => {
            try {
                if (this.shouldUseDeviceIdPoolTargetStats(dbName)) {
                    return [dbName, this.getDeviceIdPoolRemoteStats(dbName)];
                }

                const selector = SyncManager.getLocationSelector(dbName);
                const useMangoLocationCount = selector && options.useMangoLocationCount === true;

                if (selector?.location_id && !useMangoLocationCount) {
                    return [dbName, await this.getRemoteLocationCount(remoteBaseUrl, dbName, selector.location_id, authHeaders)];
                }

                if (useMangoLocationCount) {
                    const docCount = await this.countRemoteDocs(
                        remoteBaseUrl,
                        dbName,
                        this.getLocationCountSelector(selector.location_id),
                        authHeaders
                    );
                    return [dbName, { docCount, source: "filtered_find" }];
                }

                return [dbName, await this.getRemoteDbSummary(remoteBaseUrl, dbName, authHeaders)];
            } catch (error) {
                return [dbName, { error: error.message, source: "remote" }];
            }
        });

        return Object.fromEntries(results);
    },

    async getRemoteStatsWithCache(remoteBaseUrl, options = {}, databaseName = null, statsOptions = {}) {
        const now = Date.now();
        const cacheKey = databaseName || "__all__";
        const remoteCacheTtlMs = statsOptions.remoteCacheTtlMs ?? (databaseName ? 5 * 60 * 1000 : 0);

        if (databaseName && !this.shouldTrackDatabase(databaseName)) {
            return { [databaseName]: this.getSkippedStatsForDatabase(databaseName) };
        }

        if (databaseName && this.lastRemoteStats?.[databaseName]) {
            const fetchedAt = this.remoteStatsFetchedAt?.[databaseName] || 0;
            if (!statsOptions.forceRemote && remoteCacheTtlMs > 0 && now - fetchedAt < remoteCacheTtlMs) {
                return this.applyDeviceIdPoolRemoteTargets({ [databaseName]: this.lastRemoteStats[databaseName] }, databaseName);
            }
        }

        if (this.remoteStatsInFlight[cacheKey]) {
            return this.remoteStatsInFlight[cacheKey];
        }

        this.remoteStatsInFlight[cacheKey] = this.getRemoteStats(remoteBaseUrl, { ...options, ...statsOptions }, databaseName)
            .then((stats) => {
                const fetchedAt = Date.now();
                Object.keys(stats || {}).forEach((dbName) => {
                    this.remoteStatsFetchedAt[dbName] = fetchedAt;
                });
                return stats;
            })
            .finally(() => {
                delete this.remoteStatsInFlight[cacheKey];
            });

        return this.remoteStatsInFlight[cacheKey];
    },

    getRemoteStatsRefreshOrder() {
        const uniqueDatabaseNames = Array.from(new Set(this.databaseNames));

        return uniqueDatabaseNames.sort((firstName, secondName) => {
            const firstHasLocationSelector = Boolean(SyncManager.getLocationSelector(firstName));
            const secondHasLocationSelector = Boolean(SyncManager.getLocationSelector(secondName));

            if (firstHasLocationSelector !== secondHasLocationSelector) {
                return firstHasLocationSelector ? 1 : -1;
            }

            if (firstName === "patients_records") return 1;
            if (secondName === "patients_records") return -1;
            return 0;
        });
    },

    refreshRemoteStatsProgressively(remoteBaseUrl, options = {}, statsOptions = {}) {
        if (this.remoteStatsRefreshInFlight) {
            return this.remoteStatsRefreshInFlight;
        }

        const databaseNames = this.getRemoteStatsRefreshOrder();
        const parallelLimit = Math.min(this.getConfiguredParallelLimit(), statsOptions.parallelLimit || 2);

        console.log(`[DB] Starting progressive remote stats refresh for ${databaseNames.length} databases`, {
            parallelLimit,
        });

        this.remoteStatsRefreshInFlight = this.mapWithConcurrency(databaseNames, parallelLimit, async (dbName) => {
            await this.getStats(remoteBaseUrl, options, dbName, {
                forceRemote: false,
                throttleMs: 0,
                ...statsOptions,
            });
        })
            .catch((error) => {
                console.warn("[DB] Progressive remote stats refresh failed:", error);
            })
            .finally(() => {
                this.remoteStatsRefreshInFlight = null;
            });

        return this.remoteStatsRefreshInFlight;
    },

    async getStats(remoteBaseUrl, options = {}, databaseName = null, statsOptions = {}) {
        if (!this.lastRemoteStats) this.lastRemoteStats = {};
        if (!this.lastLocalStats) this.lastLocalStats = {};
        if (!this.remoteStatsFetchedAt) this.remoteStatsFetchedAt = {};
        if (!this.remoteStatsInFlight) this.remoteStatsInFlight = {};
        if (!this.remoteStatsRefreshInFlight) this.remoteStatsRefreshInFlight = null;
        if (!this.statsPublishedAt) this.statsPublishedAt = {};

        const statsKey = databaseName || "__all__";
        const throttleMs = statsOptions.throttleMs ?? (databaseName ? 5000 : 0);
        const now = Date.now();

        if (databaseName && !this.shouldTrackDatabase(databaseName)) {
            const skippedStats = this.getSkippedStatsForDatabase(databaseName);
            return {
                storageMode: this.getStorageMode(),
                local: { ...this.lastLocalStats, [databaseName]: skippedStats },
                remote: { ...this.lastRemoteStats, [databaseName]: skippedStats },
                updatedDatabase: databaseName,
                isPartialUpdate: true,
                skipped: true,
            };
        }

        if (databaseName && throttleMs > 0 && this.lastLocalStats?.[databaseName] && now - (this.statsPublishedAt[statsKey] || 0) < throttleMs) {
            return {
                storageMode: this.getStorageMode(),
                local: this.lastLocalStats,
                remote: this.lastRemoteStats,
                updatedDatabase: databaseName,
                isPartialUpdate: true,
                throttled: true,
            };
        }

        // Remote and local stats are fully independent — run them in parallel
        let [newRemoteStats, newLocalStats] = await Promise.all([
            statsOptions.skipRemote ? Promise.resolve({}) : this.getRemoteStatsWithCache(remoteBaseUrl, options, databaseName, statsOptions),
            this.getLocalStats(databaseName),
        ]);

        newRemoteStats = this.applyDeviceIdPoolRemoteTargets(newRemoteStats, databaseName);

        // Merge with existing stats to preserve other databases' information
        let finalRemoteStats = { ...this.lastRemoteStats, ...newRemoteStats };
        let finalLocalStats = { ...this.lastLocalStats, ...newLocalStats };

        // Store the current complete stats for future partial updates
        this.lastRemoteStats = finalRemoteStats;
        this.lastLocalStats = finalLocalStats;
        this.statsPublishedAt[statsKey] = Date.now();

        const modeInfo = this.getStorageMode();

        self.postMessage({
            type: "db_stats",
            storageMode: modeInfo,
            local: finalLocalStats,
            remote: finalRemoteStats,
            updatedDatabase: databaseName, // Include info about which DB was updated
            isPartialUpdate: !!databaseName, // Flag to indicate if this was a partial update
        });

        return {
            storageMode: modeInfo,
            local: finalLocalStats,
            remote: finalRemoteStats,
            ...(databaseName && { updatedDatabase: databaseName, isPartialUpdate: true }),
        };
    },

    autoCompactAll(_intervalHours = 1) {
        // Worker-driven periodic compaction disabled. On a 300k-doc DB,
        // compact() takes 5+ minutes and holds the IDB write queue the
        // whole time, freezing every search/read. Operators trigger it
        // intentionally via window.mahisCompactNow().
        console.log("[DB] Auto-compaction interval disabled (use window.mahisCompactNow() to compact on demand)");
    },
};
