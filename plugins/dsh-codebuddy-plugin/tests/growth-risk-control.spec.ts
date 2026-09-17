import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 风控指纹与节流口径（FNOS-005-16）。
 *
 * 这组用例守住的是一条**用户可见**的因果链：
 *
 *   出站请求缺指纹/节奏不对  →  上游受理（HTTP 200）但静默不计分
 *                            →  任务进度不动
 *                            →  用户看到「任务跑完了，实际没跑完」
 *
 * 因此它们断言的是「头与间隔是否与来源一致」，而不是「有没有发请求」——
 * 后者在错误实现里同样是 true（这正是问题长期存在的原因）。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const RISK = readFileSync(`${ROOT}/host/risk-headers.ts`, 'utf8')
const ACTIONS = readFileSync(`${ROOT}/host/growth-actions.ts`, 'utf8')
const TASKS = readFileSync(`${ROOT}/host/growth-tasks.ts`, 'utf8')
const SERVICE = readFileSync(`${ROOT}/host/auth-service.ts`, 'utf8')
const CONCURRENCY = readFileSync(`${ROOT}/host/concurrency.ts`, 'utf8')

describe('账号级指纹头', () => {
  it('带上风控闸门头 X-CodeBuddy-Request', () => {
    // 来源实测：官方客户端所有 API 请求必带，缺失可能被判为非官方客户端。
    expect(RISK).toContain("'X-CodeBuddy-Request': '1'")
    // 必须真的被行为上报与成长任务接口用上，而不是只定义在这里。
    expect(ACTIONS).toContain('accountRiskHeaders(identity)')
    expect(TASKS).toContain('accountRiskHeaders(identity)')
  })

  it('按 uid 稳定派生 X-Machine-ID / X-Session-ID（跨重启恒定、账号间互异）', () => {
    expect(RISK).toContain("'X-Machine-ID': stableDeviceId(identity, 'machine')")
    expect(RISK).toContain("'X-Session-ID': stableDeviceId(identity, 'session')")
    // 必须用哈希派生而不是随机数：随机值会让同一账号每次重启变成一台新设备，
    // 上游按设备指纹漂移做关联风控。
    expect(RISK).toContain("createHash('sha256')")
    expect(RISK).not.toMatch(/randomUUID\(\).*machine/i)
  })

  it('桌面链带来源的三段式 UA 与产品/域头', () => {
    expect(RISK).toContain("'WorkBuddy/5.5.6 WorkBuddy/5.5.6 CLI/2.137.1'")
    expect(ACTIONS).toContain("'X-Product': 'SaaS'")
    expect(ACTIONS).toContain("'User-Agent': DESKTOP_USER_AGENT")
  })

  it('企业账号带 X-Enterprise-Id / X-Tenant-Id', () => {
    expect(RISK).toMatch(/'X-Enterprise-Id': identity\.enterpriseId, 'X-Tenant-Id': identity\.enterpriseId/)
  })
})

/**
 * 节流间隔。
 *
 * 这些数字是**上游实测节奏**而不是逻辑常量，因此断言默认值本身——它们被
 * `disableGrowthThrottleForTests()` 归零后，只有这里还守着「出厂口径」。
 * 用例直接 import 真实对象，避免只做源码文本匹配（写错值也能通过）。
 */
