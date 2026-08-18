import { AuthInteraction, Credential, CredentialInfo, CredentialStore } from "@earendil-works/pi-ai";
//#region src/store.d.ts
/** pi-ai provider id used by ChatGPT Codex OAuth. */
declare const CODEX_PROVIDER = "openai-codex";
/** Kept compatible with dsh-codex-connect so a login can be reused. */
declare const CODEX_AUTH_FILENAME = ".openai-codex-auth.json";
declare function codexAuthPath(dshHome?: string): string;
/** File-backed CredentialStore that owns only the Codex OAuth route. */
declare class CodexCredentialStore implements CredentialStore {
  readonly filename: string;
  constructor(filename?: string);
  private readCurrent;
  read(providerId: string): Promise<Credential | undefined>;
  list(): Promise<readonly CredentialInfo[]>;
  modify(providerId: string, fn: (current: Credential | undefined) => Promise<Credential | undefined>): Promise<Credential | undefined>;
  delete(providerId: string): Promise<void>;
}
//#endregion
//#region src/auth.d.ts
interface CodexAuthStatus {
  authenticated: boolean;
  expiresAt?: Date;
}
/** Start provider-native ChatGPT OAuth and persist its credential. */
declare function loginCodex(interaction: AuthInteraction, store?: CodexCredentialStore): Promise<void>;
/** Delete the plugin-owned Codex credential. */
declare function logoutCodex(store?: CodexCredentialStore): Promise<void>;
/** Read login state without refreshing the token. */
declare function codexAuthStatus(store?: CodexCredentialStore): Promise<CodexAuthStatus>;
//#endregion
export { CODEX_AUTH_FILENAME as a, codexAuthPath as c, logoutCodex as i, codexAuthStatus as n, CODEX_PROVIDER as o, loginCodex as r, CodexCredentialStore as s, CodexAuthStatus as t };