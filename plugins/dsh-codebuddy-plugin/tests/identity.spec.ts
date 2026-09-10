import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { decodeDepartment, identityRows } from '../src/client/identity.ts'

const LABELS = {
  uid: 'UID',
  nickname: 'Nickname',
  label: 'Note',
  uin: 'UIN',
  enterprise: 'Enterprise',
  enterpriseId: 'Enterprise ID',
  enterpriseUser: 'Enterprise user',
  department: 'Department',
}

describe('decodeDepartment', () => {
  it('解码服务端的 base64 部门路径', () => {
    // 服务端按 UTF-8 字节做 base64（与设置页同一规则）。
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode('技术部')))
    expect(decodeDepartment(encoded)).toBe('技术部')
  })

  it('解码失败时原样返回，不让整行消失', () => {
    // 宁可与原文略有出入，也不要因为一个字段解析不了就丢掉该行。
    expect(decodeDepartment('not-base64!!')).toBe('not-base64!!')
    expect(decodeDepartment('')) .toBe('')
  })
})

describe('identityRows', () => {
  it('只输出有值的行，不铺占位符', () => {
    const rows = identityRows({ uid: 'u1', nickname: '昵称' }, LABELS)
    // 只有 UID 与昵称；企业/部门等缺失项不应出现「—」占位。
    expect(rows.map(r => r.key)).toEqual(['UID', 'Nickname'])
  })

  it('有值时按「标识 → 归属 → 部门」顺序展开', () => {
    const rows = identityRows({
      uid: 'u1',
      nickname: '昵称',
      uin: '12345',
      enterpriseName: '某企业',
      enterpriseId: 'ent-1',
      enterpriseUserName: '张三',
      departmentFullName: btoa(String.fromCharCode(...new TextEncoder().encode('研发部'))),
    }, LABELS)
    expect(rows.map(r => r.key)).toEqual([
      'UID', 'Nickname', 'UIN', 'Enterprise', 'Enterprise ID', 'Enterprise user', 'Department',
    ])
    expect(rows.at(-1)?.value).toBe('研发部')
  })

  it('备注名与昵称相同时不重复列出', () => {
    const same = identityRows({ uid: 'u1', nickname: '昵称', label: '昵称' }, LABELS)
    expect(same.map(r => r.key)).toEqual(['UID', 'Nickname'])
    const diff = identityRows({ uid: 'u1', nickname: '昵称', label: '我的号' }, LABELS)
    expect(diff.map(r => r.key)).toEqual(['UID', 'Nickname', 'Note'])
    expect(diff.at(-1)?.value).toBe('我的号')
  })

  it('UID 与昵称始终存在（这两项是账号的底线标识）', () => {
    const rows = identityRows({ uid: 'u', nickname: 'n' }, LABELS)
    expect(rows.some(r => r.key === 'UID' && r.value === 'u')).toBe(true)
    expect(rows.some(r => r.key === 'Nickname' && r.value === 'n')).toBe(true)
  })
})

describe('面板弹框展示完整账户信息', () => {
  const PANEL = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
    'utf8',
  )

  it('弹框标题为「账户信息」而非「资源包」', () => {
    const modal = PANEL.slice(PANEL.indexOf('function AccountResourcesModal'))
    expect(modal).toContain("title={t('accountInfoTitle')}")
    expect(modal).not.toContain("title={t('resourcesTitle')}")
  })

  it('渲染身份信息表与登录来源', () => {
    const modal = PANEL.slice(PANEL.indexOf('function AccountResourcesModal'), PANEL.indexOf('function AccountsPage'))
    expect(modal).toContain('identityRows(')
    expect(modal).toContain("t('accountIdentity')")
    // 客户端与环境决定账号连的是哪个服务平面，排查时必须能看到。
    expect(modal).toContain("t('clientLabel')")
    expect(modal).toContain("t('environmentLabel')")
  })

  it('资源包台账仍有自己的小节标题', () => {
    const modal = PANEL.slice(PANEL.indexOf('function AccountResourcesModal'), PANEL.indexOf('function AccountsPage'))
    const resIdx = modal.indexOf("t('resourcesTitle')")
    const tabsIdx = modal.indexOf('<DshTabs')
    expect(resIdx).toBeGreaterThan(-1)
    expect(resIdx).toBeLessThan(tabsIdx)
  })
})

describe('主机侧 payload 带上身份明细', () => {
  const SERVICE = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/auth-service.ts',
    'utf8',
  )

  it('forEachAccount 透出 account 明细', () => {
    // 缺它的话面板弹框只能显示昵称，与设置页信息量不一致。
    expect(SERVICE).toMatch(/account: \{\s*uid: entry\.account\.uid,/)
    expect(SERVICE).toContain('account: item.account')
  })

  it('缺失字段用条件展开，不写空串', () => {
    // 空串会被 identityRows 当成有值而渲染出一行空白。
    expect(SERVICE).toMatch(/\.\.\.entry\.account\.enterpriseId === undefined \? \{\} : \{ enterpriseId/)
  })
})