describe('节流间隔', () => {
  it('出厂默认值与来源实测口径一致', async () => {
    const { growthThrottle } = await import('../src/host/risk-headers.ts')
    // chat_5 逐条补报 / 项间节流：对齐来源脚本实测的 1.05s。
    expect(growthThrottle.reportGapMs).toBe(1_050)
    // 专家召唤链：来源三账号实测 6s 成功率 100%。
    expect(growthThrottle.expertSummonGapMs).toBe(6_000)
    // 模板五组是五个独立的批量上报，组间 300ms。
    expect(growthThrottle.templateGapMs).toBe(300)
    // 账号之间限速（来源调度器 800ms）。
    expect(growthThrottle.accountGapMs).toBe(800)
    // 报名批间节流同 1.05s 口径。
    expect(growthThrottle.acceptGapMs).toBe(1_050)
    // 达标回读间隔（来源 claimPollGap）。
    expect(growthThrottle.pollGapMs).toBe(3_000)
  })

  it('动作实现读的是同一份可调配置，而不是各自写死数字', () => {
    // 写死数字会让「测试置 0」失效，也让口径改动要改多处。
    expect(ACTIONS).toContain('await wait(growthThrottle.reportGapMs, signal)')
    expect(ACTIONS).toContain('await wait(growthThrottle.templateGapMs, signal)')
    expect(ACTIONS).toContain('await wait(growthThrottle.expertSummonGapMs, signal)')
    expect(TASKS).toContain('await wait(growthThrottle.acceptGapMs, signal)')
    // 回读轮询同样走集中配置。
    expect(SERVICE).toContain('wait(growthThrottle.pollGapMs, signal)')
  })

  it('批量报名分片提交（一次性塞进十几个 code 属异常流量形态）', () => {
    expect(TASKS).toMatch(/const batch = 20/)
    expect(TASKS).toMatch(/taskCodes\.slice\(start, start \+ batch\)/)
  })
})

