/**
 * 本地 ESLint 插件：fnOS 应用无扩展名 JSON 配置的结构校验。
 *
 * 覆盖两类文件（均为 JSON 内容、无扩展名，编辑器与常规工具盯不住）：
 * - apps/<app>/app/ui/config —— fnOS 桌面入口配置（.url 键下的入口表）
 * - apps/<app>/wizard/ 下的安装、卸载、配置向导表单（步骤数组，每步含 items）
 *
 * 语法合法性由 eslint.config.ts 中相应规则块的 language: 'jsonc/x'
 * （eslint-plugin-jsonc 内置语言实现，随 antfu 的 jsonc 选项启用）承担，
 * 解析失败即 fatal parse error。本插件只负责结构不变量。
 * 规则全部以 AST 节点为准，报错带行列。
 *
 * @module eslint-plugin-json-config
 */
import type { Rule } from 'eslint'
import type { AST } from 'jsonc-eslint-parser'

/** 读取属性节点的键名（标识符键与字符串键统一为字符串）。 */
function getKeyName(prop: AST.JSONProperty): string | null {
  const key = prop.key
  if (key.type === 'JSONIdentifier') return key.name
  if (key.type === 'JSONLiteral') return typeof key.value === 'string' ? key.value : String(key.value)
  return null
}

/** 一个 JSON 对象节点上某个 key 对应的值节点。 */
function propOf(node: AST.JSONObjectExpression, key: string): AST.JSONProperty | undefined {
  return node.properties.find(p => getKeyName(p) === key)
}

/** 把 JSON 值节点还原为静态值（配置均为静态 JSON，无需求值语义）。 */
function staticValue(node: AST.JSONProperty['value']): unknown {
  switch (node.type) {
    case 'JSONLiteral': return node.value
    case 'JSONObjectExpression':
      return Object.fromEntries(node.properties.map(p => [getKeyName(p), staticValue(p.value)]))
    case 'JSONArrayExpression':
      return node.elements.map(e => (e ? staticValue(e) : undefined))
    default: return undefined
  }
}

/** 向导表单项的合法 type 集合（覆盖仓库现有全部用法，见 fnnas-docs 用户向导文档）。 */
const WIZARD_ITEM_TYPES = ['text', 'password', 'select', 'radio', 'switch', 'tips'] as const

const uiConfigRule: Rule.RuleModule = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    return {
      JSONExpressionStatement(root: AST.JSONExpressionStatement) {
        const doc = root.expression
        if (doc.type !== 'JSONObjectExpression') {
          context.report({ node: doc, message: 'ui/config 顶层必须是 JSON 对象（含 .url 键）' })
          return
        }
        const dotUrl = propOf(doc, '.url')
        // 空对象是纯后台/命令行应用的合法形态（无桌面入口）。
        if (dotUrl === undefined && doc.properties.length === 0) return
        if (!dotUrl || dotUrl.value.type !== 'JSONObjectExpression') {
          context.report({ node: dotUrl ?? doc, message: 'ui/config 缺少 .url 入口表' })
          return
        }
        // 应用名来自路径 apps/<appname>/app/ui/config，用于校验入口键前缀。
        // context.filename 是绝对路径，按 apps/ 目录段取应用名。
        const appname = /[/\\]apps[/\\]([^/\\]+)[/\\]app[/\\]ui[/\\]config$/.exec(context.filename)?.[1] ?? ''
        for (const entry of dotUrl.value.properties) {
          const key = getKeyName(entry)
          if (key === null) continue
          if (entry.value.type !== 'JSONObjectExpression') {
            context.report({ node: entry, message: `入口 ${key} 必须是对象` })
            continue
          }
          if (!key.startsWith(`${appname}.`))
            context.report({ node: entry.key, message: `入口键 ${key} 应以应用名 ${appname}. 开头` })

          const value = entry.value
          if (!propOf(value, 'title'))
            context.report({ node: entry.key, message: `入口 ${key} 缺少 title` })
          if (!propOf(value, 'icon'))
            context.report({ node: entry.key, message: `入口 ${key} 缺少 icon` })

          const type = propOf(value, 'type')
          const typeValue = type ? staticValue(type.value) : undefined
          if (typeof typeValue !== 'string' || !['url', 'iframe'].includes(typeValue)) {
            context.report({
              node: type?.key ?? entry.key,
              message: `入口 ${key} 的 type 必须是 url 或 iframe（当前：${JSON.stringify(typeValue)}）`,
            })
          }
        }
      },
    }
  },
}

const wizardRule: Rule.RuleModule = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    let entered = false
    return {
      // 顶层只有一条表达式语句；守卫防止未来出现多条时重复校验。
      JSONExpressionStatement(root: AST.JSONExpressionStatement) {
        if (entered) return
        entered = true
        const doc = root.expression
        if (doc.type !== 'JSONArrayExpression') {
          context.report({ node: doc, message: 'wizard 顶层必须是步骤数组' })
          return
        }
        validateWizardSteps(context, doc)
      },
    }
  },
}

