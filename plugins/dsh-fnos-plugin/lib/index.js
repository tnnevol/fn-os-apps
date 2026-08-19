//#region src/index.ts
/** fnOS-specific integrations for DeepSeek Harness. */
/** Stable Host bundle name. */
const name = "@tnnevol/dsh-fnos";
/**
* The current P0 capability is browser-only. Keeping an explicit empty Host
* apply makes the package a normal DSH bundle while the client half owns the
* fnOS Web SDK bridge.
*/
function apply() {}
//#endregion
export { apply, name };
