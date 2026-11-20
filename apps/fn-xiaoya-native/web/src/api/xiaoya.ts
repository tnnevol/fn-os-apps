/**
 * 后端接口封装。
 *
 * 与脚手架自带的 `@/api/auth` 不同：本应用不使用「用户名密码换 token」的模型。
 * 生产环境身份由飞牛统一网关通过 Header 注入，开发环境后端直接返回本地开发身份，
 * 因此前端只需要问后端「我是谁」，不需要自己维护登录态。
 */
import request from '@/utils/http'

/** 统一响应包装。 */
interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
  suggestion?: string
}

/** 运行模式与当前用户。 */
export interface SystemContext {
  user: { uid: string; username: string; isAdmin: boolean; source: string }
  mode: 'development' | 'production'
  version: string
}

/** 健康检查结果。 */
export interface HealthInfo extends SystemContext {
  docker: { available: boolean; version?: string; reason?: string }
  configured: boolean
}

/** 配置读取结果。 */
export interface ConfigState {
  values: Record<string, string>
  secrets: Record<string, { configured: boolean; masked: string; updatedAt: string | null }>
  switches: Record<string, boolean>
}

/** 字段元信息。 */
export interface FieldMeta {
  fields: Array<{ key: string; label: string; secret: boolean }>
  switches: Array<{ key: string; label: string }>
}

/** 小雅容器状态。 */
export interface AlistStatus {
  exists: boolean
  running: boolean
  state: string
  statusText: string
  image: string
  ports: string[]
  imageChoice?: string
}

/** 元数据包状态。 */
export interface MetadataPackage {
  name: string
  label: string
  desc: string
  dirs: string[]
  target: 'xiaoya' | 'config'
  targetPath: string
  size: number
  downloaded: boolean
  incomplete: boolean
  extracted: boolean
}

/** 任务摘要。 */
export interface MetadataTask {
  id: string
  type: string
  package: string
  label: string
  dirs: string[]
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted'
  stage: string
  progress: number
  downloadedBytes: number
  totalBytes: number
  speed: number
  message: string
  createdAt: number
  updatedAt: number
  startedAt: number | null
  finishedAt: number | null
  logs?: string[]
  logCount?: number
  logCursor?: number
}

/** 容量信息。 */
export interface CapacityInfo {
  path: string
  total?: number
  free?: number
  used?: number
  recommendedFreeBytes?: number
  unavailable?: boolean
  reason?: string
}

/** 授权二维码。 */
export interface QrSession {
  sessionId: string
  qrContent: string
  expiresIn: number
}

/* ── 系统 ─────────────────────────────────────────────── */

export function fetchHealth() {
  return request.get<ApiEnvelope<HealthInfo>>({ url: '/api/system/health' })
}

export function fetchContext() {
  return request.get<ApiEnvelope<SystemContext>>({ url: '/api/system/context' })
}

export function fetchFields() {
  return request.get<ApiEnvelope<FieldMeta>>({ url: '/api/system/fields' })
}

export function fetchCapacity() {
  return request.get<ApiEnvelope<CapacityInfo>>({ url: '/api/system/capacity' })
}

/* ── 配置 ─────────────────────────────────────────────── */

export function fetchConfig() {
  return request.get<ApiEnvelope<ConfigState>>({ url: '/api/config' })
}

export function saveConfig(payload: {
  values?: Record<string, string>
  switches?: Record<string, boolean>
}) {
  return request.put<ApiEnvelope<unknown>>({ url: '/api/config', data: payload })
}

/* ── 小雅容器 ─────────────────────────────────────────── */

export function fetchAlistStatus() {
  return request.get<ApiEnvelope<AlistStatus>>({ url: '/api/alist/status' })
}

export function alistAction(action: 'start' | 'stop' | 'restart' | 'update') {
  return request.post<ApiEnvelope<{ action: string; message: string }>>({
    url: '/api/alist/action',
    data: { action }
  })
}

export function fetchAlistLogs(tail = 200) {
  return request.get<ApiEnvelope<{ logs: string; unavailable?: string; reason?: string }>>({
    url: '/api/alist/logs',
    params: { tail }
  })
}

export function fetchAlistImage() {
  return request.get<ApiEnvelope<{ image: string }>>({ url: '/api/alist/image' })
}

export function saveAlistImage(image: string) {
  return request.put<ApiEnvelope<{ image: string }>>({ url: '/api/alist/image', data: { image } })
}

/* ── 授权 ─────────────────────────────────────────────── */

export function createAlipanQr() {
  return request.post<ApiEnvelope<QrSession>>({ url: '/api/auth/alipan/qrcode' })
}

export function pollAlipanQr(sessionId: string) {
  return request.get<ApiEnvelope<{ status: string; hasRefreshToken?: boolean }>>({
    url: `/api/auth/alipan/qrcode/${sessionId}`
  })
}

