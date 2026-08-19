import z from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/authorized-directories-contract.d.ts
/** Browser/Host contract for fnOS shared-directory management. */
/** Settings namespace used to pair the Host namespace with the Client card. */
declare const FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE = "dsh-fnos-authorized-directories";
/** Same-origin route that lists the directories currently authorized for the app. */
declare const FNOS_AUTHORIZED_DIRECTORIES_PATH = "/plugins/dsh-fnos/authorized-directories";
/** Same-origin route that removes one application directory ACL. */
declare const FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH = "/plugins/dsh-fnos/authorized-directories/delete";
/** Same-origin route that converts internal fnOS paths to readable paths. */
declare const FNOS_PATH_CONVERSION_PATH = "/plugins/dsh-fnos/paths/convert";
interface ReadablePath {
  /** Internal fnOS path used by the Host and DSH reference codec. */
  path: string;
  /** User-facing path returned by trim.file.convertPath. */
  semanticPath: string;
}
//#endregion
//#region src/authorized-directories.d.ts
/** fnOS supplies user-authorized application paths through this variable. */
declare const FNOS_ACCESSIBLE_PATHS_ENV = "TRIM_DATA_ACCESSIBLE_PATHS";
/** fnOS supplies the application's declared shared data paths through this variable. */
declare const FNOS_DATA_SHARE_PATHS_ENV = "TRIM_DATA_SHARE_PATHS";
/** Normalize one fnOS volume path for display and exact delete matching. */
declare function normalizeAuthorizedPath(value: unknown): string | undefined;
/** Keep API order while removing malformed and duplicate paths. */
declare function normalizeAuthorizedPaths(value: unknown): string[];
/** Parse a fnOS colon-separated path environment variable. */
declare function splitPathEnvironment(value: unknown): string[];
/** Read user-authorized paths from the lifecycle environment and de-duplicate them. */
declare function accessiblePathsFromEnvironment(env?: NodeJS.ProcessEnv): string[];
/** Read declared application data shares for display and de-duplicate them. */
declare function dataSharePathsFromEnvironment(env?: NodeJS.ProcessEnv): string[];
/** Combine path sources without changing the first-seen order. */
declare function mergeAuthorizedPaths(...values: unknown[]): string[];
/** Keep a just-removed ACL out of the process-local merged configuration. */
declare function markAuthorizedPathRemoved(value: unknown): void;
/** Pair internal paths with fnOS semantic paths, falling back per entry. */
declare function convertPathsForDisplay(pathsValue: unknown, language?: string): Promise<ReadablePath[]>;
//#endregion
//#region src/index.d.ts
/** Stable Host bundle name. */
declare const name = "@tnnevol/dsh-fnos";
/** Settings are used to make the read-only fnOS card discoverable. */
declare const FnosSettingsSchema: z<Schemastery.ObjectS<{}>, Schemastery.ObjectT<{}>>;
declare const FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NS: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Host services required by the fnOS settings namespace and Web routes. */
declare const inject: string[];
declare function apply(ctx: Context): void;
//#endregion
export { FNOS_ACCESSIBLE_PATHS_ENV, FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH, FNOS_AUTHORIZED_DIRECTORIES_PATH, FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE, FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NS, FNOS_DATA_SHARE_PATHS_ENV, FNOS_PATH_CONVERSION_PATH, FnosSettingsSchema, accessiblePathsFromEnvironment, apply, convertPathsForDisplay, dataSharePathsFromEnvironment, inject, markAuthorizedPathRemoved, mergeAuthorizedPaths, name, normalizeAuthorizedPath, normalizeAuthorizedPaths, splitPathEnvironment };