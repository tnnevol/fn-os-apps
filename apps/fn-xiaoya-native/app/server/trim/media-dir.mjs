/**
 * 元数据目录的配置与文件操作。
 *
 * 与 all_in_one.sh 的对应关系：脚本用 `get_media_dir` 让用户手输一个绝对路径，
 * 然后无条件 `chmod 777` 并把内容解压到 `${MEDIA_DIR}/xiaoya`。
 * 那种做法在飞牛上是不可接受的：路径未经授权、权限被放宽、用户看不到自己的数据。
 *
 * 这里改成：
 * - 用户通过飞牛目录选择器**授权**一个目录，应用只在该目录内工作；
 * - 目录配置持久化到 state/media-dir.json，记录授权根与用户选定的子目录；
 * - 所有文件操作都先做「必须落在已授权根内」的校验，再做当前用户 ACL 校验；
 * - 不使用 chmod 777，权限由飞牛 ACL 体系管理。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { badRequest, forbidden, notFound, serverError } from '../http/respond.mjs'
import { stateDir } from '../paths.mjs'
import { checkUserAcl, getSharedFolders, isWithinAllowed } from '../trim/api.mjs'

/** 配置文件名。 */
const CONFIG_FILE = () => join(stateDir, 'media-dir.json')

/**
 * 读取目录配置。
 *
 * 结构：
 *   { root: '/vol1/1000/xxx', subdir: 'xiaoya' }
 * root 是用户授权的目录；subdir 是 root 下用户为元数据建的子目录。
 * 两者拼成实际的媒体目录。
 */
export function readMediaConfig() {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE(), 'utf8'))
    return {
      root: typeof raw?.root === 'string' ? raw.root : '',
      subdir: typeof raw?.subdir === 'string' ? raw.subdir : '',
    }
  }
  catch {
    // 未配置或文件损坏都视为「还没有选目录」
    return { root: '', subdir: '' }
  }
}

/** 写入目录配置。 */
function writeMediaConfig(next) {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(CONFIG_FILE(), JSON.stringify(next, null, 2), { mode: 0o600 })
  return next
}

/** 实际使用的元数据目录；未配置时返回 null。 */
export function resolveMediaDir() {
  const { root, subdir } = readMediaConfig()
  if (root === '') return null
  return subdir === '' ? root : join(root, subdir)
}

/**
 * 设置媒体目录。
 *
 * root 必须是已授权目录之一（或已授目录本身）；subdir 只能是单层安全名称，
 * 不允许 `..`、绝对路径或分隔符，避免把解压目标指到授权范围之外。
 */
export async function setMediaDir({ root, subdir }) {
  if (typeof root !== 'string' || root === '') {
    throw badRequest('请先选择元数据目录', '请点击「选择目录」在飞牛中授权一个目录')
  }

  // 关键安全校验：只接受飞牛实际授权给本应用的目录
  const folders = await getSharedFolders()
  if (!folders.ok) {
    // 区分「环境不支持」与「用户没授权」：开发机上前者是常态，
    // 提示成「请授权」会误导使用者去翻应用设置。
    const unsupported = /令牌|未检测到飞牛|无权访问飞牛/.test(folders.reason ?? '')
    throw forbidden(
      `无法确认目录授权状态：${folders.reason}`,
      unsupported
        ? '目录授权依赖飞牛运行环境；请在飞牛中打开本应用完成授权'
        : '请在飞牛应用设置中为该应用授权目录后重试',
    )
  }
  if (!isWithinAllowed(root, folders.paths)) {
    throw forbidden(
      '所选目录未授权给本应用',
      '请点击「选择目录」在飞牛目录选择器中重新授权',
    )
  }

  if (typeof subdir !== 'string' || subdir.includes('/') || subdir === '.' || subdir === '..') {
    throw badRequest('子目录名称不合法', '只能使用不含 / 的名称')
  }

  const target = subdir === '' ? root : join(root, subdir)
  try {
    mkdirSync(target, { recursive: true })
  }
  catch (error) {
    throw serverError(`无法创建元数据目录：${error.message}`, '请确认该目录可写，或改选其它授权目录')
  }

  return writeMediaConfig({ root, subdir })
}

/**
 * 列出目录内容。
 *
 * 只允许浏览授权根之内；每一层都先用授权根做前缀校验，
 * 避免用户通过构造 path 参数读到授权目录之外的内容。
 */