describe('任务判据与来源一致', () => {
  it('专家类任务必须用真实对话返回的服务端 requestId', () => {
    // 自造 requestId 的上报同样返回 200，但任务进度不动——这正是「跑完了但
    // 没完成」的典型成因之一。
    expect(ACTIONS).toContain('SERVER_REQUEST_ID')
    // 形状校验：`cmb-` 前缀 32 hex 或裸 32 hex。
    expect(ACTIONS).toMatch(/SERVER_REQUEST_ID = \/\^\(\?:cmb-\)\?\[0-9a-f\]\{32\}\$\//)
    expect(ACTIONS).toContain('expert chat SSE did not contain a server request id')
    // 拿不到 id 要抛错（计入失败），而不是退回一个随机值。
    expect(ACTIONS).not.toMatch(/requestId \?\?=|requestId \|\| randomUUID/)
  })

  it('Expert_lighthouse 用固定的轻量云专家与 LOCAL 判据形态', () => {
    // 之前按「取专家市场第一个」执行，id 不对因此从不计数。
    expect(ACTIONS).toContain('ex_2cvvUZQhDyeJ')
    expect(ACTIONS).toContain('localMode: true')
    // mode=LOCAL、type 为空、cost=0（对齐真实样本）。
    expect(ACTIONS).toMatch(/useEvent\.mode = 'LOCAL'/)
    expect(ACTIONS).toMatch(/useEvent\.type = ''/)
    expect(ACTIONS).toMatch(/useEvent\.cost = 0/)
  })

  it('skill_1 的 finishReason 为 tool_calls（技能加载语义）', () => {
    expect(ACTIONS).toContain("finishReason: 'tool_calls'")
    expect(ACTIONS).toContain('skill_info')
  })

  it('Library_read 用 web 域与页面元素判据（不是桌面指纹）', () => {
    expect(ACTIONS).toContain('reportWebEvent')
    expect(ACTIONS).toContain('library_doc_intro_click')
    expect(ACTIONS).toContain("'x-client-platform': 'web'")
  })

  it('template_5 发五组不同模板（而不是一组）', () => {
    expect(ACTIONS).toMatch(/深度研究/)
    expect(ACTIONS).toMatch(/代码评审/)
    expect(ACTIONS).toContain('agent_task_created_with_template')
    expect(ACTIONS).toContain('template_used')
  })

  it('Hp_Appearance 先 set 主题再上报皮肤生效事件', () => {
    const setAt = ACTIONS.indexOf('user-asset/appearance/set')
    const eventAt = ACTIONS.indexOf('appearance_skin_apply')
    expect(setAt).toBeGreaterThan(-1)
    expect(eventAt).toBeGreaterThan(setAt)
  })

  it('桌面链用完整字段集，不用最小三字段', () => {
    // 能力标志组与 token 计数都是「这条链是真的」的一致性证据。
    for (const field of ['has_repo', 'has_connector', 'has_template', 'has_expert', 'has_skill', 'inputToken', 'finishReason', 'codebuddy.session_id', 'codebuddy.conversation_request_id']) {
      expect(ACTIONS).toContain(field)
    }
  })

  it('未移植的动作明确返回 supported:false（不算完成）', () => {
    expect(ACTIONS).toMatch(/supported: false, message: '该任务动作尚未移植，暂不自动执行'/)
  })
})

describe('「跑完」与「完成」分开（FNOS-005-16-AC-06）', () => {
  it('执行结束后按账号回读真实任务状态', () => {
    // 回读是有界轮询，不是一次读取。
    expect(SERVICE).toContain('GROWTH_POLL_ATTEMPTS')
    expect(SERVICE).toMatch(/const refreshed = await listGrowthTasks\(item\.identity, signal\)/)
  })

  it('未达标如实记 pending 并带进度，不写 claimed', () => {
    const at = SERVICE.indexOf("status: 'pending'")
    expect(at).toBeGreaterThan(-1)
    const chunk = SERVICE.slice(at, at + 400)
    expect(chunk).toContain('current: latest.current')
    expect(chunk).toContain('target: latest.target')
    // 明确区分「零进度＝没开始」与「有进度＝做了一半」。
    expect(SERVICE).toMatch(/latest\.current > 0[\s\S]{0,80}已完成一半/)
    expect(SERVICE).toMatch(/进度 0\/\$\{latest\.target\}，未完成/)
  })

  it('结果里带 pending 计数，供界面如实提示', () => {
    expect(SERVICE).toContain('pending:')
    expect(SERVICE).toMatch(/pending: unfinished|unfinished = rows\.reduce/)
  })

  it('凭据过期给出可操作的原因，而不是静默跳过', () => {
    expect(SERVICE).toContain('刷新凭据已过期，请在设置页重新登录该账号')
  })
})

describe('按账号互斥（FNOS-005-15）', () => {
  it('有按账号的锁表原语，而不是只有全局 RunGuard', () => {
    expect(CONCURRENCY).toContain('export class AccountLocks')
    expect(CONCURRENCY).toMatch(/tryAcquire\(id: string\)/)
    // 释放必须幂等（重复 release 不得误清后续占用者）。
    expect(CONCURRENCY).toMatch(/if \(record\.released\) return/)
  })

  it('服务用账号锁而不是全局锁保护成长任务', () => {
    expect(SERVICE).toContain('private readonly growthAccountLocks = new AccountLocks')
    expect(SERVICE).toContain('this.growthAccountLocks.tryAcquire(')
    // 全局 guard 只保护「全部账号」这一个入口本身。
    expect(SERVICE).toMatch(/growthRunAll[\s\S]{0,200}growthTasksGuard\.tryAcquire\(\)/)
  })

  it('单账号一键完成走独立 RPC，只锁该账号', () => {
    expect(SERVICE).toContain('async growthRunAccount(id: string')
    expect(SERVICE).toContain("case 'growthRunAccount'")
    // 该账号已被占用时返回冲突而不是排队。
    expect(SERVICE).toMatch(/该账号已有成长任务在执行/)
  })

  it('全量执行遇到已被占用的账号是跳过（不是整轮失败）', () => {
    expect(SERVICE).toMatch(/status: 'skipped'[\s\S]{0,120}该账号已有成长任务在执行，本轮跳过/)
  })

  it('运行态同时记录在跑账号集合与单项任务明细', () => {
    expect(SERVICE).toContain('growthRunRegistry.add(item.id)')
    expect(SERVICE).toMatch(/growthRunRegistry\.remove\(item\.id\)/)
    const HOST = readFileSync(`${ROOT}/host/growth-run.ts`, 'utf8')
    expect(HOST).toContain('accountIds')
    expect(HOST).toContain('taskCodes')
    // 权威是进程内登记表：磁盘只反映最后一次写入，表达不了并行账号。
    expect(HOST).toContain('export const growthRunRegistry')
    expect(HOST).toContain('export function mergeGrowthRunState')
  })
})
