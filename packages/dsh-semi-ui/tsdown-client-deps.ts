import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const semiUiRoot = join(require.resolve('@douyinfe/semi-ui'), '..', '..', '..')
const semiIconsRoot = join(require.resolve('@douyinfe/semi-icons'), '..', '..', '..')

/**
 * Client build configuration for consumers of the shared Semi facade.
 *
 * The facade intentionally keeps Semi packages as its implementation details.
 * This resolver lets plugin bundles inline those details without making each
 * plugin declare or maintain direct Semi dependencies of its own.
 */
export const dshSemiClientDeps = {
  deps: {
    alwaysBundle: [
      /^@tnnevol\/dsh-semi-ui(?:\/|$)/u,
      /^@douyinfe\/semi-ui(?:\/|$)/u,
      /^@douyinfe\/semi-icons(?:\/|$)/u,
    ],
  },
  alias: {
    '@douyinfe/semi-ui/lib/es/button/index.js': join(semiUiRoot, 'lib/es/button/index.js'),
    '@douyinfe/semi-ui/lib/es/button/buttonGroup.js': join(semiUiRoot, 'lib/es/button/buttonGroup.js'),
    '@douyinfe/semi-ui/lib/es/checkbox/index.js': join(semiUiRoot, 'lib/es/checkbox/index.js'),
    '@douyinfe/semi-ui/lib/es/cascader/index': join(semiUiRoot, 'lib/es/cascader/index.js'),
    '@douyinfe/semi-ui/lib/es/modal/index': join(semiUiRoot, 'lib/es/modal/index.js'),
    '@douyinfe/semi-ui/lib/es/progress/index': join(semiUiRoot, 'lib/es/progress/index.js'),
    '@douyinfe/semi-ui/lib/es/tag/index.js': join(semiUiRoot, 'lib/es/tag/index.js'),
    '@douyinfe/semi-ui/lib/es/dropdown/index.js': join(semiUiRoot, 'lib/es/dropdown/index.js'),
    '@douyinfe/semi-ui/lib/es/iconButton/index.js': join(semiUiRoot, 'lib/es/iconButton/index.js'),
    '@douyinfe/semi-ui/lib/es/hotKeys/index.js': join(semiUiRoot, 'lib/es/hotKeys/index.js'),
    '@douyinfe/semi-ui/lib/es/spin/index': join(semiUiRoot, 'lib/es/spin/index.js'),
    '@douyinfe/semi-ui/lib/es/toast/index': join(semiUiRoot, 'lib/es/toast/index.js'),
    '@douyinfe/semi-ui/lib/es/tooltip/index': join(semiUiRoot, 'lib/es/tooltip/index.js'),
    '@douyinfe/semi-ui/lib/es/popover/index': join(semiUiRoot, 'lib/es/popover/index.js'),
    '@douyinfe/semi-ui/lib/es/tree/index': join(semiUiRoot, 'lib/es/tree/index.js'),
    '@douyinfe/semi-ui/lib/es/treeSelect/index': join(semiUiRoot, 'lib/es/treeSelect/index.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconHistory.js': join(semiIconsRoot, 'lib/es/icons/IconHistory.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconAlertCircle.js': join(semiIconsRoot, 'lib/es/icons/IconAlertCircle.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconArrowLeft.js': join(semiIconsRoot, 'lib/es/icons/IconArrowLeft.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconButtonStroked.js': join(semiIconsRoot, 'lib/es/icons/IconButtonStroked.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconCheckCircleStroked.js': join(semiIconsRoot, 'lib/es/icons/IconCheckCircleStroked.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconClose.js': join(semiIconsRoot, 'lib/es/icons/IconClose.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconChevronDown.js': join(semiIconsRoot, 'lib/es/icons/IconChevronDown.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconCommand.js': join(semiIconsRoot, 'lib/es/icons/IconCommand.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconElementStroked.js': join(semiIconsRoot, 'lib/es/icons/IconElementStroked.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconFile.js': join(semiIconsRoot, 'lib/es/icons/IconFile.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconFolder.js': join(semiIconsRoot, 'lib/es/icons/IconFolder.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconFolderOpen.js': join(semiIconsRoot, 'lib/es/icons/IconFolderOpen.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconHelpCircle.js': join(semiIconsRoot, 'lib/es/icons/IconHelpCircle.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconHelpCircleStroked.js': join(semiIconsRoot, 'lib/es/icons/IconHelpCircleStroked.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconInfoCircle.js': join(semiIconsRoot, 'lib/es/icons/IconInfoCircle.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconList.js': join(semiIconsRoot, 'lib/es/icons/IconList.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconMoon.js': join(semiIconsRoot, 'lib/es/icons/IconMoon.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconModalStroked.js': join(semiIconsRoot, 'lib/es/icons/IconModalStroked.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconRefresh.js': join(semiIconsRoot, 'lib/es/icons/IconRefresh.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconRestart.js': join(semiIconsRoot, 'lib/es/icons/IconRestart.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconSetting.js': join(semiIconsRoot, 'lib/es/icons/IconSetting.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconSun.js': join(semiIconsRoot, 'lib/es/icons/IconSun.js'),
    '@douyinfe/semi-icons/lib/es/icons/IconTreeTriangleRight.js': join(semiIconsRoot, 'lib/es/icons/IconTreeTriangleRight.js'),
    '@douyinfe/semi-icons/lib/es/icons/index.js': join(semiIconsRoot, 'lib/es/icons/index.js'),
  },
}
