/** Keep Codex-specific fields out of the generic pi-ai editor. */

const CODEX_EDITOR_ATTRIBUTE = 'data-dsh-codex-auth-editor'
const CODEX_ROUTE = 'openai-codex'
const CODEX_PICKER_ATTRIBUTE = 'data-dsh-codex-model-picker'
const SELECT_ALL_ATTRIBUTE = 'data-dsh-codex-select-all'
const ADD_BUTTON_ATTRIBUTE = 'data-dsh-codex-add-models'
const REMOVE_MANUAL_ADD_ATTRIBUTE = 'data-dsh-codex-remove-manual-add'
const PICKER_SELECTION_SYNCED_ATTRIBUTE = 'data-dsh-codex-selection-synced'
const MODEL_ACTION_ATTRIBUTE = 'data-dsh-codex-model-action'
const MODEL_DETAILS_ATTRIBUTE = 'data-dsh-codex-model-details'
const STYLE_ID = 'dsh-codex-auth-model-editor'

type ModelAction = 'fetch' | 'reset'

const FETCH_MODEL_LABELS = new Set(['获取可用模型', '获取模型', 'Fetch available models', 'Fetch models'])
const MODEL_ACTION_LABELS = new Map<string, { action: ModelAction; replacement: string }>([
  ['获取可用模型', { action: 'fetch', replacement: '获取模型' }],
  ['获取模型', { action: 'fetch', replacement: '获取模型' }],
  ['Fetch available models', { action: 'fetch', replacement: 'Fetch models' }],
  ['Fetch models', { action: 'fetch', replacement: 'Fetch models' }],
  ['恢复默认模型', { action: 'reset', replacement: '恢复模型' }],
  ['恢复模型', { action: 'reset', replacement: '恢复模型' }],
  ['Restore defaults', { action: 'reset', replacement: 'Restore models' }],
  ['Restore models', { action: 'reset', replacement: 'Restore models' }],
])
const PICKER_TITLE_LABELS = new Set(['选择要添加的模型', '模型列表', 'Select models to add', 'Model list'])
const ADD_MODEL_LABELS = new Set(['添加所选', '确定', 'Add selected', 'Confirm'])
const MANUAL_ADD_MODEL_LABELS = new Set(['添加模型', 'Add model'])
const REMOVE_MODEL_LABELS = ['移除模型', '删除模型', 'Remove model', 'Delete model']

/** Defaults from the installed pi-ai openai-codex catalog (0.82.1). */
const CODEX_MODEL_DEFAULTS: Readonly<Record<string, { contextWindow: number; maxTokens: number }>> = {
  'gpt-5.3-codex-spark': { contextWindow: 128_000, maxTokens: 128_000 },
  'gpt-5.4': { contextWindow: 272_000, maxTokens: 128_000 },
  'gpt-5.4-mini': { contextWindow: 272_000, maxTokens: 128_000 },
  'gpt-5.5': { contextWindow: 272_000, maxTokens: 128_000 },
  'gpt-5.6-luna': { contextWindow: 272_000, maxTokens: 128_000 },
  'gpt-5.6-sol': { contextWindow: 272_000, maxTokens: 128_000 },
  'gpt-5.6-terra': { contextWindow: 272_000, maxTokens: 128_000 },
}

const MODEL_ID_LABELS = ['模型 ID', 'Model ID']
const MODEL_NAME_LABELS = ['显示名称', 'Display name', '模型名称', 'Model name']
const MODEL_READONLY_LABELS = [...MODEL_ID_LABELS, ...MODEL_NAME_LABELS]
const MODEL_CONTEXT_LABELS = ['上下文窗口', 'Context window']
const MODEL_MAX_TOKENS_LABELS = ['最大输出 token', 'Max output tokens']

function labelOf(input: HTMLInputElement): string {
  return input.getAttribute('aria-label')?.trim() ?? ''
}

