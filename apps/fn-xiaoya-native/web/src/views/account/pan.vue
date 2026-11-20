<!--
  网盘授权页。

  与 all_in_one.sh 的对应关系：替代 `settings_aliyunpan_refreshtoken`、
  `settings_115_cookie` 等一串终端交互函数。

  交互约定：扫码为主，手工粘贴为辅。
  二维码被确认后由后端直接换取令牌/Cookie 并写入配置；
  同时保留手工粘贴入口——令牌过期、或用户手上已经有现成凭据时，
  重新扫码反而更麻烦（还要再走一次手机登录）。
-->
<template>
  <div class="pan">
    <!--
      统一说明放这里，避免每张卡都重复一遍「双击可编辑」。
      四个网盘面板的操作方式完全一样，逐卡提示只是噪音。
    -->
    <ElAlert
      type="info"
      show-icon
      :closable="false"
      title="两种填写方式"
      description="扫码可自动写入；已有凭据时双击表格里的值直接改。过期只需重新扫码或重填，平台不会因扫码失效。"
      class="pan__intro"
    />

    <GlassPanel title="阿里云盘">
      <ElRow :gutter="24">
        <ElCol :xs="24" :md="8">
          <div class="pan__scan">
            <template v-if="ali.qr !== null">
              <QrCanvas :content="ali.qr" :size="160" />
              <p class="pan__state">{{ aliStatusText }}</p>
              <div class="pan__actions">
                <ElButton size="small" :loading="ali.polling" @click="pollAli">刷新状态</ElButton>
                <ElButton size="small" text @click="resetAli">重新生成</ElButton>
              </div>
            </template>
            <template v-else>
              <div class="pan__placeholder">
                <ElIcon :size="28"><Iphone /></ElIcon>
                <p>用阿里云盘 App 扫码授权</p>
              </div>
              <ElButton type="primary" :loading="ali.loading" @click="startAli">
                生成二维码
              </ElButton>
            </template>
          </div>
        </ElCol>

        <!--
          Open Token 与 Refresh Token 是两套独立授权，但操作方式一样，
          并排放比上下两张卡更容易理解「这是同一件事的两种凭据」。
        -->
        <ElCol :xs="24" :md="8">
          <div class="pan__scan">
            <p class="pan__scan-title">
              Open Token
              <ElTag
                v-if="health?.openToken"
                :type="healthTagType(health.openToken.status)"
                effect="light"
                size="small"
                :title="health.openToken.message"
              >
                {{ healthLabel(health.openToken.status) }}
              </ElTag>
            </p>
            <template v-if="openToken.qrImage !== '' || openToken.qr !== null">
              <img
                v-if="openToken.qrImage !== ''"
                :src="openToken.qrImage"
                alt="Open Token 授权二维码"
                class="pan__qr-image"
              >
              <QrCanvas v-else :content="openToken.qr ?? ''" :size="160" />
              <p class="pan__state">{{ openTokenStatusText }}</p>
              <div class="pan__actions">
                <ElButton size="small" :loading="openToken.polling" @click="pollOpenToken">
                  刷新状态
                </ElButton>
                <ElButton size="small" text @click="resetOpenToken"> 重新生成 </ElButton>
              </div>
            </template>
            <template v-else>
              <div class="pan__placeholder">
                <ElIcon :size="24">
                  <Key />
                </ElIcon>
                <p>扫码获取 Open Token</p>
              </div>
              <ElButton type="primary" :loading="openToken.loading" @click="startOpenToken">
                生成二维码
              </ElButton>
            </template>
          </div>
        </ElCol>

        <ElCol :xs="24" :md="8">
          <h4 class="pan__label">
            当前状态
            <!-- 进入页面时查一次的有效性结果；不轮询 -->
            <ElTag
              v-if="health?.refreshToken"
              :type="healthTagType(health.refreshToken.status)"
              effect="light"
              size="small"
              class="pan__health"
              :title="health.refreshToken.message"
            >
              阿里云盘：{{ healthLabel(health.refreshToken.status) }}
            </ElTag>
            <ElTag v-else-if="healthLoading" type="info" effect="plain" size="small" class="pan__health">
              检测中…
            </ElTag>
          </h4>
          <!-- 用 ElTable 承载：与面板其它页面的表格视觉一致，且支持行分隔 -->
          <ElTable :data="aliRows" size="small" border class="pan__table">
            <ElTableColumn prop="label" label="字段" width="130" />
            <ElTableColumn label="值" min-width="180">
              <template #default="{ row }">
                <EditableValue
                  :label="row.label"
                  :masked="row.masked"
                  :configured="row.configured"
                  :secret="row.secret"
                  :multiline="row.multiline"
                  :placeholder="row.placeholder"
                  :value="row.value"
                  :on-save="(v) => onEdit(row.key, v)"
                  :on-clear="row.configured ? () => onClear(row.key, row.label) : undefined"
                />
              </template>
            </ElTableColumn>
          </ElTable>
          <!-- 按钮只表达动作，选完写到哪里由旁边一句说明，不塞进按钮文案 -->
          <div class="pan__browse">
            <ElButton size="small" type="primary" plain @click="folderVisible = true">
              选择转存目录
            </ElButton>
            <span class="pan__hint">选完自动填入上面的「转存目录 ID」</span>
          </div>
        </ElCol>
      </ElRow>

      <ElDialog v-model="folderVisible" title="选择转存目录" width="600px" append-to-body>
        <AliyunFolderPicker @picked="onFolderPicked" />
        <template #footer>
          <ElButton @click="folderVisible = false">取消</ElButton>
        </template>
      </ElDialog>
    </GlassPanel>

    <GlassPanel title="115 网盘">
      <ElRow :gutter="24">
        <ElCol :xs="24" :md="12">
          <div class="pan__scan">
            <!--
              扫码前选设备端：不同端换到的 Cookie 设备类型与风控等级不同。
              支付宝小程序最宽松，设为默认。
            -->
            <div v-if="pan.qr === null" class="pan__app-picker">
              <span class="pan__label">登录端</span>
              <ElSelect v-model="pan.app" size="small" class="pan__app-select">
                <ElOption
                  v-for="item in qrApps"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
            </div>
            <template v-if="pan.qr !== null">
              <QrCanvas :content="pan.qr" :size="160" />
              <p class="pan__state">{{ panStatusText }}</p>
              <div class="pan__actions">
                <ElButton size="small" :loading="pan.polling" @click="poll115">刷新状态</ElButton>
                <ElButton size="small" text @click="reset115">重新生成</ElButton>
              </div>
            </template>
            <template v-else>
              <div class="pan__placeholder">
                <ElIcon :size="28"><Iphone /></ElIcon>
                <p>用 115 App 扫码授权</p>
              </div>
              <ElButton type="primary" :loading="pan.loading" @click="start115"
                >生成二维码</ElButton
              >
            </template>
            <p class="pan__hint">确认登录后会自动换取 Cookie 并写入配置。</p>
          </div>
        </ElCol>

        <ElCol :xs="24" :md="12">
          <h4 class="pan__label">当前状态</h4>
          <ElTable :data="pan115Rows" size="small" border class="pan__table">
            <ElTableColumn prop="label" label="字段" width="130" />
            <ElTableColumn label="值" min-width="220">
              <template #default="{ row }">
                <EditableValue
                  :label="row.label"
                  :masked="row.masked"
                  :configured="row.configured"
                  :secret="row.secret"
                  :multiline="row.multiline"
                  :placeholder="row.placeholder"
                  :value="row.value"
                  :on-save="(v) => onEdit(row.key, v)"
                  :on-clear="row.configured ? () => onClear(row.key, row.label) : undefined"
                />
              </template>
            </ElTableColumn>
          </ElTable>
        </ElCol>
      </ElRow>
    </GlassPanel>

    <!--
      夸克 / UC 没有可用的扫码授权接口，只能手工粘贴 Cookie。
      与上面「扫码即写入」的两家刻意分开呈现：如果混在同一个扫码卡片里，
      用户会一直等二维码，而这两项永远不会有二维码可扫。
    -->
    <GlassPanel
      title="夸克 / UC 网盘"
      description="这两个网盘没有扫码授权接口，需要从浏览器复制 Cookie 后粘贴保存。"
    >
      <ElRow :gutter="24">
        <ElCol :xs="24" :md="12">
          <h4 class="pan__label">夸克网盘</h4>
          <ElTable :data="quarkRows" size="small" border class="pan__table">
            <ElTableColumn prop="label" label="字段" width="120" />
            <ElTableColumn label="值" min-width="180">
              <template #default="{ row }">
                <EditableValue
                  :label="row.label"
                  :masked="row.masked"
                  :configured="row.configured"
                  :secret="row.secret"
                  :multiline="row.multiline"
                  :placeholder="row.placeholder"
                  :value="row.value"
                  :on-save="(v) => onEdit(row.key, v)"
                  :on-clear="row.configured ? () => onClear(row.key, row.label) : undefined"
                />
              </template>
            </ElTableColumn>
          </ElTable>
        </ElCol>

        <ElCol :xs="24" :md="12">
          <h4 class="pan__label">UC 网盘</h4>
          <ElTable :data="ucRows" size="small" border class="pan__table">
            <ElTableColumn prop="label" label="字段" width="120" />
            <ElTableColumn label="值" min-width="180">
              <template #default="{ row }">
                <EditableValue
                  :label="row.label"
                  :masked="row.masked"
                  :configured="row.configured"
                  :secret="row.secret"
                  :multiline="row.multiline"
                  :placeholder="row.placeholder"
                  :value="row.value"
                  :on-save="(v) => onEdit(row.key, v)"
                  :on-clear="row.configured ? () => onClear(row.key, row.label) : undefined"
                />
              </template>
            </ElTableColumn>
          </ElTable>
        </ElCol>
      </ElRow>
      <p class="pan__hint">
        获取方式：浏览器登录对应网盘网页版 → 开发者工具 Network → 任选一个请求 → 复制请求头 Cookie
        整段。
      </p>
    </GlassPanel>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Iphone, Key } from '@element-plus/icons-vue'
  import GlassPanel from '@/components/glass/GlassPanel.vue'
  import QrCanvas from '@/components/glass/QrCanvas.vue'
  import EditableValue from '@/components/media/EditableValue.vue'
  import {
    create115Qr,
    createAlipanQr,
    createOpenTokenQr,
    fetch115Apps,
    fetchConfig,
    fetchCredentialHealth,
    poll115Qr,
    pollAlipanQr,
    pollOpenTokenQr,
    saveConfig,
    type AllCredentialsHealth,
    type ConfigState,
    type QrcodeApp
  } from '@/api/xiaoya'

  defineOptions({ name: 'AccountPan' })

  const config = ref<ConfigState>({ values: {}, secrets: {}, switches: {} })

  /* ── 可编辑字段（表格预览 / 双击编辑） ─────────────── */

  /** 表格行的通用形状。 */
  interface CredentialRow {
    key: string
    label: string
    masked: string
    configured: boolean
    secret: boolean
    multiline: boolean
    placeholder: string
    value: string
    /**
     * 这一行对应的凭据检测项。
     *
     * 检测结果显示在字段旁边而不是卡片标题上：用户看某个字段时
     * 才知道它是否有效，挂在标题上还得自己对应是哪个字段。
     */
    healthKey?: keyof AllCredentialsHealth
  }

  /** 取密钥类字段的展示信息。 */
  function secretRow(
    key: string,
    label: string,
    placeholder: string,
    multiline = false
  ): CredentialRow {
    const secret = config.value.secrets[key]
    return {
      key,
      label,
      masked: secret?.masked ?? '',
      configured: secret?.configured === true,
      secret: true,
      multiline,
      placeholder,
      value: ''
    }
  }

  /** 取明文类字段（例如转存目录 ID）。 */
  function plainRow(key: string, label: string, placeholder: string): CredentialRow {
    return {
      key,
      label,
      masked: config.value.values[key] ?? '',
      configured: (config.value.values[key] ?? '') !== '',
      secret: false,
      multiline: false,
      placeholder,
      value: config.value.values[key] ?? ''
    }
  }

  // 占位提示写成「格式 + 从哪来」，与上游脚本的校验规则一致：
  // mytoken.txt 必须 32 位、myopentoken.txt 只能是 280/335 位、folder id 40 位
  const aliRows = computed<CredentialRow[]>(() => [
    {
      ...secretRow('refreshToken', 'Refresh Token', '必须 32 位；扫码自动获取，或从阿里云盘网页端复制'),
      healthKey: 'refreshToken',
    },
    {
      ...secretRow('openToken', 'Open Token', '必须 280 或 335 位；需单独扫码获取 Open 授权', true),
      healthKey: 'openToken',
    },
    plainRow(
      'opentokenUrl',
      'Open Token 换取服务',
      // 说明「什么时候需要改」比「这个字段是什么」有用：
      // 绝大多数用户不用动它，扫码时会自动填好
      '扫码时自动填入，一般不用改。只有自建换取服务时才需要替换；留空会报 invalid client_id'
    ),
    plainRow('transferFolderId', '转存目录 ID', '必须 40 位；阿里云盘转存目录的 folder id')
  ])

  const pan115Rows = computed<CredentialRow[]>(() => [
    { ...secretRow('cookie115', '115 Cookie', 'UID=...; CID=...; SEID=...', true), healthKey: 'pan115' },
  ])

  const quarkRows = computed<CredentialRow[]>(() => [
    { ...secretRow('cookieQuark', '夸克 Cookie', '需包含 __pus 或 __kp', true), healthKey: 'quark' },
  ])

  const ucRows = computed<CredentialRow[]>(() => [
    { ...secretRow('cookieUc', 'UC Cookie', '需包含 __pus / __kp / __puus', true), healthKey: 'uc' },
  ])

  /**
   * 保存单个字段。
   *
   * 抛错即代表失败，EditableValue 会保持编辑态让用户修改；
   * 校验规则全在后端，前端不重复实现。
   */
  async function onEdit(key: string, value: string) {
    await saveConfig({ values: { [key]: value } })
    await loadConfig()
  }

  /** 清除单个字段（写空串即删除对应文件）。 */
  async function onClear(key: string, label: string) {
    try {
      await ElMessageBox.confirm(
        `清除后小雅将无法使用该凭据，需要重新授权。确定清除${label}？`,
        `清除${label}`,
        { type: 'warning', confirmButtonText: '清除', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
    await saveConfig({ values: { [key]: '' } })
    ElMessage.success('已清除')
    await loadConfig()
  }

  /** 阿里云盘扫码状态。 */
  const ali = reactive({
    qr: null as string | null,
    sessionId: '',
    status: 'waiting',
    loading: false,
    polling: false,
    /** 已经自动写入配置，停止轮询 */
    done: false
  })

  /** 115 扫码状态。 */
  /** 115 可选的扫码端 */
  const qrApps = ref<QrcodeApp[]>([])
  /** 默认端（后端给的是支付宝小程序） */
  const defaultQrApp = ref('alipaymini')

  const pan = reactive({
    /** 当前选中的扫码端 */
    app: 'alipaymini',
    qr: null as string | null,
    sessionId: '',
    status: 'waiting',
    loading: false,
    polling: false,
    done: false
  })

  const STATUS_TEXT: Record<string, string> = {
    waiting: '等待扫码',
    scanned: '已扫码，请在手机上确认',
    confirmed: '已确认',
    saved: '已写入配置',
    expired: '二维码已过期，请重新生成',
    cancelled: '已取消'
  }

  const aliStatusText = computed(() => STATUS_TEXT[ali.status] ?? ali.status)
  const panStatusText = computed(() => STATUS_TEXT[pan.status] ?? pan.status)

  /* ── Open Token 扫码 ─────────────────────────────────── */

  /**
   * Open Token 扫码状态机。
   *
   * 与 Refresh Token 的扫码分开：那是 Web 端登录，这是开放平台 OAuth，
   * 两步拿到的凭据用途完全不同，混在一起会让人以为扫一次就够了。
   */
  /** 转存目录选择对话框 */
  const folderVisible = ref(false)

  /** 选中目录后写入 transferFolderId 并关闭对话框。 */
  async function onFolderPicked(id: string, name: string) {
    try {
      await saveConfig({ values: { transferFolderId: id } })
      ElMessage.success(`已设置转存目录：${name}`)
      folderVisible.value = false
      await loadConfig()
    }
    catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存目录失败')
    }
  }

  const openToken = reactive({
    /** 官方二维码图片（data URL），优先展示 */
    qrImage: '',
    /** 回退用：取不到官方图片时自行编码 */
    qr: null as string | null,
    sessionId: '',
    polling: false,
    loading: false,
    status: 'idle' as 'idle' | 'waiting' | 'success' | 'expired'
  })

  const openTokenStatusText = computed(() => {
    switch (openToken.status) {
      case 'waiting':
        return '等待扫码…'
      case 'success':
        return '获取成功，已写入配置'
      case 'expired':
        return '二维码已过期，请重新生成'
      default:
        return '用阿里云盘 App 扫码'
    }
  })

  /** 生成 Open Token 二维码。 */
  async function startOpenToken() {
    openToken.loading = true
    try {
      const res = await createOpenTokenQr()
      openToken.qrImage = res.data.qrImage ?? ''
      openToken.qr = res.data.qrContent
      openToken.sessionId = res.data.sessionId
      openToken.status = 'waiting'
      void pollOpenToken()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '生成二维码失败')
    } finally {
      openToken.loading = false
    }
  }

  /** 轮询扫码结果；成功后配置已由服务端写好，这里只需刷新展示。 */
  async function pollOpenToken() {
    if (openToken.sessionId === '' || openToken.polling) return
    openToken.polling = true
    try {
      // 最多轮询 60 次 × 3 秒 ≈ 3 分钟，与二维码有效期匹配
      for (let i = 0; i < 60; i++) {
        const res = await pollOpenTokenQr(openToken.sessionId)
        const status = res.data.status
        if (status === 'success') {
          openToken.status = 'success'
          ElMessage.success('Open Token 已自动写入配置')
          await loadConfig()
          return
        }
        if (status === 'expired') {
          openToken.status = 'expired'
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
      openToken.status = 'expired'
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '查询扫码状态失败')
    } finally {
      openToken.polling = false
    }
  }

  /** 重置，允许重新生成。 */
  function resetOpenToken() {
    openToken.qrImage = ''
    openToken.qr = null
    openToken.sessionId = ''
    openToken.status = 'idle'
  }

  async function loadConfig() {
    const res = await fetchConfig()
    config.value = res.data

    /**
     * 凭据已就位时收起扫码面板。
     *
     * 否则会出现「Cookie 已写入、页面还在显示二维码等确认」的矛盾状态——
     * 用户以为没生效，实际后端早就好了。
     */
    if (res.data.secrets?.cookie115?.configured === true && pan.sessionId !== '') {
      pan.done = true
      pan.status = 'saved'
    }
    if (res.data.secrets?.refreshToken?.configured === true && ali.done === true) {
      // 阿里云盘同理：已写入就不再展示二维码
    }
  }

  /* ── 阿里云盘 ───────────────────────────────────────── */

  async function startAli() {
    ali.loading = true
    try {
      const res = await createAlipanQr()
      ali.qr = res.data.qrContent
      ali.sessionId = res.data.sessionId
      ali.status = 'waiting'
      ali.done = false
    } finally {
      ali.loading = false
    }
  }

  function resetAli() {
    ali.qr = null
    ali.sessionId = ''
    ali.status = 'waiting'
    ali.done = false
  }

  async function pollAli() {
    if (ali.sessionId === '' || ali.done) return
    ali.polling = true
    try {
      const res = await pollAlipanQr(ali.sessionId)
      const { status, saved, message } = res.data as {
        status: string
        saved?: boolean
        message?: string
      }
      ali.status = status
      if (saved === true) {
        ali.done = true
        ali.status = 'saved'
        ElMessage.success('阿里云盘令牌已自动写入配置')
        await loadConfig()
      } else if (status === 'confirmed' && saved === false && message) {
        ElMessage.warning(message)
      }
    } finally {
      ali.polling = false
    }
  }

  /* ── 115 ────────────────────────────────────────────── */

  async function start115() {
    pan.loading = true
    try {
      const res = await create115Qr(pan.app)
      pan.qr = res.data.qrContent
      pan.sessionId = res.data.sessionId
      pan.status = 'waiting'
      pan.done = false
    } finally {
      pan.loading = false
    }
  }

  function reset115() {
    pan.qr = null
    pan.sessionId = ''
    pan.status = 'waiting'
    pan.done = false
  }

  async function poll115() {
    if (pan.sessionId === '' || pan.done) return
    pan.polling = true
    try {
      const res = await poll115Qr(pan.sessionId)
      const { status, saved, message } = res.data as {
        status: string
        saved?: boolean
        message?: string
      }
      pan.status = status
      if (saved === true) {
        pan.done = true
        pan.status = 'saved'
        ElMessage.success('115 Cookie 已自动写入配置')
        await loadConfig()
      } else if (status === 'confirmed' && saved === false && message) {
        ElMessage.warning(message)
      }
    } finally {
      pan.polling = false
    }
  }

  /* ── 网盘凭据健康检测 ───────────────────────────────── */

  /**
   * 各网盘的凭据有效性。
   *
   * 只在进入页面时查一次，不做轮询：这些检测都会打到网盘官方接口，
   * 频繁请求会被限流；凭据有效期以天计，也没有盯着的必要。
   */
  const health = ref<AllCredentialsHealth | null>(null)
  const healthLoading = ref(false)

  /** 拉一次检测结果。 */
  async function loadHealth() {
    healthLoading.value = true
    try {
      const res = await fetchCredentialHealth()
      health.value = res.data
    }
    catch {
      // 检测失败不影响页面其它功能，错误提示由 HTTP 层统一弹出
    }
    finally {
      healthLoading.value = false
    }
  }

  /** 检测结果对应的标签样式。 */
  function healthTagType(status?: string): 'success' | 'danger' | 'info' {
    if (status === 'valid') return 'success'
    if (status === 'invalid') return 'danger'
    return 'info'
  }

  /** 检测结果对应的文案。 */
  function healthLabel(status?: string): string {
    if (status === 'valid') return '有效'
    if (status === 'invalid') return '已失效'
    return '未知'
  }

  /* ── 轮询 ───────────────────────────────────────────── */

  // 扫码确认是异步的（用户可能过一会儿才在手机上点确认），
  // 用轮询代替让用户反复点「刷新状态」。
  let timer: ReturnType<typeof setInterval> | undefined

  onMounted(async () => {
    await loadConfig()
    // 拉取可选登录端；失败就用内置默认值，不阻断页面
    try {
      const apps = await fetch115Apps()
      qrApps.value = apps.data.apps
      defaultQrApp.value = apps.data.defaultApp
      pan.app = apps.data.defaultApp
    }
    catch {
      qrApps.value = [{ value: 'alipaymini', label: '支付宝小程序（推荐）' }]
    }
    // 进入页面查一次凭据状态；不轮询
    void loadHealth()
    // 必须防止请求重叠：115 与阿里云的上游响应可能超过 2.5 秒，
    // 单纯 setInterval 会让未完成的请求堆积，最终把浏览器连接池占满，
    // 表现为整页「网络连接异常」。这里用 polling 标志串行化。
    timer = setInterval(() => {
      if (ali.sessionId !== '' && !ali.done && !ali.polling) void pollAli()
      if (pan.sessionId !== '' && !pan.done && !pan.polling) void poll115()
    }, 2500)
  })

  onUnmounted(() => {
    if (timer !== undefined) clearInterval(timer)
  })
</script>

<style lang="scss" scoped>
  .pan {
    // 卡片间统一 20px 间距：由容器控制，不依赖 GlassPanel 的相邻兄弟选择器
    display: flex;
    flex-direction: column;
    gap: 20px;

    // 字段名 + 有效性标签；标签跟字段走，窄屏时允许换行
    &__field {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    &__label {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    &__browse {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    &__app-picker {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
      margin-bottom: 4px;
    }

    &__app-select {
      // 固定宽度并禁止被父级 flex 压扁：之前显示成「支付...」看不清选的是哪个端
      flex: 0 0 200px;
      width: 200px;
    }

    &__scan {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
      padding: 16px;
      // 用框架的填充色变量：浅色是浅灰、深色是深灰，不会再在深色主题下露出亮块
      background: var(--el-fill-color-light);
      border-radius: 12px;
    }

    &__placeholder {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      justify-content: center;
      width: 184px;
      height: 184px;
      color: var(--el-text-color-secondary);
      background: var(--el-fill-color);
      border: 1px dashed var(--el-border-color);
      border-radius: 10px;

      p {
        margin: 0;
        font-size: 12px;
      }
    }

    &__state {
      margin: 0;
      font-size: 12px;
      color: var(--el-text-color-regular);
    }

    &__actions {
      display: flex;
      gap: 4px;
    }

    &__actions--left {
      justify-content: flex-start;
      margin-top: 12px;
    }

    &__hint {
      margin: 8px 0 0;
      font-size: 12px;
      line-height: 1.6;
      color: var(--el-text-color-secondary);
    }

    &__textarea {
      margin-top: 12px;
    }

    &__label--spaced {
      margin-top: 20px;
    }

    // 官方二维码图片与 QrCanvas 保持同样尺寸，避免三列里的码大小不一致。
    // 官方图是 430x430 的 JPEG，必须显式限宽，否则会按原尺寸撑开。
    &__qr-image {
      width: 160px;
      height: 160px;
      object-fit: contain;
      // 二维码需要白底才能被扫描器正确识别
      background: #fff;
      border-radius: 8px;
    }

    &__table {
      margin-bottom: 8px;
    }

    &__masked {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
  }
</style>