function validateWizardSteps(context: Rule.RuleContext, doc: AST.JSONArrayExpression): void {
  const seenFields = new Set<string>()
  for (const stepNode of doc.elements) {
    if (!stepNode || stepNode.type !== 'JSONObjectExpression') {
      context.report({ node: stepNode ?? doc, message: '向导步骤必须是对象' })
      continue
    }
    if (!propOf(stepNode, 'stepTitle'))
      context.report({ node: stepNode, message: '步骤缺少 stepTitle' })

    const items = propOf(stepNode, 'items')
    if (!items || items.value.type !== 'JSONArrayExpression') {
      context.report({ node: items?.key ?? stepNode, message: '步骤缺少 items 数组' })
      continue
    }
    for (const itemNode of items.value.elements) {
      if (!itemNode || itemNode.type !== 'JSONObjectExpression') {
        context.report({ node: itemNode ?? items.value, message: '表单项必须是对象' })
        continue
      }
      validateWizardItem(context, itemNode, seenFields)
    }
  }
}

function validateWizardItem(
  context: Rule.RuleContext,
  item: AST.JSONObjectExpression,
  seenFields: Set<string>,
): void {
  const typeProp = propOf(item, 'type')
  const itemType = typeProp ? staticValue(typeProp.value) : undefined
  if (typeof itemType !== 'string' || !(WIZARD_ITEM_TYPES as readonly string[]).includes(itemType)) {
    context.report({
      node: typeProp?.key ?? item,
      message: `表单项 type 非法：${JSON.stringify(itemType)}（合法：${WIZARD_ITEM_TYPES.join(' / ')}）`,
    })
    return
  }

  // tips 是纯提示文案，不收集字段；其余项必须有 field + label。
  if (itemType === 'tips') {
    if (!propOf(item, 'helpText'))
      context.report({ node: item, message: 'tips 项缺少 helpText' })
    return
  }

  const fieldProp = propOf(item, 'field')
  const fieldValue = fieldProp ? staticValue(fieldProp.value) : undefined
  if (typeof fieldValue !== 'string' || fieldValue === '') {
    context.report({ node: fieldProp?.key ?? item, message: `${itemType} 项缺少 field` })
    return
  }
  if (seenFields.has(fieldValue)) {
    context.report({ node: fieldProp?.key ?? item, message: `field ${fieldValue} 在同向导中重复` })
    return
  }
  seenFields.add(fieldValue)

  if (!propOf(item, 'label'))
    context.report({ node: fieldProp?.key ?? item, message: `field ${fieldValue} 缺少 label` })

  // select/radio 必须有 options；值需唯一，initValue（若有）必须落在选项内。
  if (itemType === 'select' || itemType === 'radio')
    validateOptions(context, item, fieldValue)

  // rules 数组：message 必须存在，pattern 必须可编译。
  validateRules(context, item, fieldValue)
}

function validateOptions(
  context: Rule.RuleContext,
  item: AST.JSONObjectExpression,
  fieldValue: string,
): void {
  const optionsProp = propOf(item, 'options')
  if (!optionsProp || optionsProp.value.type !== 'JSONArrayExpression') {
    context.report({ node: optionsProp?.key ?? item, message: `field ${fieldValue}（select/radio）缺少 options 数组` })
    return
  }
  const values: unknown[] = []
  for (const opt of optionsProp.value.elements) {
    if (!opt || opt.type !== 'JSONObjectExpression') {
      context.report({ node: opt ?? optionsProp.value, message: `field ${fieldValue} 的 option 必须是对象` })
      continue
    }
    if (!propOf(opt, 'label'))
      context.report({ node: opt, message: `field ${fieldValue} 的 option 缺少 label` })
    const valueProp = propOf(opt, 'value')
    if (!valueProp)
      context.report({ node: opt, message: `field ${fieldValue} 的 option 缺少 value` })
    else
      values.push(staticValue(valueProp.value))
  }
  if (new Set(values).size !== values.length)
    context.report({ node: optionsProp.key, message: `field ${fieldValue} 的 option value 存在重复` })

  const initProp = propOf(item, 'initValue')
  if (initProp) {
    const initValue = staticValue(initProp.value)
    // 空串是「留空走默认」的合法语义（fnOS 向导 select 支持 helpText 兜底说明）。
    if (initValue !== undefined && initValue !== '' && !values.includes(initValue)) {
      context.report({
        node: initProp.key,
        message: `field ${fieldValue} 的 initValue ${JSON.stringify(initValue)} 不在 options 中`,
      })
    }
  }
}

function validateRules(
  context: Rule.RuleContext,
  item: AST.JSONObjectExpression,
  fieldValue: string,
): void {
  const rulesProp = propOf(item, 'rules')
  if (!rulesProp || rulesProp.value.type !== 'JSONArrayExpression') return
  for (const ruleNode of rulesProp.value.elements) {
    if (!ruleNode || ruleNode.type !== 'JSONObjectExpression') {
      context.report({ node: ruleNode ?? rulesProp.value, message: `field ${fieldValue} 的 rule 必须是对象` })
      continue
    }
    if (!propOf(ruleNode, 'message'))
      context.report({ node: ruleNode, message: `field ${fieldValue} 的 rule 缺少 message` })

    const pattern = propOf(ruleNode, 'pattern')
    if (pattern) {
      const patternValue = staticValue(pattern.value)
      if (typeof patternValue === 'string') {
        try {
          void new RegExp(patternValue)
        }
        catch {
          context.report({ node: pattern.key, message: `field ${fieldValue} 的 pattern 无法编译：${patternValue}` })
        }
      }
    }
  }
}

export const plugin = {
  meta: { name: 'eslint-plugin-json-config' },
  rules: {
    'ui-config': uiConfigRule,
    'wizard': wizardRule,
  },
}
