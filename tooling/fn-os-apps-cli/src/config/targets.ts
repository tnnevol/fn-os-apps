export const pluginTargets = [
  {
    value: 'codex',
    label: 'Codex Auth',
    filter: '@tnnevol/dsh-codex-auth...',
    path: 'plugins/dsh-codex-auth-plugin/package.json',
    slug: 'dsh-codex-auth',
  },
  {
    value: 'fnos',
    label: 'fnOS',
    filter: '@tnnevol/dsh-fnos...',
    path: 'plugins/dsh-fnos-plugin/package.json',
    slug: 'dsh-fnos',
  },
  {
    value: 'showcase',
    label: 'Semi UI Showcase',
    filter: '@tnnevol/dsh-semi-ui-showcase...',
    path: 'plugins/dsh-semi-ui-showcase-plugin/package.json',
    slug: 'dsh-semi-ui-showcase',
  },
] as const

export type PluginTarget = typeof pluginTargets[number]
export type PluginAlias = PluginTarget['value']

export function findPluginTarget(alias: string | undefined): PluginTarget | undefined {
  return pluginTargets.find(target => target.value === alias)
}
