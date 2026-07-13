import { L as LocalForageServiceInstance } from "./LocalForageService.js";

class DataStore {
    constructor() {
        const savedCreds = localStorage.getItem("memisCredentials");
        this.defaultCredentials = savedCreds ? JSON.parse(savedCreds) : null;
        this.baseUrl = `${"https://memis.health.gov.mw/api-testing/memis"}`;
    }
    buildUrl(endpoint) {
        return `${this.baseUrl}/${endpoint}`;
    }
    async getAuth() {
        const { username, password } = this.defaultCredentials || {};
        if (!username || !password) {
            throw new Error("Authentication credentials are missing");
        }
        return { username, password };
    }
    async getHeaders(credentials, data) {
        const { username, password } = credentials || (await this.getAuth());
        const encoded = btoa(`${username}:${password}`);
        const headers = {
            Authorization: `Basic ${encoded}`,
        };
        if (!(data instanceof FormData)) {
            headers["Content-Type"] = "application/json";
        }
        return headers;
    }
    async switchUser(credentials) {
        try {
            const { username, password } = credentials;
            const encodedCredentials = btoa(`${username}:${password}`);
            const url = this.buildUrl(
                "me?fields=id,username,surname,teiSearchOrganisationUnits,firstName,userGroups[id,name],userRoles[id,name],authorities[*],dataViewOrganisationUnits,organisationUnits[id,name,level,parent[id,name,level,parent[id,name,level]]]"
            );
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Authorization: `Basic ${encodedCredentials}`,
                    "Content-Type": "application/json",
                },
            });
            if (response.ok && response?.headers.get("content-type").includes("application/json;charset=UTF-8")) {
                const data = await response.json();
                this.defaultCredentials = credentials;
                return {
                    status: response?.status,
                    statusText: response?.statusText,
                    data,
                };
            } else {
                return { ...response };
            }
        } catch (error) {
            console.error("Switch user error:", error);
            return {
                status: error?.status || 500,
                message: error?.message || "Login failed",
            };
        }
    }
    async createAuthConfig({ data = {}, params = {} } = {}) {
        const auth = await this.getAuth();
        const headers = await this.getHeaders(auth, data);
        return {
            headers,
            params: params || {},
        };
    }
    async request(method, endpoint, data = {}, options = {}) {
        const { params = {} } = options;
        const config = await this.createAuthConfig({ data, params });
        let url = new URL(this.buildUrl(endpoint));
        Object.keys(config.params).forEach((key) => url.searchParams.append(key, config.params[key]));
        const upperMethod = method.toUpperCase();
        const fetchOptions = {
            method: upperMethod,
            headers: config.headers,
        };
        if (!["GET", "HEAD"].includes(upperMethod)) {
            fetchOptions.body = data instanceof FormData ? data : JSON.stringify(data || {});
        }
        try {
            const response = await fetch(url.toString(), fetchOptions);
            const status = response.status;
            const statusText = response.statusText;
            const contentType = response.headers.get("content-type") || "";
            if (!response.ok) {
                const errorText = await response.text();
                console.log({
                    status,
                    statusText,
                    message: errorText,
                });
                return { status, statusText, message: errorText };
            }
            if (status === 204 || response.headers.get("content-length") === "0") {
                return { status, statusText, data: null };
            }
            if (contentType.includes("application/json")) {
                const data2 = await response.json();
                return { status, statusText, data: data2 };
            }
            if (contentType.includes("application/octet-stream") || contentType.includes("application/pdf") || contentType.startsWith("image/")) {
                const data2 = await response.blob();
                return { status, statusText, data: data2 };
            }
            const text = await response.text();
            return { status, statusText, data: text };
        } catch (error) {
            console.error("HTTP Request error:", error);
            return {
                status: error?.status || 500,
                message: error?.message || "Request failed",
            };
        }
    }
    async get(endpoint, params = {}, options = {}) {
        return this.request("GET", endpoint, {}, { ...options, params });
    }
    async post(endpoint, data = {}, options = {}) {
        return this.request("POST", endpoint, data, options);
    }
    async put(endpoint, data = {}, options = {}) {
        return this.request("PUT", endpoint, data, options);
    }
    async patch(endpoint, data = {}, options = {}) {
        return this.request("PATCH", endpoint, data, options);
    }
    async delete(endpoint, options = {}) {
        return this.request("DELETE", endpoint, {}, options);
    }
    async login(endpoint, credentials, payload) {
        try {
            const headers = await this.getHeaders(credentials, payload);
            const url = this.buildUrl(endpoint);
            const response = await fetch(url, {
                method: "POST",
                headers,
                body: payload instanceof FormData ? payload : JSON.stringify(payload || {}),
            });
            const data = await response.json();
            if (!response.ok) throw data;
            return data;
        } catch (error) {
            console.error("Login error:", error);
            return {
                status: error?.status || 500,
                message: error?.message || "Login failed",
            };
        }
    }
    async downloadFile(endpoint) {
        try {
            const auth = await this.getAuth();
            const { username, password } = auth;
            const encodedCredentials = btoa(`${username}:${password}`);
            const url = this.buildUrl(endpoint);
            const response = await fetch(url, {
                method: "GET",
                headers: { Authorization: `Basic ${encodedCredentials}` },
            });
            if (!response.ok) throw new Error("File download failed");
            return await response.blob();
        } catch (error) {
            console.error("File download error:", error);
            throw error;
        }
    }
}
class QRConfigService extends DataStore {
    async getJsonObject(path) {
        return this.get(path);
    }
    async getQrConfig(programId) {
        try {
            let config = await LocalForageServiceInstance.getItem("dataStore", "dataStore");
            config = config?.qrCodesConfigurations;
            const qr = config?.configurations?.find((q) => q?.source?.programId === programId);
            return qr || null;
        } catch (error) {
            console.error("QR config fetch error:", error);
            return null;
        }
    }
    extractAttributeValues(attributes = [], requestedAttributes = {}) {
        try {
            const result = Object.keys(requestedAttributes).reduce((acc, attributeId) => {
                const attribute = attributes.find((attr) => attr.attribute === attributeId);
                acc[attributeId] = attribute?.value || null;
                return acc;
            }, {});
            return Object.keys(result).map((k) => ({
                [requestedAttributes[k].name]: result[k],
            }));
        } catch (error) {
            console.error("Attribute extraction error:", error);
            return [];
        }
    }
    getSearchKeyValue(attributes = [], searchKeyId) {
        try {
            if (!searchKeyId) return null;
            const searchAttribute = attributes.find((attr) => attr.attribute === searchKeyId);
            return searchAttribute?.value || null;
        } catch (error) {
            console.error("Search key extraction error:", error);
            return null;
        }
    }
    buildQrPayload({ program, tei, orgUnit, config }) {
        try {
            if (!program?.id || !tei?.trackedEntity || !config) return null;
            const attributes = tei.attributes || [];
            const requestedAttributes = config.source?.values || {};
            const jsonData = {
                data: this.extractAttributeValues(attributes, requestedAttributes),
                Facility: orgUnit ? orgUnit.name : null,
                GeneratedAt: /* @__PURE__ */ new Date().toISOString(),
            };
            let plainText = `Facility: ${jsonData.Facility}
Generated At: ${jsonData.GeneratedAt}
Equipment Details:
`;
            jsonData.data.forEach((item) => {
                const [key, value] = Object.entries(item)[0];
                plainText += `${key.trim()}: ${value}
`;
            });
            return plainText;
        } catch (error) {
            console.error("QR payload build error:", error);
            return null;
        }
    }
}
const dataStore = new DataStore();
const qrConfigService = new QRConfigService();

export { DataStore, QRConfigService, dataStore as default, qrConfigService };
