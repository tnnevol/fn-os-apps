//#region src/auth-paths.d.ts
/** Browser-facing paths owned by the standalone Codex authentication plugin. */
/** Host settings namespace used to dispatch the browser settings card. */
declare const CODEX_AUTH_SETTINGS_NAMESPACE = "dsh-codex-auth";
declare const CODEX_AUTH_STATUS_PATH = "/plugins/dsh-codex-auth-plugin/auth/status";
declare const CODEX_AUTH_LOGIN_PATH = "/plugins/dsh-codex-auth-plugin/auth/login";
declare const CODEX_AUTH_LOGOUT_PATH = "/plugins/dsh-codex-auth-plugin/auth/logout";
declare const CODEX_USAGE_PATH = "/plugins/dsh-codex-auth-plugin/auth/usage";
/** Same-origin settings endpoint used when DSH marks a NAS browser as remote. */
declare const CODEX_AUTH_SETTINGS_PATH = "/plugins/dsh-codex-auth-plugin/auth/settings";
//#endregion
export { CODEX_AUTH_LOGIN_PATH, CODEX_AUTH_LOGOUT_PATH, CODEX_AUTH_SETTINGS_NAMESPACE, CODEX_AUTH_SETTINGS_PATH, CODEX_AUTH_STATUS_PATH, CODEX_USAGE_PATH };