export async function listDirectory(path, uid) {
  const root = requireRoot()
  const target = path === '' ? root : path

  if (!isWithinAllowed(target, [root])) {
    throw forbidden('该路径不在已授权目录内', '请回到元数据目录根下再操作')
  }
  if (!existsSync(target)) {
    throw notFound('目录不存在', '请刷新后重试')
  }
  if (!statSync(target).isDirectory()) {
    throw badRequest('目标不是目录', '请选择一个目录')
  }

  // 授权只解决「应用用户能不能读」，是否展示还要看当前使用用户的 ACL
  const acl = await checkUserAcl(uid, [target])
  if (acl.ok) {
    const permission = acl.acl.get(target)
    if (permission !== undefined && permission.readable !== true) {
      throw forbidden('当前用户无权访问该目录', '请确认该目录对你的账号有读取权限')
    }
  }

  let entries
  try {
    entries = readdirSync(target, { withFileTypes: true })
  }
  catch (error) {
    throw serverError(`无法读取目录：${error.message}`, '请确认目录权限后重试')
  }

  const items = entries
    // 不展示隐藏文件：配置与临时文件对用户没有意义
    .filter(entry => !entry.name.startsWith('.'))
    .map((entry) => {
      const full = join(target, entry.name)
      let size = 0
      let mtime = null
      try {
        const stat = statSync(full)
        size = stat.size
        mtime = stat.mtime.toISOString()
      }
      catch {
        // 无权限读取单个条目时保留它，但不带具体信息
      }
      return {
        name: entry.name,
        path: full,
        type: entry.isDirectory() ? 'dir' : 'file',
        size,
        mtime,
      }
    })
    .sort((a, b) => {
      // 目录在前，同类按名称排序，符合文件管理器习惯
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })

  return { path: target, root, parent: target === root ? null : join(target, '..'), items }
}

/** 新建文件夹。 */
export async function createFolder(path, uid) {
  const root = requireRoot()
  assertInside(root, path)
  validateName(path)

  const acl = await checkUserAcl(uid, [root])
  if (acl.ok) {
    const permission = acl.acl.get(root)
    if (permission !== undefined && permission.writable !== true) {
      throw forbidden('当前用户无权在该目录创建内容', '请确认你对授权目录有写入权限')
    }
  }

  if (existsSync(path)) {
    throw badRequest('同名文件夹已存在', '请换一个名称')
  }
  try {
    mkdirSync(path, { recursive: false })
  }
  catch (error) {
    throw serverError(`创建失败：${error.message}`, '请确认目录权限与磁盘空间')
  }
  return { path }
}

/** 重命名文件夹或文件。 */
export async function renameEntry(from, to, uid) {
  const root = requireRoot()
  assertInside(root, from)
  assertInside(root, to)
  validateName(to)

  const acl = await checkUserAcl(uid, [from, to].filter(p => existsSync(p)))
  if (acl.ok) {
    for (const [, permission] of acl.acl) {
      if (permission.writable !== true) {
        throw forbidden('当前用户无权重命名该项', '请确认你对目标路径有写入权限')
      }
    }
  }

  if (!existsSync(from)) throw notFound('要重命名的项不存在', '请刷新后重试')
  if (existsSync(to)) throw badRequest('目标名称已存在', '请换一个名称')
  try {
    renameSync(from, to)
  }
  catch (error) {
    throw serverError(`重命名失败：${error.message}`, '请确认目标名称合法且权限充足')
  }
  return { from, to }
}

/**
 * 删除文件夹或文件。
 *
 * 只允许删授权目录内的内容，且禁止删授权根本身——
 * 那会连带删掉用户在飞牛里指定给应用的家目录，属于误操作的高发点。
 */
export async function deleteEntry(path, uid) {
  const root = requireRoot()
  assertInside(root, path)
  if (path === root) {
    throw badRequest('不能删除已授权的根目录', '请改为删除其内部的子目录或文件')
  }

  const acl = await checkUserAcl(uid, [path])
  if (acl.ok) {
    const permission = acl.acl.get(path)
    if (permission !== undefined && permission.deletable !== true) {
      throw forbidden('当前用户无权删除该项', '请确认你对目标路径有删除权限')
    }
  }

  if (!existsSync(path)) throw notFound('要删除的项不存在', '请刷新后重试')
  try {
    rmSync(path, { recursive: true, force: false })
  }
  catch (error) {
    throw serverError(`删除失败：${error.message}`, '请确认目录非空时未被占用、且权限充足')
  }
  return { path }
}

/** 取得授权根；未配置时直接报错，避免后续逻辑在空路径上运算。 */
function requireRoot() {
  const { root } = readMediaConfig()
  if (root === '') {
    throw badRequest('尚未配置元数据目录', '请先点击「选择目录」完成授权')
  }
  return root
}

/** 断言路径落在授权根内。 */
function assertInside(root, path) {
  if (!isWithinAllowed(path, [root])) {
    throw forbidden('该路径不在已授权目录内', '只能操作已授权目录中的内容，请勿使用 .. 或绝对路径')
  }
}

/**
 * 校验新建项的名称。
 *
 * 拒绝分隔符与 `..`：否则 `../../etc` 这类名称会把路径带出授权范围，
 * 虽然后续还有前缀校验，但在入口就拦住更清晰。
 */
function validateName(path) {
  const name = path.split('/').pop() ?? ''
  if (name === '' || name === '.' || name === '..' || name.startsWith('.')) {
    throw badRequest('名称不合法', '不能为空、不能以点开头')
  }
  if (/[/\\]/.test(name)) {
    throw badRequest('名称不能包含路径分隔符', '请使用单纯的文件夹名称')
  }
}
