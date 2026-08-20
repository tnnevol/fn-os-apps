import { a as CODEX_PROVIDER, i as CODEX_AUTH_FILENAME, n as loginCodex, o as CodexCredentialStore, r as logoutCodex, s as codexAuthPath, t as codexAuthStatus } from "./auth-DQ2F4vc6.js";
import { CODEX_AUTH_LOGIN_PATH, CODEX_AUTH_LOGOUT_PATH, CODEX_AUTH_SETTINGS_NAMESPACE, CODEX_AUTH_SETTINGS_PATH, CODEX_AUTH_STATUS_PATH, CODEX_USAGE_PATH } from "./auth-paths.js";
import { createModels } from "@earendil-works/pi-ai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { basename } from "node:path";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import z from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { AttachmentId } from "@deepseek-ai/dsh-attachment";
import { createUserMessage, resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
//#region src/usage.ts
/** Read-only Codex account quota information for the local settings card. */
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_USAGE_TIMEOUT_MS = 1e4;
function record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function number(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
	if (typeof value !== "string" || value.trim() === "") return void 0;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : void 0;
}
function boolean(value) {
	return typeof value === "boolean" ? value : void 0;
}
function string(value) {
	if (typeof value === "string" && value.length > 0) return value;
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
}
function percentage(value) {
	return Math.max(0, Math.min(100, value));
}
function window(value) {
	const source = record(value);
	if (source === void 0) return void 0;
	const result = {};
	const usedPercent = number(source["used_percent"]);
	const explicitRemainingPercent = number(source["remaining_percent"]);
	const limitWindowSeconds = number(source["limit_window_seconds"]);
	const resetAfterSeconds = number(source["reset_after_seconds"]);
	const resetAt = number(source["reset_at"]);
	if (explicitRemainingPercent !== void 0) result.remainingPercent = percentage(explicitRemainingPercent);
	else if (usedPercent !== void 0) result.remainingPercent = percentage(100 - usedPercent);
	if (limitWindowSeconds !== void 0) result.limitWindowSeconds = limitWindowSeconds;
	if (resetAfterSeconds !== void 0) result.resetAfterSeconds = resetAfterSeconds;
	if (resetAt !== void 0) result.resetAt = resetAt;
	return Object.keys(result).length > 0 ? result : void 0;
}
function credits(value) {
	const source = record(value);
	if (source === void 0) return void 0;
	const result = {};
	const hasCredits = boolean(source["has_credits"]);
	const unlimited = boolean(source["unlimited"]);
	const balance = string(source["balance"]);
	if (hasCredits !== void 0) result.hasCredits = hasCredits;
	if (unlimited !== void 0) result.unlimited = unlimited;
	if (balance !== void 0) result.balance = balance;
	return Object.keys(result).length > 0 ? result : void 0;
}
/** Normalize the evolving private WHAM response into a small UI-safe shape. */
function normalizeCodexUsagePayload(value) {
	const source = record(value);
	if (source === void 0) throw new Error("Codex usage response was not an object");
	const rateLimit = record(source["rate_limit"]);
	const result = {};
	const planType = string(source["plan_type"]);
	const allowed = boolean(rateLimit?.["allowed"]);
	const limitReached = boolean(rateLimit?.["limit_reached"]);
	const primaryWindow = window(rateLimit?.["primary_window"]);
	const secondaryWindow = window(rateLimit?.["secondary_window"]);
	const quota = credits(source["credits"]);
	if (planType !== void 0) result.planType = planType;
	if (allowed !== void 0) result.allowed = allowed;
	if (limitReached !== void 0) result.limitReached = limitReached;
	if (primaryWindow !== void 0) result.primaryWindow = primaryWindow;
	if (secondaryWindow !== void 0) result.secondaryWindow = secondaryWindow;
	if (quota !== void 0) result.credits = quota;
	return result;
}
function accessToken(auth) {
	return typeof auth?.apiKey === "string" && auth.apiKey.length > 0 ? auth.apiKey : void 0;
}
function accountId(credential) {
	if (credential?.type !== "oauth") return void 0;
	return typeof credential.accountId === "string" && credential.accountId.length > 0 ? credential.accountId : void 0;
}
/** Resolves OAuth (including refresh) before making the quota request. */
var CodexUsageService = class {
	store;
	models;
	operation;
	constructor(store) {
		this.store = store;
		this.models = createModels({ credentials: store });
		this.models.setProvider(openaiCodexProvider());
	}
	async read() {
		if (this.operation !== void 0) return this.operation;
		const operation = this.readNow();
		this.operation = operation;
		try {
			return await operation;
		} finally {
			if (this.operation === operation) this.operation = void 0;
		}
	}
	async readNow() {
		const token = accessToken((await this.models.getAuth(CODEX_PROVIDER))?.auth);
		if (token === void 0) return void 0;
		const account = accountId(await this.store.read(CODEX_PROVIDER));
		if (account === void 0) return void 0;
		const controller = new AbortController();
		const timer = setTimeout(() => {
			controller.abort();
		}, CODEX_USAGE_TIMEOUT_MS);
		try {
			const response = await fetch(CODEX_USAGE_URL, {
				method: "GET",
				headers: {
					accept: "application/json",
					authorization: `Bearer ${token}`,
					"ChatGPT-Account-Id": account,
					"user-agent": "dsh-codex-auth-plugin"
				},
				signal: controller.signal
			});
			if (!response.ok) throw new Error(`Codex usage request failed with status ${String(response.status)}`);
			return normalizeCodexUsagePayload(await response.json());
		} finally {
			clearTimeout(timer);
		}
	}
};
//#endregion
//#region src/settings-contract.ts
const DEFAULT_CODEX_AUTH_SETTINGS = Object.freeze({
	enableImageTool: false,
	enableImageUpload: false
});
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Narrow the settings wire payload before it enters React state. */
function decodeCodexAuthSettings(value) {
	if (!isRecord(value) || typeof value["enableImageTool"] !== "boolean") return void 0;
	return {
		enableImageTool: value["enableImageTool"],
		enableImageUpload: typeof value["enableImageUpload"] === "boolean" ? value["enableImageUpload"] : DEFAULT_CODEX_AUTH_SETTINGS.enableImageUpload
	};
}
//#endregion
//#region src/auth-routes.ts
const CODEX_AUTH_URL_TIMEOUT_MS = 3e4;
const REMOTE_WEB_ORIGIN_NOT_TRUSTED = "remote-web-origin-not-trusted";
const CODEX_USAGE_UNAVAILABLE = "codex-usage-unavailable";
const CODEX_SETTINGS_INVALID = "codex-settings-invalid";
const CODEX_SETTINGS_BODY_LIMIT = 8192;
function signedInStatus(expiresAt) {
	return expiresAt === void 0 ? { status: "signed-in" } : {
		status: "signed-in",
		expiresAt
	};
}
function safeMessage(error) {
	return (error instanceof Error ? error.message : String(error)).replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted token]").replace(/(\b(?:code|token|refresh_token|access_token)=)[^&\s]+/giu, "$1[redacted]").slice(0, 1e3);
}
function waitForPromptAbort(prompt) {
	const signal = prompt.signal;
	if (signal === void 0) return new Promise(() => {});
	if (signal.aborted) return Promise.reject(signal.reason);
	return new Promise((_resolve, reject) => {
		signal.addEventListener("abort", () => {
			reject(signal.reason);
		}, { once: true });
	});
}
/** Owns one device-code login operation and prevents duplicate auth requests. */
var CodexWebAuth = class {
	store;
	challengeTimeoutMs;
	mirror;
	state = { status: "signed-out" };
	operation;
	cancellation;
	challenge;
	challengeWaiters = [];
	challengeTimer;
	constructor(store, challengeTimeoutMs = CODEX_AUTH_URL_TIMEOUT_MS, mirror) {
		this.store = store;
		this.challengeTimeoutMs = challengeTimeoutMs;
		this.mirror = mirror;
		if (!Number.isFinite(challengeTimeoutMs) || challengeTimeoutMs <= 0) throw new TypeError("Codex auth URL timeout must be a positive finite number");
	}
	async status() {
		if (this.operation !== void 0) return this.state;
		if (this.state.status === "error") return this.state;
		const stored = await codexAuthStatus(this.store);
		if (stored.authenticated) {
			await this.mirror?.sync();
			return signedInStatus(stored.expiresAt);
		}
		await this.mirror?.clear();
		return { status: "signed-out" };
	}
	async signIn() {
		if (this.operation === void 0) this.start();
		if (this.challenge !== void 0) return this.challenge;
		return new Promise((resolve, reject) => {
			this.challengeWaiters.push({
				resolve,
				reject
			});
		});
	}
	async signOut() {
		this.cancelSignIn(/* @__PURE__ */ new Error("Codex sign-in cancelled"));
		await this.operation?.catch(() => void 0);
		await logoutCodex(this.store);
		await this.mirror?.clear();
		this.challenge = void 0;
		this.state = { status: "signed-out" };
	}
	async dispose() {
		this.cancelSignIn(/* @__PURE__ */ new Error("Codex auth plugin disposed"));
		await this.operation?.catch(() => void 0);
	}
	start() {
		const cancellation = new AbortController();
		this.cancellation = cancellation;
		this.challenge = void 0;
		this.state = { status: "signing-in" };
		this.challengeTimer = setTimeout(() => {
			this.cancelSignIn(/* @__PURE__ */ new Error(`Codex did not provide an authorization code within ${String(this.challengeTimeoutMs)}ms`));
		}, this.challengeTimeoutMs);
		this.challengeTimer.unref();
		this.operation = loginCodex({
			signal: cancellation.signal,
			prompt: (prompt) => {
				if (prompt.type === "select") return Promise.resolve("device_code");
				return waitForPromptAbort(prompt);
			},
			notify: (event) => {
				this.onEvent(event);
			}
		}, this.store).then(async () => {
			if (this.challenge === void 0) {
				const error = /* @__PURE__ */ new Error("Codex sign-in finished without an authorization code");
				this.rejectChallenge(error);
				this.state = {
					status: "error",
					message: safeMessage(error)
				};
				return;
			}
			const stored = await codexAuthStatus(this.store);
			if (stored.authenticated) await this.mirror?.sync();
			this.state = stored.authenticated ? signedInStatus(stored.expiresAt) : { status: "signed-out" };
		}, (error) => {
			this.rejectChallenge(error);
			this.state = {
				status: "error",
				message: safeMessage(error)
			};
		}).finally(() => {
			this.clearChallengeTimer();
			this.operation = void 0;
			this.cancellation = void 0;
		});
	}
	onEvent(event) {
		if (event.type !== "device_code") return;
		let url;
		try {
			url = new URL(event.verificationUri);
		} catch {
			this.cancelSignIn(/* @__PURE__ */ new Error("OpenAI returned an invalid Codex authorization URL"));
			return;
		}
		if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
			this.cancelSignIn(/* @__PURE__ */ new Error("OpenAI returned an unsafe Codex authorization URL"));
			return;
		}
		if (event.userCode.trim().length === 0) {
			this.cancelSignIn(/* @__PURE__ */ new Error("OpenAI returned an empty Codex authorization code"));
			return;
		}
		this.challenge = {
			type: "device_code",
			userCode: event.userCode,
			verificationUri: event.verificationUri,
			...event.intervalSeconds === void 0 ? {} : { intervalSeconds: event.intervalSeconds },
			...event.expiresInSeconds === void 0 ? {} : { expiresInSeconds: event.expiresInSeconds }
		};
		this.clearChallengeTimer();
		for (const waiter of this.challengeWaiters.splice(0)) waiter.resolve(this.challenge);
	}
	rejectChallenge(error) {
		this.clearChallengeTimer();
		for (const waiter of this.challengeWaiters.splice(0)) waiter.reject(error);
	}
	clearChallengeTimer() {
		if (this.challengeTimer === void 0) return;
		clearTimeout(this.challengeTimer);
		this.challengeTimer = void 0;
	}
	cancelSignIn(error) {
		this.rejectChallenge(error);
		this.cancellation?.abort(error);
	}
};
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
/** Protect mutating routes while allowing the NAS app's loopback proxy. */
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
			if (size > CODEX_SETTINGS_BODY_LIMIT) {
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
function decodeSettingsWrite(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const record = value;
	if (typeof record["enableImageTool"] !== "boolean" || typeof record["enableImageUpload"] !== "boolean") return;
	return decodeCodexAuthSettings(record);
}
/** Register the plugin-owned settings endpoint for browsers opened through a NAS authority. */
function registerCodexSettingsRoute(ctx, settings) {
	ctx.effect(() => {
		const authorize = (req, res) => {
			if (trustedRequest(req)) return true;
			json(res, 403, { error: REMOTE_WEB_ORIGIN_NOT_TRUSTED });
			return false;
		};
		return ctx.webServer.register({
			kind: "exact",
			path: CODEX_AUTH_SETTINGS_PATH,
			handler: async (req, res) => {
				if (req.method !== "GET" && req.method !== "PUT") return json(res, 405, { error: "method not allowed" });
				if (!authorize(req, res)) return;
				if (req.method === "GET") return json(res, 200, settings.get());
				try {
					const next = decodeSettingsWrite(await readJsonBody(req));
					if (next === void 0) return json(res, 400, { error: CODEX_SETTINGS_INVALID });
					await settings.update(next);
					json(res, 200, settings.get());
				} catch (error) {
					json(res, 400, { error: safeMessage(error) });
				}
			}
		});
	}, "dsh-codex-auth-plugin: remote settings route");
}
/** Register the auth endpoints when the DSH Web server is available. */
function registerCodexAuthRoutes(ctx, store, mirror) {
	const auth = new CodexWebAuth(store, CODEX_AUTH_URL_TIMEOUT_MS, mirror);
	const usage = new CodexUsageService(store);
	ctx.effect(() => {
		const authorize = (req, res) => {
			if (trustedRequest(req)) return true;
			json(res, 403, { error: REMOTE_WEB_ORIGIN_NOT_TRUSTED });
			return false;
		};
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: CODEX_AUTH_STATUS_PATH,
				handler: async (req, res) => {
					if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
					if (!authorize(req, res)) return;
					try {
						json(res, 200, await auth.status());
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: CODEX_AUTH_LOGIN_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!authorize(req, res)) return;
					try {
						json(res, 200, await auth.signIn());
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: CODEX_AUTH_LOGOUT_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!authorize(req, res)) return;
					try {
						await auth.signOut();
						json(res, 200, { ok: true });
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: CODEX_USAGE_PATH,
				handler: async (req, res) => {
					if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
					if (!authorize(req, res)) return;
					try {
						const value = await usage.read();
						if (value === void 0) return json(res, 401, { error: "not-signed-in" });
						json(res, 200, value);
					} catch {
						json(res, 502, { error: CODEX_USAGE_UNAVAILABLE });
					}
				}
			})
		];
		return async () => {
			for (const dispose of routes) dispose();
			await auth.dispose();
		};
	}, "dsh-codex-auth-plugin: Web OAuth routes");
}
//#endregion
//#region src/credential-mirror.ts
/** Bridge the plugin-owned OAuth credential into dsh's generic LLM seam. */
/** Credential reference exposed to the official `llm-pi-ai` model settings UI. */
const CODEX_API_KEY_ENV = "OPENAI_CODEX_AUTH_TOKEN";
const CODEX_API_KEY_REF = credentialRef(CODEX_API_KEY_ENV);
/**
* Makes the plugin-owned OAuth token visible to the generic dsh adapter.
*
* `llm-pi-ai` deliberately resolves named credentials through `ctx.credentials`
* on every request. The OAuth document remains the source of truth; this class
* only mirrors the short-lived access token so the official Models page can
* show its configured state and the generic adapter can send Codex requests.
*/
var CodexCredentialMirror = class {
	credentials;
	store;
	models;
	operation;
	constructor(credentials, store) {
		this.credentials = credentials;
		this.store = store;
		this.models = createModels({ credentials: this.store });
		this.models.setProvider(openaiCodexProvider());
	}
	/** Refresh OAuth when needed, then update the generic dsh credential seam. */
	async sync() {
		if (this.operation !== void 0) return this.operation;
		const operation = this.syncNow();
		this.operation = operation;
		try {
			await operation;
		} finally {
			if (this.operation === operation) this.operation = void 0;
		}
	}
	/** Remove the mirrored token after the plugin-owned account signs out. */
	async clear() {
		await this.operation?.catch(() => void 0);
		await this.credentials.unset(CODEX_API_KEY_REF);
	}
	async syncNow() {
		const accessToken = (await this.models.getAuth(CODEX_PROVIDER))?.auth.apiKey;
		if (accessToken !== void 0 && accessToken.length > 0) {
			await this.credentials.set(CODEX_API_KEY_REF, accessToken);
			return;
		}
		await this.credentials.unset(CODEX_API_KEY_REF);
	}
};
//#endregion
//#region src/settings.ts
/** Host settings registration that makes the standalone auth card discoverable. */
/** Branded namespace used by the Host settings service. */
const CODEX_AUTH_SETTINGS_NS = settingsNamespace(CODEX_AUTH_SETTINGS_NAMESPACE);
/** Settings schema for the plugin card and its optional image capability. */
const CodexAuthSettingsSchema = z.object({
	enableImageTool: z.boolean().default(DEFAULT_CODEX_AUTH_SETTINGS.enableImageTool),
	enableImageUpload: z.boolean().default(DEFAULT_CODEX_AUTH_SETTINGS.enableImageUpload)
});
//#endregion
//#region src/view-image.ts
/** Optional Codex image-reading tool, modeled on DSH's durable attachment seam. */
/** Stable name of the optional image-recognition tool. */
const VIEW_IMAGE_TOOL_NAME = "view_image";
function imageRefOf(image) {
	return {
		attachmentId: AttachmentId(image.attachmentId),
		mediaType: image.mediaType,
		bytes: image.bytes,
		width: image.width,
		height: image.height,
		...image.name === void 0 ? {} : { name: image.name }
	};
}
function contentOf(value) {
	return [{
		type: "text",
		text: `<source>${value.source}</source>\n<image>${value.image.mediaType}, ${value.image.width}x${value.image.height} px, ${value.image.bytes} bytes</image>`
	}, {
		type: "image",
		attachment: imageRefOf(value.image)
	}];
}
function mediaTypeOf(data) {
	if (data.length >= 8 && data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71 && data[4] === 13 && data[5] === 10 && data[6] === 26 && data[7] === 10) return "image/png";
	if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
	if (data.length >= 6) {
		const signature = String.fromCharCode(...data.subarray(0, 6));
		if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
	}
	if (data.length >= 12 && String.fromCharCode(...data.subarray(0, 4)) === "RIFF" && String.fromCharCode(...data.subarray(8, 12)) === "WEBP") return "image/webp";
}
async function assertImageCapable(ctx, exec, source) {
	const routed = exec.agent?.session.requestHeader()?.config;
	const provider = routed?.provider ?? exec.agent?.options.provider;
	const model = routed?.model ?? exec.agent?.options.model;
	if (provider === void 0 || model === void 0) throw new Error(`cannot view ${JSON.stringify(source)}: the current model route is unavailable`);
	const info = await ctx.llm.resolveModelInfo(provider, model, exec.signal);
	if (info.inputModalities === void 0 || !info.inputModalities.includes("image")) throw new Error(`cannot view ${JSON.stringify(source)}: model "${model}" does not declare image input`);
}
/** Register a local-file image tool in the current DSH tool scope. */
function viewImageTool(ctx) {
	return defineTool({
		name: VIEW_IMAGE_TOOL_NAME,
		description: "View a local PNG, JPEG, WebP, or GIF image and return it to an image-capable model.",
		parameters: { source: {
			type: "string",
			required: true,
			description: "Absolute or workspace-relative local image path."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					source: {
						type: "string",
						required: true
					},
					image: {
						type: "object",
						required: true,
						additionalProperties: false,
						properties: {
							attachmentId: {
								type: "string",
								required: true
							},
							mediaType: {
								type: "string",
								required: true,
								enum: [
									"image/png",
									"image/jpeg",
									"image/webp",
									"image/gif"
								]
							},
							bytes: {
								type: "integer",
								required: true
							},
							width: {
								type: "integer",
								required: true
							},
							height: {
								type: "integer",
								required: true
							},
							name: { type: "string" }
						}
					}
				}
			},
			render: (_args, value) => contentOf(value)
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const source = args.source.trim();
			if (source.length === 0) throw new Error("view_image source must not be empty");
			await assertImageCapable(ctx, exec, source);
			const attachments = ctx.attachments;
			const maxBytes = Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes);
			const cwd = exec.agent?.session.header.cwd;
			const target = await ctx.fs.resolve(source, {
				...cwd === void 0 ? {} : { cwd },
				signal: exec.signal
			});
			const info = await ctx.fs.stat(target, exec.signal);
			if (info === void 0) throw new Error(`image path does not exist: ${source}`);
			if (info.type !== "file") throw new Error(`image path is not a regular file: ${source}`);
			const data = await ctx.fs.readBytes(target, exec.signal, maxBytes);
			ctx.emit("fs/observed", target, {
				kind: "present",
				version: info.version
			}, exec);
			const mediaType = mediaTypeOf(data);
			if (mediaType === void 0) throw new Error("view_image supports PNG, JPEG, WebP, and GIF image bytes");
			if (!attachments.imageLimits.mediaTypes.includes(mediaType)) throw new Error(`${mediaType} images are disabled by this deployment`);
			const name = basename(target.displayPath);
			const image = {
				data,
				mediaType,
				...name.length === 0 ? {} : { name }
			};
			await attachments.validateImage(image);
			const ref = await attachments.saveImage(image);
			const value = {
				source: target.displayPath,
				image: {
					attachmentId: ref.attachmentId,
					mediaType: ref.mediaType,
					bytes: ref.bytes,
					width: ref.width,
					height: ref.height,
					...ref.name === void 0 ? {} : { name: ref.name }
				}
			};
			if (exec.parent !== void 0) exec.deferContext(createUserMessage({
				content: contentOf(value),
				source: {
					kind: "plugin",
					plugin: "@tnnevol/dsh-codex-auth"
				}
			}));
			return value;
		},
		presentCall: (args) => ({
			card: "generic",
			title: `View image ${args.source}`,
			kind: "read",
			locations: [{ path: args.source }]
		})
	});
}
//#endregion
//#region src/adapter.ts
/** OpenAI Codex adapter assembled from dsh's public pi-ai extension seam. */
/** Keep the Codex stream open while the provider is still producing output. */
const CODEX_STREAM_IDLE_TIMEOUT_MS = 3e5;
/** Match dsh rc.8's default request-level image payload bound. */
const CODEX_MAX_REQUEST_IMAGE_BYTES = 20971520;
/**
* Give dsh's generic adapter the bearer token resolved by the plugin-owned
* OAuth store. This keeps the provider-native login flow separate from model
* requests while preserving pi-ai's Codex endpoint and model catalog.
*/
function requestProvider(provider) {
	return {
		...provider,
		auth: {
			...provider.auth,
			apiKey: {
				name: "OpenAI Codex OAuth bearer token",
				async resolve({ credential }) {
					const apiKey = credential?.key;
					return apiKey === void 0 || apiKey.length === 0 ? void 0 : {
						auth: { apiKey },
						source: "OAuth"
					};
				}
			}
		}
	};
}
/** Create the dsh LLM adapter for the provider-native OpenAI Codex catalog. */
function createCodexAdapter(credentials, resolveAttachments) {
	const provider = openaiCodexProvider();
	const profiles = /* @__PURE__ */ new Map([[CODEX_PROVIDER, {
		provider: CODEX_PROVIDER,
		displayName: "OpenAI Codex",
		streamIdleTimeoutMs: CODEX_STREAM_IDLE_TIMEOUT_MS,
		maxRequestImageBytes: CODEX_MAX_REQUEST_IMAGE_BYTES,
		retryPolicy: resolveRetryPolicy(void 0, "dsh-codex-auth-plugin retryPolicy"),
		configuredMaxTokens: /* @__PURE__ */ new Map(),
		piProvider: requestProvider(provider)
	}]]);
	const models = createModels({ credentials });
	models.setProvider(provider);
	return new PiAiAdapter({
		profiles: () => profiles,
		resolveApiKey: async () => (await models.getAuth(CODEX_PROVIDER))?.auth.apiKey,
		resolveAttachments
	});
}
//#endregion
//#region src/index.ts
/** Stable Host bundle name. */
const name = "dsh-codex-auth-plugin";
/** Host services required by the routes, settings card, and credential mirror. */
const inject = [
	"webServer",
	"settings",
	"credentials"
];
function apply(ctx) {
	const settings = ctx.settings.register(CODEX_AUTH_SETTINGS_NS, CodexAuthSettingsSchema);
	const store = new CodexCredentialStore();
	const mirror = new CodexCredentialMirror(ctx.credentials, store);
	const syncMirror = () => {
		mirror.sync().catch((error) => {
			ctx.logger.warn("dsh-codex-auth: failed to synchronize the Codex credential with dsh", error);
		});
	};
	ctx.effect(() => {
		syncMirror();
		const timer = setInterval(syncMirror, 6e4);
		return () => {
			clearInterval(timer);
		};
	}, "dsh-codex-auth: credential mirror");
	registerCodexAuthRoutes(ctx, store, mirror);
	registerCodexSettingsRoute(ctx, settings);
	let stopped = false;
	let imageFiber;
	let imageTail = Promise.resolve();
	const reconcileImageTool = async () => {
		if (stopped) return;
		const enabled = settings.get().enableImageTool;
		if (enabled === (imageFiber !== void 0)) return;
		const previous = imageFiber;
		imageFiber = void 0;
		if (previous !== void 0) await previous.dispose();
		if (stopped || !enabled) return;
		const fiber = ctx.inject([
			"tools",
			"fs",
			"attachments",
			"llm"
		], (toolCtx) => toolCtx.tools.register(viewImageTool(toolCtx)));
		imageFiber = fiber;
		Promise.resolve(fiber).catch((error) => {
			if (imageFiber === fiber) imageFiber = void 0;
			ctx.logger.error("dsh-codex-auth: optional view_image tool failed to activate");
			ctx.logger.error(error);
		});
	};
	const scheduleImageTool = () => {
		imageTail = imageTail.then(reconcileImageTool, reconcileImageTool).catch((error) => {
			ctx.logger.error("dsh-codex-auth: could not apply the image-recognition configuration");
			ctx.logger.error(error);
		});
	};
	const unwatch = settings.watch(scheduleImageTool);
	ctx.effect(() => async () => {
		stopped = true;
		unwatch();
		await imageTail;
		const image = imageFiber;
		imageFiber = void 0;
		await image?.dispose();
	}, "dsh-codex-auth: optional image-tool lifecycle");
	scheduleImageTool();
}
//#endregion
export { CODEX_API_KEY_ENV, CODEX_API_KEY_REF, CODEX_AUTH_FILENAME, CODEX_AUTH_LOGIN_PATH, CODEX_AUTH_LOGOUT_PATH, CODEX_AUTH_SETTINGS_NAMESPACE, CODEX_AUTH_STATUS_PATH, CODEX_PROVIDER, CODEX_STREAM_IDLE_TIMEOUT_MS, CodexCredentialMirror, CodexCredentialStore, CodexUsageService, CodexWebAuth, apply, codexAuthPath, codexAuthStatus, createCodexAdapter, inject, loginCodex, logoutCodex, name, normalizeCodexUsagePayload, registerCodexAuthRoutes, trustedRequest };
