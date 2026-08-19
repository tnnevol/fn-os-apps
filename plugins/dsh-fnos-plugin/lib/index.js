import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
import { request } from "node:http";
//#region src/fnos-api.ts
/** Minimal server-side client for the fnOS open API gateway. */
const FNOS_API_SOCKET = "/var/run/trim_open_gateway_apiscope.socket";
const FNOS_API_PATH = "/api/v1/trimapp";
const RESPONSE_LIMIT = 131072;
const REQUEST_TIMEOUT_MS = 1e4;
var FnOsApiError = class extends Error {
	apiCode;
	constructor(apiCode, message) {
		super(message);
		this.apiCode = apiCode;
		this.name = "FnOsApiError";
	}
};
function apiMessage(value) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 300) : "fnOS API request failed";
}
function requestId() {
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
/** Call one fnOS API without persisting or exposing TRIM_API_TOKEN. */
async function callFnOsApi(req, data = {}, options = {}) {
	const token = (options.token ?? process.env.TRIM_API_TOKEN)?.trim();
	if (token === void 0 || token.length === 0) throw new FnOsApiError(void 0, "fnOS API token is unavailable");
	const appName = options.appName?.trim() || process.env.TRIM_APPNAME?.trim() || "fn-deepseek-harness";
	const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
	const payload = JSON.stringify({
		reqId: requestId(),
		req,
		appName,
		data
	});
	const response = await new Promise((resolve, reject) => {
		const reqHandle = request({
			socketPath: options.socketPath ?? FNOS_API_SOCKET,
			path: FNOS_API_PATH,
			method: "POST",
			headers: {
				accept: "application/json",
				"content-type": "application/json",
				"content-length": Buffer.byteLength(payload),
				authorization: `Bearer ${token}`
			}
		}, (responseMessage) => {
			let body = "";
			let size = 0;
			responseMessage.setEncoding("utf8");
			responseMessage.on("data", (chunk) => {
				size += Buffer.byteLength(chunk);
				if (size <= RESPONSE_LIMIT) body += chunk;
			});
			responseMessage.on("end", () => {
				if (size > RESPONSE_LIMIT) {
					reject(new FnOsApiError(void 0, "fnOS API response is too large"));
					return;
				}
				resolve({
					statusCode: responseMessage.statusCode ?? 0,
					body
				});
			});
			responseMessage.on("error", reject);
		});
		reqHandle.setTimeout(timeoutMs, () => {
			reqHandle.destroy(/* @__PURE__ */ new Error("fnOS API request timed out"));
		});
		reqHandle.on("error", reject);
		reqHandle.end(payload);
	});
	if (response.statusCode < 200 || response.statusCode >= 300) throw new FnOsApiError(void 0, `fnOS API returned HTTP ${String(response.statusCode)}`);
	let envelope;
	try {
		envelope = JSON.parse(response.body);
	} catch {
		throw new FnOsApiError(void 0, "fnOS API returned invalid JSON");
	}
	const code = typeof envelope.code === "number" ? envelope.code : void 0;
	if (code !== 0) throw new FnOsApiError(code, apiMessage(envelope.msg));
	return envelope.data;
}
//#endregion
//#region src/authorized-directories-contract.ts
/** Browser/Host contract for fnOS shared-directory management. */
/** Settings namespace used to pair the Host namespace with the Client card. */
const FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE = "dsh-fnos-authorized-directories";
/** Same-origin route that lists the directories currently authorized for the app. */
const FNOS_AUTHORIZED_DIRECTORIES_PATH = "/plugins/dsh-fnos/authorized-directories";
/** Same-origin route that removes one application directory ACL. */
const FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH = "/plugins/dsh-fnos/authorized-directories/delete";
/** Same-origin route that converts internal fnOS paths to readable paths. */
const FNOS_PATH_CONVERSION_PATH = "/plugins/dsh-fnos/paths/convert";
//#endregion
//#region src/authorized-directories.ts
const BODY_LIMIT = 65536;
/** Paths removed during this process must not be reintroduced from a stale env snapshot. */
const removedAccessiblePaths = /* @__PURE__ */ new Set();
/** fnOS supplies user-authorized application paths through this variable. */
const FNOS_ACCESSIBLE_PATHS_ENV = "TRIM_DATA_ACCESSIBLE_PATHS";
/** fnOS supplies the application's declared shared data paths through this variable. */
const FNOS_DATA_SHARE_PATHS_ENV = "TRIM_DATA_SHARE_PATHS";
function header(req, name) {
	const value = req.headers[name];
	return Array.isArray(value) ? value[0] : value;
}
function firstForwarded(value) {
	return value?.split(",")[0]?.trim() || void 0;
}
function requestOrigin(req) {
	const host = firstForwarded(header(req, "x-forwarded-host")) ?? header(req, "host");
	if (host === void 0) return void 0;
	const proto = firstForwarded(header(req, "x-forwarded-proto")) ?? (req.socket.encrypted === true ? "https" : "http");
	try {
		return new URL(`${proto}://${host}`).origin;
	} catch {
		return;
	}
}
function normalizeOrigin(raw) {
	try {
		return new URL(raw).origin;
	} catch {
		return;
	}
}
function localPeer(req) {
	const remote = req.socket.remoteAddress;
	return remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
}
/** Accept the NAS gateway's same-origin requests, but reject cross-site calls. */
function trustedRequest(req) {
	if (header(req, "sec-fetch-site")?.trim().toLowerCase() === "cross-site") return false;
	const origin = header(req, "origin");
	if (origin !== void 0) return requestOrigin(req) === normalizeOrigin(origin);
	return localPeer(req);
}
function json(res, status, value) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(value));
}
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let body = "";
		let size = 0;
		let finished = false;
		req.setEncoding("utf8");
		req.on("data", (chunk) => {
			if (finished) return;
			size += Buffer.byteLength(chunk);
			if (size > BODY_LIMIT) {
				finished = true;
				reject(/* @__PURE__ */ new Error("request body is too large"));
				return;
			}
			body += chunk;
		});
		req.on("end", () => {
			if (finished) return;
			finished = true;
			try {
				resolve(JSON.parse(body));
			} catch {
				reject(/* @__PURE__ */ new Error("request body is not valid JSON"));
			}
		});
		req.on("error", (error) => {
			if (finished) return;
			finished = true;
			reject(error);
		});
	});
}
/** Normalize one fnOS volume path for display and exact delete matching. */
function normalizeAuthorizedPath(value) {
	if (typeof value !== "string") return void 0;
	const path = value.trim();
	if (path.length === 0 || !path.startsWith("/") || path.includes("\0")) return void 0;
	if (path === "/") return path;
	return path.replace(/\/+$/u, "");
}
/** Keep API order while removing malformed and duplicate paths. */
function normalizeAuthorizedPaths(value) {
	if (!Array.isArray(value)) return [];
	const paths = [];
	const seen = /* @__PURE__ */ new Set();
	for (const entry of value) {
		const path = normalizeAuthorizedPath(entry);
		if (path === void 0 || seen.has(path)) continue;
		seen.add(path);
		paths.push(path);
	}
	return paths;
}
/** Parse a fnOS colon-separated path environment variable. */
function splitPathEnvironment(value) {
	if (typeof value !== "string") return [];
	return value.split(":").map((value) => value.trim()).filter((value) => value.length > 0);
}
/** Read user-authorized paths from the lifecycle environment and de-duplicate them. */
function accessiblePathsFromEnvironment(env = process.env) {
	return normalizeAuthorizedPaths(splitPathEnvironment(env[FNOS_ACCESSIBLE_PATHS_ENV]));
}
/** Read declared application data shares for display and de-duplicate them. */
function dataSharePathsFromEnvironment(env = process.env) {
	return normalizeAuthorizedPaths(splitPathEnvironment(env[FNOS_DATA_SHARE_PATHS_ENV]));
}
/** Combine path sources without changing the first-seen order. */
function mergeAuthorizedPaths(...values) {
	return normalizeAuthorizedPaths(values.flatMap((value) => Array.isArray(value) ? value : splitPathEnvironment(value)));
}
/** Keep a just-removed ACL out of the process-local merged configuration. */
function markAuthorizedPathRemoved(value) {
	const path = normalizeAuthorizedPath(value);
	if (path !== void 0) removedAccessiblePaths.add(path);
}
function requestLanguage(req) {
	const value = header(req, "accept-language")?.split(",")[0]?.trim().replace(/_/gu, "-");
	if (value !== void 0 && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/u.test(value)) return value;
	return "en-US";
}
function readableFallbackPath(path, language) {
	const volume = /^\/vol(\d+)(?:\/(.*))?$/u.exec(path);
	if (volume !== null) {
		const prefix = language.toLowerCase().startsWith("zh") ? `存储空间${volume[1]}` : `Storage ${volume[1]}`;
		return volume[2] === void 0 || volume[2].length === 0 ? prefix : `${prefix}/${volume[2]}`;
	}
	if (path === "/") return language.toLowerCase().startsWith("zh") ? "根目录" : "Root";
	return path;
}
function convertedPathMap(value) {
	const result = /* @__PURE__ */ new Map();
	if (typeof value !== "object" || value === null || Array.isArray(value)) return result;
	const envelope = value;
	const nested = typeof envelope.data === "object" && envelope.data !== null && !Array.isArray(envelope.data) ? envelope.data : void 0;
	const entries = Array.isArray(envelope.result) ? envelope.result : nested?.result;
	if (!Array.isArray(entries)) return result;
	for (const entry of entries) {
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
		const path = normalizeAuthorizedPath(entry.path);
		const rawSemanticPath = entry.semanticPath;
		const semanticPath = typeof rawSemanticPath === "string" ? rawSemanticPath.trim() : "";
		if (path !== void 0 && semanticPath.length > 0 && semanticPath !== path) result.set(path, semanticPath);
	}
	return result;
}
/** Pair internal paths with fnOS semantic paths, falling back per entry. */
async function convertPathsForDisplay(pathsValue, language = "en-US") {
	const paths = normalizeAuthorizedPaths(pathsValue);
	if (paths.length === 0) return [];
	let convertedValue;
	try {
		convertedValue = await callFnOsApi("trim.file.convertPath", {
			path: paths,
			language
		});
	} catch (error) {
		console.warn("[dsh-fnos] unable to convert selected fnOS paths", error);
	}
	const converted = convertedPathMap(convertedValue);
	return paths.map((path) => ({
		path,
		semanticPath: converted.get(path) ?? readableFallbackPath(path, language)
	}));
}
/**
* Query the current ACL. The environment is a fallback for hosts that expose
* the ACL to the app process but temporarily reject the read API; a successful
* API response remains authoritative so a just-removed path is not resurrected
* from a stale process environment.
*/
async function loadAuthorizedDirectoryPaths() {
	const environmentPaths = accessiblePathsFromEnvironment();
	try {
		const apiPaths = normalizeAuthorizedPaths((await callFnOsApi("trim.file.getSharedAccessibleFolders"))?.paths);
		for (const path of apiPaths) removedAccessiblePaths.delete(path);
		return mergeAuthorizedPaths(apiPaths, environmentPaths).filter((path) => !removedAccessiblePaths.has(path));
	} catch (error) {
		if (environmentPaths.length === 0) throw error;
		console.warn("[dsh-fnos] using TRIM_DATA_ACCESSIBLE_PATHS because the fnOS ACL query failed");
		return environmentPaths.filter((path) => !removedAccessiblePaths.has(path));
	}
}
async function convertDirectories(paths, language, readOnlyPaths = []) {
	const readOnly = new Set(normalizeAuthorizedPaths(readOnlyPaths));
	return (await convertPathsForDisplay(paths, language)).map((entry) => ({
		...entry,
		removable: !readOnly.has(entry.path)
	}));
}
async function loadAuthorizedDirectories(req) {
	const readOnlyPaths = dataSharePathsFromEnvironment();
	let accessiblePaths = [];
	try {
		accessiblePaths = await loadAuthorizedDirectoryPaths();
	} catch (error) {
		if (readOnlyPaths.length === 0) throw error;
		console.warn("[dsh-fnos] using TRIM_DATA_SHARE_PATHS because the fnOS ACL query failed", error);
	}
	return convertDirectories(mergeAuthorizedPaths(accessiblePaths, readOnlyPaths), requestLanguage(req), readOnlyPaths);
}
function errorResponse(res, error) {
	if (error instanceof FnOsApiError && error.apiCode === 1) {
		json(res, 403, { error: "fnos-authorized-directory-permission-denied" });
		return;
	}
	json(res, 502, { error: "fnos-authorized-directory-request-failed" });
}
function deletePath(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	return normalizeAuthorizedPath(value.path);
}
function conversionPaths(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const valuePaths = value.paths;
	if (!Array.isArray(valuePaths)) return void 0;
	return normalizeAuthorizedPaths(valuePaths);
}
/** Register list/delete routes only on the DSH Web profile. */
function registerAuthorizedDirectoryRoutes(ctx) {
	ctx.effect(() => {
		const authorize = (req, res) => {
			if (trustedRequest(req)) return true;
			json(res, 403, { error: "remote-web-origin-not-trusted" });
			return false;
		};
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: FNOS_AUTHORIZED_DIRECTORIES_PATH,
				handler: async (req, res) => {
					if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
					if (!authorize(req, res)) return;
					try {
						json(res, 200, { directories: await loadAuthorizedDirectories(req) });
					} catch (error) {
						errorResponse(res, error);
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!authorize(req, res)) return;
					try {
						const path = deletePath(await readJsonBody(req));
						if (path === void 0) return json(res, 400, { error: "invalid-authorized-directory-path" });
						const directory = (await loadAuthorizedDirectories(req)).find((candidate) => candidate.path === path);
						if (directory === void 0) return json(res, 409, { error: "authorized-directory-not-found" });
						if (!directory.removable) return json(res, 409, { error: "authorized-directory-not-removable" });
						if ((await callFnOsApi("trim.file.delSharedAccessibleFolder", { path }))?.suc === false) return json(res, 502, { error: "fnos-authorized-directory-request-failed" });
						markAuthorizedPathRemoved(path);
						json(res, 200, { ok: true });
					} catch (error) {
						errorResponse(res, error);
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: FNOS_PATH_CONVERSION_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!authorize(req, res)) return;
					try {
						const paths = conversionPaths(await readJsonBody(req));
						if (paths === void 0) return json(res, 400, { error: "invalid-fnos-paths" });
						json(res, 200, { paths: await convertPathsForDisplay(paths, requestLanguage(req)) });
					} catch (error) {
						errorResponse(res, error);
					}
				}
			})
		];
		return () => {
			for (const dispose of routes) dispose();
		};
	}, "dsh-fnos: authorized directory routes");
}
//#endregion
//#region src/index.ts
/** Stable Host bundle name. */
const name = "@tnnevol/dsh-fnos";
/** Settings are used to make the read-only fnOS card discoverable. */
const FnosSettingsSchema = z.object({});
const FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NS = settingsNamespace(FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE);
/** Host services required by the fnOS settings namespace and Web routes. */
const inject = ["webServer", "settings"];
function apply(ctx) {
	ctx.settings.register(FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NS, FnosSettingsSchema);
	registerAuthorizedDirectoryRoutes(ctx);
}
//#endregion
export { FNOS_ACCESSIBLE_PATHS_ENV, FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH, FNOS_AUTHORIZED_DIRECTORIES_PATH, FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE, FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NS, FNOS_DATA_SHARE_PATHS_ENV, FNOS_PATH_CONVERSION_PATH, FnosSettingsSchema, accessiblePathsFromEnvironment, apply, convertPathsForDisplay, dataSharePathsFromEnvironment, inject, markAuthorizedPathRemoved, mergeAuthorizedPaths, name, normalizeAuthorizedPath, normalizeAuthorizedPaths, splitPathEnvironment };
