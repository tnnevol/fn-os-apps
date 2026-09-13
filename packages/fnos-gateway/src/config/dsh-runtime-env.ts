import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

/** File recording the pnpm store the install callback resolved for this home. */
export const PNPM_STORE_FILE = '.pnpm-store-dir'

/**
 * Read the pnpm store directory persisted at install time.
 *
 * The install callback records the store actually referenced by the Web
 * profile so later runs reuse the same one. A missing, empty, or non-absolute
 * value means "no override", never a guess.
 */
export function readPersistedPnpmStoreDir(dshHome: string): string | undefined {
  let value: string
  try {
    value = readFileSync(join(dshHome, PNPM_STORE_FILE), 'utf8')
  } catch {
    return undefined
  }
  const storeDir = value.split('\n', 1)[0]?.trim() ?? ''
  if (storeDir === '' || !isAbsolute(storeDir)) return undefined
  return storeDir
}

/**
 * Build the fixed environment for the DSH Web child process.
 *
 * DSH forwards plugin installs and updates to `pnpm` in the Web profile
 * directory. pnpm pins the store it used into `node_modules/.modules.yaml` and
 * refuses every later operation with `ERR_PNPM_UNEXPECTED_STORE` once the
 * resolved store changes. Node derives that default from `HOME`, which here is
 * `@apphome` — a different volume from the `@appshare` store the profile was
 * built against. Passing the persisted store explicitly keeps runtime
 * resolution identical to install time, so `dsh plugin` and third-party market
 * updates keep working.
 */
export function buildDshRuntimeEnv(dshHome: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...base,
    HOME: dshHome,
    DSH_HOME: dshHome,
    NPM_CONFIG_CACHE: `${dshHome}/.npm-cache`,
    NPM_CONFIG_PREFIX: `${dshHome}/.npm-global`,
    NPM_CONFIG_USERCONFIG: `${dshHome}/.npmrc`,
    XDG_CONFIG_HOME: `${dshHome}/.config`,
  }
  const storeDir = readPersistedPnpmStoreDir(dshHome)
  if (storeDir === undefined) delete environment.PNPM_CONFIG_STORE_DIR
  else environment.PNPM_CONFIG_STORE_DIR = storeDir
  return environment
}
