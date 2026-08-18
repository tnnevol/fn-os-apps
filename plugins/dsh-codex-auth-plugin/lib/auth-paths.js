//#region src/auth-paths.ts
/** Browser-facing paths owned by the standalone Codex authentication plugin. */
/** Host settings namespace used to dispatch the browser settings card. */
const CODEX_AUTH_SETTINGS_NAMESPACE = "dsh-codex-auth";
const CODEX_AUTH_STATUS_PATH = "/plugins/dsh-codex-auth-plugin/auth/status";
const CODEX_AUTH_LOGIN_PATH = "/plugins/dsh-codex-auth-plugin/auth/login";
const CODEX_AUTH_LOGOUT_PATH = "/plugins/dsh-codex-auth-plugin/auth/logout";
const CODEX_USAGE_PATH = "/plugins/dsh-codex-auth-plugin/auth/usage";
//#endregion
export { CODEX_AUTH_LOGIN_PATH, CODEX_AUTH_LOGOUT_PATH, CODEX_AUTH_SETTINGS_NAMESPACE, CODEX_AUTH_STATUS_PATH, CODEX_USAGE_PATH };
