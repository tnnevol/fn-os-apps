import { createModels } from "@earendil-works/pi-ai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
//#region src/store.ts
/** Owner-only persistent storage for the shared OpenAI Codex OAuth document. */
/** pi-ai provider id used by ChatGPT Codex OAuth. */
const CODEX_PROVIDER = "openai-codex";
/** Kept compatible with dsh-codex-connect so a login can be reused. */
const CODEX_AUTH_FILENAME = ".openai-codex-auth.json";
const AUTH_FORMAT_VERSION = 1;
function isENOENT(error) {
	return error?.code === "ENOENT";
}
async function assertOwnerOnly(filename) {
	let mode;
	try {
		mode = (await stat(filename)).mode;
	} catch (error) {
		if (isENOENT(error)) return;
		throw error;
	}
	if (process.platform === "win32") return;
	if ((mode & 63) !== 0) throw new Error(`codex-auth: ${filename} is readable beyond its owner (mode ${(mode & 511).toString(8)}); run "chmod 600 ${filename}" before starting again`);
}
function parseDocument(text, filename) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error(`codex-auth: ${filename} is not valid JSON`);
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`codex-auth: ${filename} must contain an object`);
	const document = value;
	if (document["version"] !== AUTH_FORMAT_VERSION) throw new Error(`codex-auth: ${filename} has unsupported auth format version ${String(document["version"])}`);
	if (Object.keys(document).some((key) => key !== "version" && key !== "credential")) throw new Error(`codex-auth: ${filename} contains an unknown top-level field`);
	const raw = document["credential"];
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error(`codex-auth: ${filename} credential must be an object`);
	const credential = raw;
	if (Object.keys(credential).some((key) => ![
		"type",
		"access",
		"refresh",
		"expires",
		"accountId"
	].includes(key))) throw new Error(`codex-auth: ${filename} credential contains an unknown field`);
	if (credential["type"] !== "oauth") throw new Error(`codex-auth: ${filename} credential type must be oauth`);
	for (const key of [
		"access",
		"refresh",
		"accountId"
	]) if (typeof credential[key] !== "string" || credential[key].length === 0) throw new Error(`codex-auth: ${filename} credential ${key} must be a non-empty string`);
	if (typeof credential["expires"] !== "number" || !Number.isFinite(credential["expires"]) || credential["expires"] <= 0) throw new Error(`codex-auth: ${filename} credential expires must be a positive finite number`);
	return {
		version: AUTH_FORMAT_VERSION,
		credential
	};
}
function codexAuthPath(dshHome) {
	return resolve(join(resolveDshHome(dshHome), CODEX_AUTH_FILENAME));
}
/** File-backed CredentialStore that owns only the Codex OAuth route. */
var CodexCredentialStore = class {
	filename;
	constructor(filename = codexAuthPath()) {
		this.filename = resolve(filename);
	}
	async readCurrent() {
		await assertOwnerOnly(this.filename);
		let text;
		try {
			text = await readFile(this.filename, "utf8");
		} catch (error) {
			if (isENOENT(error)) return void 0;
			throw error;
		}
		return structuredClone(parseDocument(text, this.filename).credential);
	}
	async read(providerId) {
		return providerId === "openai-codex" ? this.readCurrent() : void 0;
	}
	async list() {
		return await this.readCurrent() === void 0 ? [] : [{
			providerId: CODEX_PROVIDER,
			type: "oauth"
		}];
	}
	async modify(providerId, fn) {
		if (providerId !== "openai-codex") throw new Error(`codex-auth: credential store does not own provider "${providerId}"`);
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		return withFileLock(this.filename, async () => {
			const current = await this.readCurrent();
			const candidate = await fn(current);
			if (candidate === void 0) return current;
			const document = parseDocument(JSON.stringify({
				version: AUTH_FORMAT_VERSION,
				credential: candidate
			}), this.filename);
			await writeFileAtomic(this.filename, `${JSON.stringify(document, null, 2)}\n`, {
				mode: 384,
				dirMode: 448
			});
			return structuredClone(document.credential);
		});
	}
	async delete(providerId) {
		if (providerId !== "openai-codex") return;
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		await withFileLock(this.filename, () => rm(this.filename, { force: true }));
	}
};
//#endregion
//#region src/auth.ts
/** ChatGPT OAuth orchestration used by the Host routes and CLI consumers. */
/** Start provider-native ChatGPT OAuth and persist its credential. */
async function loginCodex(interaction, store = new CodexCredentialStore()) {
	const models = createModels({ credentials: store });
	models.setProvider(openaiCodexProvider());
	await models.login(CODEX_PROVIDER, "oauth", interaction);
}
/** Delete the plugin-owned Codex credential. */
async function logoutCodex(store = new CodexCredentialStore()) {
	await store.delete(CODEX_PROVIDER);
}
/** Read login state without refreshing the token. */
async function codexAuthStatus(store = new CodexCredentialStore()) {
	const credential = await store.read(CODEX_PROVIDER);
	return credential?.type === "oauth" ? {
		authenticated: true,
		expiresAt: new Date(credential.expires)
	} : { authenticated: false };
}
//#endregion
export { CODEX_PROVIDER as a, CODEX_AUTH_FILENAME as i, loginCodex as n, CodexCredentialStore as o, logoutCodex as r, codexAuthPath as s, codexAuthStatus as t };