function startsWithAny(value: string, prefixes: readonly string[]): boolean {
  return prefixes.some(prefix => value.startsWith(prefix))
}

function rowNumberOf(input: HTMLInputElement): number | undefined {
  const match = labelOf(input).match(/(\d+)$/u)
  if (match === null) return undefined
  const value = Number(match[1])
  return Number.isInteger(value) && value > 0 ? value : undefined
}

function formatCapacity(value: number): string {
  return value % 1_000 === 0 ? `${value / 1_000}K` : String(value)
}

function modelIdInputs(editor: HTMLElement): HTMLInputElement[] {
  return [...editor.querySelectorAll<HTMLInputElement>('input')]
    .filter(input => startsWithAny(labelOf(input), MODEL_ID_LABELS))
}

function modelIds(editor: HTMLElement): Set<string> {
  return new Set(modelIdInputs(editor)
    .map(input => input.value.trim())
    .filter(value => value.length > 0))
}

function candidateId(input: HTMLInputElement): string | undefined {
  const label = input.closest('label')
  const sibling = input.nextElementSibling
  const value = sibling?.textContent?.trim() || label?.querySelector('span')?.textContent?.trim()
  return value === undefined || value.length === 0 ? undefined : value
}

/**
 * The official Models page intentionally shares one pi-ai editor between all
 * providers. Codex gets its endpoint and credential from OAuth, so those two
 * generic inputs would be misleading. Mark only the Codex editor and hide the
 * corresponding field wrappers; the model catalog remains the official editor.
 */