export function commitAlipanQr(sessionId: string) {
  return request.post<ApiEnvelope<{ updated: string[] }>>({
    url: `/api/auth/alipan/qrcode/${sessionId}/commit`
  })
}

/** 115 可选的扫码端。 */
export interface QrcodeApp {
  value: string
  label: string
}

/**
 * 生成 115 扫码会话。
 *
 * @param app 扫码绑定的设备端；不同端换到的 Cookie 设备类型与风控等级不同
 */
export function create115Qr(app?: string) {
  return request.post<ApiEnvelope<QrSession>>({
    url: '/api/auth/115/qrcode',
    data: { app }
  })
}

/** 拉取可选的扫码端列表与默认端。 */
export function fetch115Apps() {
  return request.get<ApiEnvelope<{ apps: QrcodeApp[]; defaultApp: string }>>({
    url: '/api/auth/115/apps'
  })
}

export function poll115Qr(sessionId: string) {
  return request.get<ApiEnvelope<{ status: string }>>({ url: `/api/auth/115/qrcode/${sessionId}` })
}

/* ── 元数据 ───────────────────────────────────────────── */

export function fetchPackages() {
  return request.get<ApiEnvelope<{ packages: MetadataPackage[] }>>({
    url: '/api/metadata/packages'
  })
}

export function fetchTasks() {
  return request.get<ApiEnvelope<{ tasks: MetadataTask[] }>>({ url: '/api/metadata/tasks' })
}

export function createTask(payload: { type: string; package: string; dirs?: string[] }) {
  return request.post<ApiEnvelope<MetadataTask>>({ url: '/api/metadata/tasks', data: payload })
}

export function fetchTask(id: string, logOffset = 0) {
  return request.get<ApiEnvelope<MetadataTask>>({
    url: `/api/metadata/tasks/${id}`,
    params: { logOffset }
  })
}

export function cancelTask(id: string) {
  return request.post<ApiEnvelope<MetadataTask>>({ url: `/api/metadata/tasks/${id}/cancel` })
}

export function deleteArchive(name: string) {
  return request.del<ApiEnvelope<{ removed: string[] }>>({
    url: `/api/metadata/packages/${encodeURIComponent(name)}`
  })
}

/* ── 元数据目录（飞牛授权目录） ───────────────────────── */

/** 目录配置状态。 */
export interface MediaDirState {
  root: string
  subdir: string
  path: string | null
  configured: boolean
  /** 当前环境是否具备飞牛目录授权能力 */
  authAvailable: boolean
}

/** 目录条目。 */
export interface MediaEntry {
  name: string
  path: string
  type: 'dir' | 'file'
  size: number
  mtime: string | null
}

/** 目录列表结果。 */
export interface MediaList {
  path: string
  root: string
  parent: string | null
  items: MediaEntry[]
}

export function fetchMediaDir() {
  return request.get<ApiEnvelope<MediaDirState>>({ url: '/api/media/dir' })
}

export function fetchMediaRoots() {
  return request.get<ApiEnvelope<{ available: boolean; paths: string[]; reason: string }>>({
    url: '/api/media/roots'
  })
}

export function saveMediaDir(payload: { root: string; subdir?: string }) {
  return request.put<ApiEnvelope<{ root: string; subdir: string; path: string }>>({
    url: '/api/media/dir',
    data: payload
  })
}

export function fetchMediaList(path: string) {
  return request.get<ApiEnvelope<MediaList>>({ url: '/api/media/list', params: { path } })
}

export function createMediaFolder(parent: string, name: string) {
  return request.post<ApiEnvelope<{ path: string }>>({
    url: '/api/media/folder',
    data: { parent, name }
  })
}

export function renameMediaEntry(from: string, to: string) {
  return request.post<ApiEnvelope<{ from: string; to: string }>>({
    url: '/api/media/rename',
    data: { from, to }
  })
}

export function deleteMediaEntry(path: string) {
  return request.del<ApiEnvelope<{ path: string }>>({
    url: '/api/media/entry',
    params: { path }
  })
}

/* ── 元数据同步（对齐 xiaoya_db） ─────────────────────── */

/** 同步配置。 */
export interface SyncConfig {
  enabled: boolean
  paths: string[]
  strmFrom: string
  strmTo: string
  count: number
  nfo: boolean
  /** 定时策略：mode 为 off 表示不定时 */
  schedule: ScheduleConfig
}

/** 同步状态。 */
export interface SyncState {
  status: 'idle' | 'running' | 'succeeded' | 'failed'
  startedAt: number | null
  finishedAt: number | null
  total: number
  done: number
  downloaded: number
  skipped: number
  failed: number
  message: string
  logs: string[]
  running: boolean
}

