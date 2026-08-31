/** DSH-wide Codex default model controls. */

import { useCallback, useEffect, useMemo, useState } from 'react'
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
    <span aria-hidden="true" className="dsh-codex-global-model-chevron"><IconChevronDownOutline14 size={14} /></span>
  )
}

const UNSET_VALUE = '__dsh_cascader_unset__'

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
  const selectedPaths = [
    ['model', selectedModelId || UNSET_VALUE],
    ...(selectedEffortId === '' ? [] : [['effort', selectedEffortId]]),
  ]
  const handleChange = (value: unknown): void => {
    if (!Array.isArray(value)) return
    const paths = Array.isArray(value[0]) ? value : [value]
    const nextValues = new Map<string, string>()
    for (const pathValue of paths) {
      if (!Array.isArray(pathValue)) continue
      const path = pathValue.map(String)
      const parent = path[0]
      const leaf = path.at(-1)
      if (leaf === undefined || leaf === parent) continue
      if (parent === 'model' || parent === 'effort') nextValues.set(parent, leaf === UNSET_VALUE ? '' : leaf)
    }
    const nextModelId = nextValues.get('model') ?? ''
    const nextEffortId = nextValues.get('effort') ?? ''
    if (nextModelId !== selectedModelId) onChooseModel(nextModelId)
    if (nextEffortId !== selectedEffortId) onChooseEffort(nextEffortId)
  }
  return (
    <DshCascader
      treeData={treeData}
      value={selectedPaths}
      multiple
      enableLeafClick
      showNext="hover"
      changeOnSelect={false}
      showClear={false}
      borderless
      size="small"
      dropdownClassName="dsh-codex-global-model-cascader"
      onChange={handleChange}
      triggerRender={() => (
        <DshButton htmlType="button" theme="borderless" type="tertiary" aria-haspopup="menu" className="dsh-codex-global-model-picker-button">
          <span className={`dsh-codex-global-model-picker-label${modelLabel === '' ? ' is-placeholder' : ''}`}>{buttonValue}</span>
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

  const cancel = (): void => {
    setDraftModel(current?.model ?? '')
    setDraftEffort(current?.reasoningEffort ?? '')
    setFeedback('idle')
  }

  return (
    <section className="dsh-codex-global-model" aria-labelledby="dsh-codex-global-model-title">
      <div>
        <h3 id="dsh-codex-global-model-title" className="dsh-codex-section-heading">{t('globalModelTitle')}</h3>
        <p className="dsh-codex-body dsh-codex-global-model-intro">{t('globalModelIntro')}</p>
      </div>
      {status === 'loading' ? <p className="dsh-codex-body">{t('settingsLoading')}</p> : null}
      {status === 'error' ? <p className="dsh-codex-error" role="alert">{t('globalModelLoadFailed')}</p> : null}
      {status === 'ready' ? (
        <div className="dsh-codex-global-model-fields">
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
          {selected === undefined && modelLabel !== '' ? <p className="dsh-codex-body">{t('globalModelUnavailable')}</p> : null}
        </div>
      ) : null}
      <div className="dsh-codex-global-model-actions">
        <span aria-live="polite">
          {feedback === 'saved' ? <span className="dsh-codex-success">{t('settingsSaved')}</span> : null}
          {feedback === 'error' ? <span className="dsh-codex-error">{t('settingsSaveFailed')}</span> : null}
        </span>
        <span className="dsh-codex-global-model-buttons">
          <DshButton htmlType="button" theme="outline" type="secondary" size="small" className="dsh-codex-global-model-cancel" disabled={!dirty || busy} onClick={cancel}>{t('cancel')}</DshButton>
          <DshButton htmlType="button" theme="solid" type="primary" size="small" disabled={!dirty || busy} loading={busy} onClick={() => { void save() }}>{busy ? t('saving') : t('setGlobalModel')}</DshButton>
        </span>
      </div>
    </section>
  )
}