export function installCodexModelEditorPresentation(): () => void {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> input[aria-label="API 密钥"]),
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> input[aria-label="API Key"]),
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> input[aria-label="API 地址"]),
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> input[aria-label="API URL"]) {
  display: none !important;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] [${ADD_BUTTON_ATTRIBUTE}="true"] {
  border: 0 !important;
  background: var(--dsw-alias-button-primary-fill) !important;
  color: var(--dsw-alias-label-primary-foreground) !important;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] [${ADD_BUTTON_ATTRIBUTE}="true"]:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover) !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${REMOVE_MANUAL_ADD_ATTRIBUTE}="true"] {
  display: none !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"] > summary {
  display: none !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"] {
  display: contents !important;
  border: 0 !important;
  padding: 0 !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"] > :not(summary) {
  display: contents !important;
  border: 0 !important;
  padding: 0 !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"] > :not(summary) > section[aria-label="模型目录"],
[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"] > :not(summary) > section[aria-label="Models"] {
  border-top: 0 !important;
  padding-top: 0 !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"]:not([open]) > :not(summary) {
  display: contents !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="fetch"],
[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="reset"] {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="fetch"]:hover:not(:disabled),
[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="reset"]:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-solid);
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="fetch"]:disabled,
[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="reset"]:disabled {
  opacity: 0.4;
  cursor: default;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> [${MODEL_ACTION_ATTRIBUTE}="fetch"]),
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> [${MODEL_ACTION_ATTRIBUTE}="reset"]) {
  justify-content: flex-start;
  align-items: center;
  gap: 15px;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> [${MODEL_ACTION_ATTRIBUTE}="reset"]) > [${MODEL_ACTION_ATTRIBUTE}="reset"],
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:not(:has(> [${MODEL_ACTION_ATTRIBUTE}="reset"])):has(> [${MODEL_ACTION_ATTRIBUTE}="fetch"]) > [${MODEL_ACTION_ATTRIBUTE}="fetch"] {
  margin-left: auto;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] [${SELECT_ALL_ATTRIBUTE}="true"] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] input[type="checkbox"] {
  flex: none;
  width: 16px;
  height: 16px;
  margin: 3px 0 0;
  accent-color: var(--dsw-alias-button-primary-fill);
  cursor: pointer;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--dsw-alias-border-l4);
  outline-offset: 2px;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] input[type="checkbox"]:disabled {
  cursor: default;
}
`
  document.head.appendChild(style)

  let codexPickerPending = false
  const originalPlaceholders = new Map<HTMLInputElement, string>()
  const originalModelNameAttributes = new Map<HTMLInputElement, { readOnly: boolean; ariaReadOnly: string | null }>()
  const originalModelActionMarkup = new Map<HTMLButtonElement, { label: string; html: string }>()
  const originalModelDetailsOpen = new Map<HTMLDetailsElement, boolean>()
  const originalPickerCopy = new Map<HTMLElement, { ariaLabel: string | null; title: string | null; description: string | null }>()
  let pickerConfirmWorking = false
  let pickerConfirmReplay = false

  const restoreModelNameInput = (input: HTMLInputElement, original: { readOnly: boolean; ariaReadOnly: string | null }): void => {
    input.readOnly = original.readOnly
    if (original.ariaReadOnly === null) input.removeAttribute('aria-readonly')
    else input.setAttribute('aria-readonly', original.ariaReadOnly)
  }

  const markModelNameInputsReadonly = (): void => {
    const current = new Set<HTMLInputElement>()
    for (const input of document.querySelectorAll<HTMLInputElement>('input')) {
      if (!startsWithAny(labelOf(input), MODEL_READONLY_LABELS)) continue
      current.add(input)
      if (!originalModelNameAttributes.has(input)) {
        originalModelNameAttributes.set(input, {
          readOnly: input.readOnly,
          ariaReadOnly: input.getAttribute('aria-readonly'),
        })
      }
      input.readOnly = true
      input.setAttribute('aria-readonly', 'true')
    }
    for (const [input, original] of originalModelNameAttributes) {
      if (current.has(input)) continue
      restoreModelNameInput(input, original)
      originalModelNameAttributes.delete(input)
    }
  }

  const markManualAddButtons = (editor: HTMLElement): void => {
    for (const button of editor.querySelectorAll<HTMLButtonElement>('button')) {
      if (MANUAL_ADD_MODEL_LABELS.has(button.textContent?.trim() ?? '')) {
        button.setAttribute(REMOVE_MANUAL_ADD_ATTRIBUTE, 'true')
      } else {
        button.removeAttribute(REMOVE_MANUAL_ADD_ATTRIBUTE)
      }
    }
  }

  const restoreModelActionButtons = (editor: HTMLElement): void => {
    for (const [button, original] of originalModelActionMarkup) {
      if (!editor.contains(button)) continue
      button.innerHTML = original.html
      button.removeAttribute(MODEL_ACTION_ATTRIBUTE)
      originalModelActionMarkup.delete(button)
    }
  }

  const markModelActionButtons = (editor: HTMLElement): void => {
    const active = new Set<HTMLButtonElement>()
    for (const button of editor.querySelectorAll<HTMLButtonElement>('button')) {
      const original = originalModelActionMarkup.get(button)
      const sourceLabel = original?.label ?? button.textContent?.trim() ?? ''
      const action = MODEL_ACTION_LABELS.get(sourceLabel)
      if (action === undefined) continue
      if (original === undefined) {
        originalModelActionMarkup.set(button, {
          label: sourceLabel,
          html: button.innerHTML,
        })
      }
      active.add(button)
      button.setAttribute(MODEL_ACTION_ATTRIBUTE, action.action)
      if (button.textContent !== action.replacement) button.textContent = action.replacement
    }
    for (const [button, original] of originalModelActionMarkup) {
      if (active.has(button)) continue
      if (editor.contains(button)) {
        button.innerHTML = original.html
        button.removeAttribute(MODEL_ACTION_ATTRIBUTE)
      }
      originalModelActionMarkup.delete(button)
    }
  }

  const restoreCapacityPlaceholders = (editor: HTMLElement): void => {
    for (const [input, placeholder] of originalPlaceholders) {
      if (!editor.contains(input)) continue
      input.placeholder = placeholder
      originalPlaceholders.delete(input)
    }
  }

  const markOfficialCapacityPlaceholders = (editor: HTMLElement): void => {
    const idsByRow = new Map<number, string>()
    for (const input of modelIdInputs(editor)) {
      const row = rowNumberOf(input)
      const id = input.value.trim()
      if (row !== undefined && id.length > 0) idsByRow.set(row, id)
    }

    for (const input of editor.querySelectorAll<HTMLInputElement>('input')) {
      const row = rowNumberOf(input)
      if (row === undefined) continue
      const label = labelOf(input)
      const field = startsWithAny(label, MODEL_CONTEXT_LABELS)
        ? 'contextWindow'
        : startsWithAny(label, MODEL_MAX_TOKENS_LABELS)
          ? 'maxTokens'
          : undefined
      if (field === undefined) continue
      const defaults = CODEX_MODEL_DEFAULTS[idsByRow.get(row) ?? '']
      if (defaults === undefined) {
        if (originalPlaceholders.has(input)) {
          input.placeholder = originalPlaceholders.get(input) ?? ''
          originalPlaceholders.delete(input)
        }
        continue
      }
      if (!originalPlaceholders.has(input)) originalPlaceholders.set(input, input.placeholder)
      input.placeholder = formatCapacity(defaults[field])
    }
  }

  const restoreModelDetails = (editor: HTMLElement): void => {
    for (const [details, originalOpen] of originalModelDetailsOpen) {
      if (!editor.contains(details)) continue
      details.open = originalOpen
      details.removeAttribute(MODEL_DETAILS_ATTRIBUTE)
      originalModelDetailsOpen.delete(details)
    }
  }

  const markModelDetails = (editor: HTMLElement): void => {
    const catalog = editor.querySelector<HTMLElement>(
      'section[aria-label="模型目录"], section[aria-label="Models"]',
    )
    const details = catalog?.closest<HTMLDetailsElement>('details')
      ?? [...editor.querySelectorAll<HTMLDetailsElement>('details')]
        .find(candidate => modelIdInputs(candidate).length > 0)
    if (details === undefined) {
      restoreModelDetails(editor)
      return
    }
    if (!originalModelDetailsOpen.has(details)) originalModelDetailsOpen.set(details, details.open)
    details.setAttribute(MODEL_DETAILS_ATTRIBUTE, 'true')
    details.open = true
    for (const [other, originalOpen] of originalModelDetailsOpen) {
      if (other === details || !editor.contains(other)) continue
      other.open = originalOpen
      other.removeAttribute(MODEL_DETAILS_ATTRIBUTE)
      originalModelDetailsOpen.delete(other)
    }
  }

  const markEditors = (): void => {
    const matched = new Set<HTMLElement>()
    for (const route of document.querySelectorAll<HTMLElement>('span')) {
      if (route.textContent?.trim() !== CODEX_ROUTE) continue
      const header = route.parentElement
      const editor = header?.parentElement
      if (editor === null || editor === undefined) continue
      if (!editor.querySelector('input[aria-label="API 密钥"], input[aria-label="API Key"]')) continue
      matched.add(editor)
      if (editor.getAttribute(CODEX_EDITOR_ATTRIBUTE) !== 'true') {
        editor.setAttribute(CODEX_EDITOR_ATTRIBUTE, 'true')
      }
      markManualAddButtons(editor)
      markModelActionButtons(editor)
      markOfficialCapacityPlaceholders(editor)
      markModelDetails(editor)
    }
    for (const editor of document.querySelectorAll<HTMLElement>(`[${CODEX_EDITOR_ATTRIBUTE}]`)) {
      if (!matched.has(editor)) {
        editor.removeAttribute(CODEX_EDITOR_ATTRIBUTE)
        markManualAddButtons(editor)
        restoreModelActionButtons(editor)
        restoreCapacityPlaceholders(editor)
        restoreModelDetails(editor)
      }
    }
  }

  const pickerIsChinese = (dialog: HTMLElement): boolean => {
    const original = originalPickerCopy.get(dialog)
    return original?.ariaLabel === '选择要添加的模型'
      || original?.title === '选择要添加的模型'
      || dialog.getAttribute('aria-label') === '模型列表'
  }

  const isModelPicker = (dialog: HTMLElement): boolean => {
    if (dialog.getAttribute(CODEX_PICKER_ATTRIBUTE) === 'true') return true
    const label = dialog.getAttribute('aria-label')?.trim()
    return label !== undefined && PICKER_TITLE_LABELS.has(label)
  }

  const pickerSelectedModelIds = (dialog: HTMLElement): Set<string> => {
    const candidateList = dialog.querySelector<HTMLUListElement>('ul')
    if (candidateList === null) return new Set()
    return new Set([...candidateList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
      .filter(input => input.checked)
      .map(candidateId)
      .filter((id): id is string => id !== undefined && id.length > 0))
  }

  const removeButtonForModelInput = (input: HTMLInputElement): HTMLButtonElement | undefined => {
    const row = input.parentElement
    if (row === null) return undefined
    return [...row.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => REMOVE_MODEL_LABELS.some(label => (button.getAttribute('aria-label') ?? '').trim().startsWith(label)))
  }

  const uncheckedModelRows = (dialog: HTMLElement): Array<{ input: HTMLInputElement; remove: HTMLButtonElement }> => {
    const editor = document.querySelector<HTMLElement>(`[${CODEX_EDITOR_ATTRIBUTE}="true"]`)
    if (editor === null) return []
    const selected = pickerSelectedModelIds(dialog)
    return modelIdInputs(editor)
      .map((input, index) => ({ input, index, id: input.value.trim(), remove: removeButtonForModelInput(input) }))
      .filter((row): row is { input: HTMLInputElement; index: number; id: string; remove: HTMLButtonElement } => (
        !selected.has(row.id) && row.remove !== undefined
      ))
      .sort((left, right) => right.index - left.index)
      .map(({ input, remove }) => ({ input, remove }))
  }

  const waitForPickerRender = (): Promise<void> => new Promise(resolve => { window.setTimeout(resolve, 0) })

  /** Remove unchecked rows one at a time so each React draft update is committed before the next one. */
  const removeUncheckedModelRows = async (dialog: HTMLElement): Promise<boolean> => {
    let removed = false
    for (let attempt = 0; attempt < 128; attempt += 1) {
      const next = uncheckedModelRows(dialog)[0]
      if (next === undefined) return removed
      if (next.remove.disabled || !next.remove.isConnected) return removed
      next.remove.click()
      removed = true
      await waitForPickerRender()
    }
    return removed
  }

  const isPickerConfirmButton = (button: HTMLButtonElement): boolean => {
    const dialog = button.closest<HTMLElement>('[role="dialog"]')
    if (dialog === null || dialog.getAttribute(CODEX_PICKER_ATTRIBUTE) !== 'true') return false
    return button.getAttribute(ADD_BUTTON_ATTRIBUTE) === 'true'
      || ADD_MODEL_LABELS.has(button.textContent?.trim() ?? '')
  }

  const isCodexFetchButton = (button: HTMLButtonElement): boolean => {
    if (button.getAttribute(MODEL_ACTION_ATTRIBUTE) === 'fetch') return true
    if (!FETCH_MODEL_LABELS.has(button.textContent?.trim() ?? '')) return false
    return button.closest(`[${CODEX_EDITOR_ATTRIBUTE}="true"]`) !== null
  }

  const syncPickerSelection = (dialog: HTMLElement, candidateList: HTMLUListElement): boolean => {
    if (dialog.getAttribute(PICKER_SELECTION_SYNCED_ATTRIBUTE) === 'true') return true
    const editor = document.querySelector<HTMLElement>(`[${CODEX_EDITOR_ATTRIBUTE}="true"]`)
    if (editor === null) return false
    const candidates = [...candidateList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
    if (candidates.length === 0) return false
    const configured = modelIds(editor)
    for (const candidate of candidates) {
      const id = candidateId(candidate)
      if (id === undefined) return false
      const shouldBeChecked = configured.has(id)
      if (candidate.checked !== shouldBeChecked) candidate.click()
    }
    dialog.setAttribute(PICKER_SELECTION_SYNCED_ATTRIBUTE, 'true')
    return true
  }

  const enhancePicker = (dialog: HTMLElement): void => {
    if (!isModelPicker(dialog)) return
    dialog.setAttribute(CODEX_PICKER_ATTRIBUTE, 'true')

    const original = originalPickerCopy.get(dialog) ?? {
      ariaLabel: dialog.getAttribute('aria-label'),
      title: dialog.querySelector('h2')?.textContent ?? null,
      description: dialog.querySelector('p')?.textContent ?? null,
    }
    if (!originalPickerCopy.has(dialog)) originalPickerCopy.set(dialog, original)
    const chinese = pickerIsChinese(dialog)
    const title = chinese ? '模型列表' : 'Model list'
    const description = chinese
      ? '请选择需要保留的模型；未勾选的模型将从模型目录移除。'
      : 'Select the models to keep; unchecked models will be removed from the model catalog.'
    if (dialog.getAttribute('aria-label') !== title) dialog.setAttribute('aria-label', title)
    const heading = dialog.querySelector('h2')
    if (heading !== null && heading.textContent !== title) heading.textContent = title
    const descriptionNode = dialog.querySelector('p')
    if (descriptionNode !== null && descriptionNode.textContent !== description) descriptionNode.textContent = description

    const candidateList = dialog.querySelector<HTMLUListElement>('ul')
    if (candidateList === null) return

    syncPickerSelection(dialog, candidateList)

    let selectAll = dialog.querySelector<HTMLInputElement>(`[${SELECT_ALL_ATTRIBUTE}="true"]`)
    if (selectAll === null) {
      const wrapper = document.createElement('label')
      wrapper.setAttribute(SELECT_ALL_ATTRIBUTE, 'true')
      selectAll = document.createElement('input')
      selectAll.type = 'checkbox'
      selectAll.setAttribute('aria-label', chinese ? '全选' : 'Select all')
      const label = document.createElement('span')
      label.textContent = chinese ? '全选' : 'Select all'
      wrapper.append(selectAll, label)
      candidateList.before(wrapper)
      selectAll.addEventListener('change', () => {
        const checked = selectAll?.checked ?? false
        for (const candidate of candidateList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
          if (candidate.checked !== checked) candidate.click()
        }
        window.setTimeout(syncSelectAll, 0)
      })
    }

    const syncSelectAll = (): void => {
      if (selectAll === null) return
      const candidates = [...candidateList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
      const selected = candidates.filter(candidate => candidate.checked).length
      selectAll.disabled = candidates.length === 0
      selectAll.checked = candidates.length > 0 && selected === candidates.length
      selectAll.indeterminate = selected > 0 && selected < candidates.length
    }

    if (candidateList.dataset.dshCodexSelectAllBound !== 'true') {
      candidateList.dataset.dshCodexSelectAllBound = 'true'
      candidateList.addEventListener('change', syncSelectAll)
    }
    syncSelectAll()

    const addButton = dialog.querySelector<HTMLButtonElement>(`[${ADD_BUTTON_ATTRIBUTE}="true"]`)
      ?? [...dialog.querySelectorAll<HTMLButtonElement>('button')]
        .find(button => ADD_MODEL_LABELS.has(button.textContent?.trim() ?? ''))
    if (addButton !== undefined) {
      addButton.setAttribute(ADD_BUTTON_ATTRIBUTE, 'true')
      const replacement = chinese ? '确定' : 'Confirm'
      if (addButton.textContent !== replacement) addButton.textContent = replacement
    }
  }

  const updatePickers = (): void => {
    markModelNameInputsReadonly()
    markEditors()
    for (const [dialog] of originalPickerCopy) {
      if (!document.contains(dialog)) originalPickerCopy.delete(dialog)
    }
    const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
    const activePicker = dialogs.find(isModelPicker)
    if (activePicker !== undefined && codexPickerPending) {
      enhancePicker(activePicker)
      codexPickerPending = false
    }
    for (const dialog of dialogs) {
      if (dialog.getAttribute(CODEX_PICKER_ATTRIBUTE) === 'true') enhancePicker(dialog)
    }
  }

  const onClick = (event: MouseEvent): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>('button')
    if (button !== null && isPickerConfirmButton(button)) {
      if (pickerConfirmReplay) {
        pickerConfirmReplay = false
        return
      }
      if (pickerConfirmWorking) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      const dialog = button.closest<HTMLElement>('[role="dialog"]')
      if (dialog !== null && uncheckedModelRows(dialog).length > 0) {
        event.preventDefault()
        event.stopPropagation()
        pickerConfirmWorking = true
        void removeUncheckedModelRows(dialog).then((removed) => {
          pickerConfirmWorking = false
          if (!removed) return
          window.setTimeout(() => {
            const current = dialog.querySelector<HTMLButtonElement>(`[${ADD_BUTTON_ATTRIBUTE}="true"]`)
              ?? [...dialog.querySelectorAll<HTMLButtonElement>('button')]
                .find(candidate => ADD_MODEL_LABELS.has(candidate.textContent?.trim() ?? ''))
            if (current === null || current === undefined || current.disabled) return
            current.setAttribute(ADD_BUTTON_ATTRIBUTE, 'true')
            pickerConfirmReplay = true
            current.click()
          }, 0)
        }, () => {
          pickerConfirmWorking = false
        })
        return
      }
    }
    if (button !== null && isCodexFetchButton(button)) {
      codexPickerPending = true
      window.setTimeout(updatePickers, 0)
    }
  }

  markEditors()
  updatePickers()
  document.addEventListener('click', onClick, true)
  const observer = new MutationObserver(updatePickers)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    document.removeEventListener('click', onClick, true)
    document.getElementById(STYLE_ID)?.remove()
    for (const editor of document.querySelectorAll<HTMLElement>(`[${CODEX_EDITOR_ATTRIBUTE}]`)) {
      editor.removeAttribute(CODEX_EDITOR_ATTRIBUTE)
      restoreModelDetails(editor)
    }
    originalModelDetailsOpen.clear()
    for (const dialog of document.querySelectorAll<HTMLElement>(`[${CODEX_PICKER_ATTRIBUTE}]`)) {
      dialog.removeAttribute(CODEX_PICKER_ATTRIBUTE)
      dialog.removeAttribute(PICKER_SELECTION_SYNCED_ATTRIBUTE)
    }
    for (const [dialog, original] of originalPickerCopy) {
      if (original.ariaLabel === null) dialog.removeAttribute('aria-label')
      else dialog.setAttribute('aria-label', original.ariaLabel)
      const heading = dialog.querySelector('h2')
      if (heading !== null && original.title !== null) heading.textContent = original.title
      const description = dialog.querySelector('p')
      if (description !== null && original.description !== null) description.textContent = original.description
    }
    originalPickerCopy.clear()
    for (const button of document.querySelectorAll<HTMLElement>(`[${REMOVE_MANUAL_ADD_ATTRIBUTE}]`)) {
      button.removeAttribute(REMOVE_MANUAL_ADD_ATTRIBUTE)
    }
    for (const [button, original] of originalModelActionMarkup) {
      button.innerHTML = original.html
      button.removeAttribute(MODEL_ACTION_ATTRIBUTE)
    }
    originalModelActionMarkup.clear()
    for (const [input, placeholder] of originalPlaceholders) input.placeholder = placeholder
    originalPlaceholders.clear()
    for (const [input, original] of originalModelNameAttributes) restoreModelNameInput(input, original)
    originalModelNameAttributes.clear()
  }
}