export function fetchSync() {
  return request.get<ApiEnvelope<{
    config: SyncConfig
    availablePaths: string[]
    state: SyncState
    /** 设备性能算出的并发推荐值 */
    capacity: {
      recommended: number
      cores: number
      freeMb: number
      totalMb: number
      reason: string
    } | null
    /** 并发输入边界；16 只是推荐值，不是上限 */
    limits: { min: number, max: number }
  }>>({
    url: '/api/sync'
  })
}

export function saveSync(config: Partial<SyncConfig>) {
  return request.put<ApiEnvelope<{ config: SyncConfig }>>({ url: '/api/sync', data: config })
}

export function runSync() {
  return request.post<ApiEnvelope<SyncState>>({ url: '/api/sync/run' })
}

export function fetchSyncState() {
  return request.get<ApiEnvelope<SyncState>>({ url: '/api/sync/state' })
}

/* ── 镜像测速与目录树 ─────────────────────────────────── */

/** 目录树节点。 */
export interface SyncTreeNode {
  name: string
  path: string
  isDir: boolean
  children?: SyncTreeNode[]
}

/** 目录树响应。 */
export interface SyncTreeResponse {
  base: string
  path: string
  entries: SyncTreeNode[]
}

/** 镜像探测结果。 */
export interface MirrorProbe {
  base: string
  ok: boolean
  ms: number | null
}

export function fetchSyncTree(path = '', depth = 1) {
  return request.get<ApiEnvelope<SyncTreeResponse>>({
    url: '/api/sync/tree',
    params: { path, depth }
  })
}

export function fetchMirrors() {
  return request.get<ApiEnvelope<{ mirrors: MirrorProbe[]; fastest: string | null }>>({
    url: '/api/sync/mirrors'
  })
}

export function probeMirrors() {
  return request.post<ApiEnvelope<{ base: string; ms: number; probed: number }>>({
    url: '/api/sync/mirrors/probe'
  })
}

/* ── Open Token 扫码 与 阿里云盘目录 ─────────────────── */

/** Open Token 扫码会话。 */
export interface OpenTokenQr {
  sessionId: string
  qrContent: string
  expiresIn: number
  /** 官方二维码图片（data URL）；优先展示它，App 扫码才能正确识别 */
  qrImage?: string
}

/** 扫码状态。 */
export interface OpenTokenPoll {
  status: 'waiting' | 'success' | 'expired'
  saved?: boolean
}

/** 阿里云盘目录项。 */
export interface AliyunFolder {
  id: string
  name: string
}

export function createOpenTokenQr() {
  return request.post<ApiEnvelope<OpenTokenQr>>({ url: '/api/auth/alipan/open-token/qrcode' })
}

export function pollOpenTokenQr(sessionId: string) {
  return request.get<ApiEnvelope<OpenTokenPoll>>({
    url: `/api/auth/alipan/open-token/qrcode/${sessionId}`
  })
}

export function fetchAliyunFolders(parent = 'root') {
  return request.get<ApiEnvelope<{ items: AliyunFolder[] }>>({
    url: '/api/auth/alipan/folders',
    params: { parent }
  })
}

/* ── 网盘凭据健康检测 ─────────────────────────────────── */

/** 单项检测结果。 */
export interface CredentialHealth {
  /** valid 有效 / invalid 已失效 / unknown 未配置或无法判断 */
  status: 'valid' | 'invalid' | 'unknown'
  message: string
  extra?: Record<string, unknown>
}

/** 全部网盘的检测结果。 */
export interface AllCredentialsHealth {
  refreshToken: CredentialHealth
  openToken: CredentialHealth
  pan115: CredentialHealth
  quark: CredentialHealth
  uc: CredentialHealth
}

export function fetchCredentialHealth() {
  return request.get<ApiEnvelope<AllCredentialsHealth>>({ url: '/api/auth/health' })
}


/* ── 对外地址 与 阿里云盘目录创建 ─────────────────────── */

/** 网卡地址候选，供设置页下拉选择。 */
export interface AddressInfo {
  addresses: Array<{
    name: string
    address: string
    internal: boolean
    usable: boolean
    preferred: boolean
  }>
  dockerAddress: string
}

export function fetchAddresses() {
  return request.get<ApiEnvelope<AddressInfo>>({ url: '/api/system/addresses' })
}

/** 在阿里云盘指定目录下新建文件夹（返回新目录 id，可直接用作转存目录）。 */
export function createAliyunFolder(parent: string, name: string) {
  return request.post<ApiEnvelope<AliyunFolder>>({
    url: '/api/auth/alipan/folders',
    data: { parent, name }
  })
}

/** 定时同步调度配置。 */
export interface ScheduleConfig {
  /** off 表示不定时 */
  mode: 'off' | 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  /** weekly 用 0-6（周日 0）；monthly 用 1-31 */
  day: number
}
