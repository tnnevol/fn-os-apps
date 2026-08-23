/** DSH-wide Codex default model controls. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ConnectionHandle, ModelCatalogModel, ModelProviderGroup } from '@deepseek-ai/dsh-client-connection/client'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { DshButton, DshCascader } from '@tnnevol/dsh-semi-ui'
import type { CodexAuthLocaleKey } from './locales.ts'
import { CODEX_GLOBAL_MODEL_PATH } from '../auth-paths.ts'

interface GlobalModelValue {
  model: string
  reasoningEffort?: string
}

interface GlobalModelResponse {
  globalModel?: GlobalModelValue
}

export interface CodexGlobalModelProps {
  connection: ConnectionHandle
  t: (key: CodexAuthLocaleKey) => string
}

const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 14 }
const headingStyle: CSSProperties = { margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }
const bodyStyle: CSSProperties = { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' }
const fieldsStyle: CSSProperties = { display: 'flex', alignItems: 'center', minWidth: 0 }
const actionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }
const buttonStyle: CSSProperties = { boxSizing: 'border-box', minHeight: 30, padding: '4px 12px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 16, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 12, cursor: 'pointer' }
const primaryButtonStyle: CSSProperties = { ...buttonStyle, border: 0, background: 'var(--dsw-alias-button-primary-fill)', color: 'var(--dsw-alias-label-primary-foreground)' }
const errorStyle: CSSProperties = { ...bodyStyle, color: 'var(--dsw-alias-state-error-primary, #d92d20)' }
const successStyle: CSSProperties = { ...bodyStyle, color: 'var(--dsw-alias-state-success-primary, #16825d)' }

async function request<T>(method: 'GET' | 'PUT', body?: unknown): Promise<T> {
  const response = await fetch(CODEX_GLOBAL_MODEL_PATH, {
    method,
    headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    credentials: 'same-origin',
  })
  const payload: unknown = await response.json().catch(() => undefined)
  if (!response.ok) throw new Error(typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`)
  return payload as T
}

function codexModels(groups: readonly ModelProviderGroup[]): ModelCatalogModel[] {
  return groups.find(group => group.id === 'openai-codex')?.models ?? []
}

interface ChoiceOption {
  id: string
  label: string
}

function ChevronDown() {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--dsw-alias-label-tertiary)', lineHeight: 1 }}><IconChevronDownOutline14 size={14} /></span>
  )
}

const pickerButtonStyle: CSSProperties = {
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  width: 'fit-content',
  maxWidth: '100%',
  minHeight: 30,
  padding: '3px 4px',
  border: 0,
  borderRadius: 7,
  background: 'transparent',
  fontSize: 14,
}

const UNSET_VALUE = '__dsh_cascader_unset__'

interface CascaderRef {
  open?: () => void
}

function GlobalModelPicker({ modelMenuLabel, effortMenuLabel, modelLabel, modelPlaceholder, effortLabel, selectedModelId, selectedEffortId, modelOptions, effortOptions, onChooseModel, onChooseEffort }: {
  modelMenuLabel: string
  effortMenuLabel: string
  modelLabel: string
  modelPlaceholder: string
  effortLabel: string
  selectedModelId: string
  selectedEffortId: string
  modelOptions: readonly ChoiceOption[]
  effortOptions: readonly ChoiceOption[]
  onChooseModel: (id: string) => void
  onChooseEffort: (id: string) => void
}) {
  const modelValue = modelLabel === '' ? modelPlaceholder : modelLabel
  const buttonValue = effortLabel === '' ? modelValue : `${modelValue} · ${effortLabel}`
  const cascaderRef = useRef<CascaderRef | null>(null)
  const treeData = [
    {
      value: 'model',
      label: modelMenuLabel,
      children: modelOptions.map(option => ({ value: option.id || UNSET_VALUE, label: option.label })),
    },
    {
      value: 'effort',
      label: effortMenuLabel,
      children: effortOptions.map(option => ({ value: option.id || UNSET_VALUE, label: option.label })),
    },
  ]
  const selectedPath = selectedEffortId !== ''
    ? ['effort', selectedEffortId]
    : ['model', selectedModelId || UNSET_VALUE]
  const handleChange = (value: unknown): void => {
    if (!Array.isArray(value)) return
    const path = value.map(String)
    const parent = path[0]
    const leaf = path.at(-1)
    if (leaf === undefined || leaf === parent) return
    if (parent === 'model') onChooseModel(leaf === UNSET_VALUE ? '' : leaf)
    if (parent === 'effort') onChooseEffort(leaf === UNSET_VALUE ? '' : leaf)
  }
  const reopenAfterSelect = (): void => {
    if (typeof requestAnimationFrame !== 'function') return
    requestAnimationFrame(() => { cascaderRef.current?.open?.() })
  }
  return (
    <DshCascader
      ref={cascaderRef}
      treeData={treeData}
      value={selectedPath}
      showNext="hover"
      changeOnSelect={false}
      motion={false}
      showClear={false}
      borderless
      size="small"
      dropdownClassName="dsh-codex-global-model-cascader"
      dropdownStyle={{ minWidth: 252, maxWidth: 'calc(100vw - 32px)', borderRadius: 10, overflow: 'hidden' }}
      onChange={handleChange}
      onSelect={reopenAfterSelect}
      triggerRender={() => (
        <DshButton htmlType="button" theme="borderless" type="tertiary" aria-haspopup="menu" style={pickerButtonStyle}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: modelLabel === '' ? 'var(--dsw-alias-label-dimmed)' : 'var(--dsw-alias-label-primary)' }}>{buttonValue}</span>
          <ChevronDown />
        </DshButton>
      )}
    />
  )
}

/** Set the model used by new DSH sessions and the host-backed agent entry point. */
export function CodexGlobalModel({ connection, t }: CodexGlobalModelProps) {
  const [models, setModels] = useState<ModelCatalogModel[]>([])
  const [current, setCurrent] = useState<GlobalModelValue | undefined>()
  const [draftModel, setDraftModel] = useState('')
  const [draftEffort, setDraftEffort] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<'idle' | 'saved' | 'error'>('idle')

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const [global, catalog] = await Promise.all([
        request<GlobalModelResponse>('GET'),
        connection.api.llm.models({}),
      ])
      if (!catalog.result.ok) throw new Error(catalog.result.error.message)
      const available = codexModels(catalog.result.value.groups)
      setModels(available)
      setCurrent(global.globalModel)
      setDraftModel(global.globalModel?.model ?? '')
      setDraftEffort(global.globalModel?.reasoningEffort ?? '')
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [connection])

  useEffect(() => { void load() }, [load])

  const selected = useMemo(() => models.find(model => model.id === draftModel), [draftModel, models])
  const efforts = selected?.reasoning?.efforts ?? []
  const modelLabel = selected?.name ?? draftModel
  const modelOptions: ChoiceOption[] = [
    { id: '', label: t('globalModelUnset') },
    ...(draftModel !== '' && !models.some(model => model.id === draftModel) ? [{ id: draftModel, label: draftModel }] : []),
    ...models.map(model => ({ id: model.id, label: model.name })),
  ]
  const effortOptions: ChoiceOption[] = [
    { id: '', label: t('globalModelProviderDefault') },
    ...efforts.map(effort => ({ id: effort.id, label: effort.name })),
  ]
  const dirty = draftModel.length > 0 && (current?.model !== draftModel || (current?.reasoningEffort ?? '') !== draftEffort)

  const save = async (): Promise<void> => {
    if (!dirty || busy) return
    setBusy(true)
    setFeedback('idle')
    try {
      const result = await request<GlobalModelResponse>('PUT', {
        model: draftModel,
        ...(draftEffort.length === 0 ? {} : { reasoningEffort: draftEffort }),
      })
      setCurrent(result.globalModel)
      setDraftModel(result.globalModel?.model ?? draftModel)
      setDraftEffort(result.globalModel?.reasoningEffort ?? '')
      setFeedback('saved')
    } catch {
      setFeedback('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={sectionStyle} aria-labelledby="dsh-codex-global-model-title">
      <div>
        <h3 id="dsh-codex-global-model-title" style={headingStyle}>{t('globalModelTitle')}</h3>
        <p style={{ ...bodyStyle, marginTop: 3 }}>{t('globalModelIntro')}</p>
      </div>
      {status === 'loading' ? <p style={bodyStyle}>{t('settingsLoading')}</p> : null}
      {status === 'error' ? <p style={errorStyle} role="alert">{t('globalModelLoadFailed')}</p> : null}
      {status === 'ready' ? (
        <div style={fieldsStyle}>
          <GlobalModelPicker
            modelMenuLabel={t('globalModelModel')}
            effortMenuLabel={t('globalModelThinking')}
            modelLabel={modelLabel}
            modelPlaceholder={t('globalModelUnset')}
            effortLabel={effortOptions.find(option => option.id === draftEffort)?.label ?? t('globalModelProviderDefault')}
            selectedModelId={draftModel}
            selectedEffortId={draftEffort}
            modelOptions={modelOptions}
            effortOptions={effortOptions}
            onChooseModel={id => { setDraftModel(id); setDraftEffort(''); setFeedback('idle') }}
            onChooseEffort={id => { setDraftEffort(id); setFeedback('idle') }}
          />
          {selected === undefined && modelLabel !== '' ? <p style={bodyStyle}>{t('globalModelUnavailable')}</p> : null}
        </div>
      ) : null}
      <div style={actionsStyle}>
        <span aria-live="polite">
          {feedback === 'saved' ? <span style={successStyle}>{t('settingsSaved')}</span> : null}
          {feedback === 'error' ? <span style={errorStyle}>{t('settingsSaveFailed')}</span> : null}
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={buttonStyle} disabled={status === 'loading' || busy} onClick={() => { void load() }}>{t('refreshUsage')}</button>
          <button type="button" style={primaryButtonStyle} disabled={!dirty || busy} onClick={() => { void save() }}>{busy ? t('saving') : t('setGlobalModel')}</button>
        </span>
      </div>
    </section>
  )
}
