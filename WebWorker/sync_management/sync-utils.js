/**
 * Sync utility functions
 */
const SYNC_REMOTE_DB_ENSURE_TIMEOUT_MS = 30000;

const SyncUtils = {
    buildAuthHeaders(options = {}) {
        if (!options?.username && !options?.password) return {};

        return {
            Authorization: `Basic ${btoa(`${options.username || ""}:${options.password || ""}`)}`,
        };
    },

    getRemoteDatabaseUrl(remoteUrl, dbName) {
        return `${String(remoteUrl || "").replace(/\/+$/, "")}/${encodeURIComponent(dbName)}`;
    },

    async fetchWithTimeout(url, options = {}, timeoutMs = SYNC_REMOTE_DB_ENSURE_TIMEOUT_MS) {
        if (!timeoutMs || typeof AbortController === "undefined") {
            return fetch(url, options);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
    },

    async readResponseBody(response) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    },

    buildRemoteDatabaseError(action, dbName, response, body = null) {
        const reason = body?.reason || body?.error || response.statusText || `HTTP ${response.status}`;
        const error = new Error(`${action} failed for ${dbName}: ${reason}`);
        error.status = response.status;
        error.name = body?.error || response.statusText || "remote_database_error";
        error.reason = body?.reason || "";
        return error;
    },

    isMissingDatabaseError(error) {
        const message = `${error?.message || ""} ${error?.reason || ""}`.toLowerCase();
        return error?.status === 404 && (error?.name === "not_found" || message.includes("database does not exist"));
    },

    async clearSyncCheckpoints(localDB, dbName) {
        try {
            const allDocs = await localDB.allDocs({
                startkey: "_local/",
                endkey: "_local0",
                include_docs: true,
            });

            const checkpointDocs = allDocs.rows.filter((row) => row.id.includes("_local/")).map((row) => ({ ...row.doc, _deleted: true }));

            if (checkpointDocs.length > 0) {
                await localDB.bulkDocs(checkpointDocs);
                console.log(`[SYNC] Cleared ${checkpointDocs.length} checkpoint docs for ${dbName}`);
            }
        } catch (error) {
            console.warn(`[SYNC] Failed to clear checkpoints for ${dbName}:`, error);
        }
    },

    async ensureDatabaseExists(remoteUrl, dbName, options = {}) {
        const dbUrl = this.getRemoteDatabaseUrl(remoteUrl, dbName);
        const authHeaders = this.buildAuthHeaders(options);

        try {
            const infoResponse = await this.fetchWithTimeout(dbUrl, { headers: authHeaders });

            if (infoResponse.ok) {
                console.log(`[SYNC] Remote database ${dbName} exists`);
            } else if (infoResponse.status === 404) {
                console.warn(`[SYNC] Remote database ${dbName} is missing; creating it before sync`);

                const createResponse = await this.fetchWithTimeout(dbUrl, {
                    method: "PUT",
                    headers: authHeaders,
                });

                if (!createResponse.ok && createResponse.status !== 412) {
                    const body = await this.readResponseBody(createResponse);
                    throw this.buildRemoteDatabaseError("Remote database create", dbName, createResponse, body);
                }

                console.log(`[SYNC] Remote database ${dbName} ${createResponse.status === 412 ? "already existed" : "created"}`);
            } else {
                const body = await this.readResponseBody(infoResponse);
                throw this.buildRemoteDatabaseError("Remote database check", dbName, infoResponse, body);
            }

            const remoteDB = new self.PouchDB(dbUrl, {
                skip_setup: true,
                auth: options,
                ajax: { timeout: SYNC_REMOTE_DB_ENSURE_TIMEOUT_MS },
            });

            const localDB = DatabaseManager.getDatabaseInstance(dbName);
            const localInfo = await localDB.info();
            console.log(`[SYNC] Local database ${dbName} verified - docs: ${localInfo.doc_count}`);

            return remoteDB;
        } catch (error) {
            console.error(`[SYNC] Failed to ensure database ${dbName} exists:`, error);
            throw error;
        }
    },
};
