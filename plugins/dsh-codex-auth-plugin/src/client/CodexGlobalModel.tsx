/** DSH-wide Codex default model controls. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import type { ConnectionHandle, ModelCatalogModel, ModelProviderGroup } from '@deepseek-ai/dsh-client-connection/client'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
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
const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 }
const labelStyle: CSSProperties = { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' }
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

type ChoiceMenuKind = 'root' | 'model' | 'effort'

interface ChoiceOption {
  id: string
  label: string
}

const choiceButtonStyle: CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  width: '100%',
  minHeight: 34,
  padding: '5px 9px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  fontSize: 13,
  textAlign: 'left',
  cursor: 'pointer',
}

const choicePanelStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  top: 'calc(100% + 6px)',
  left: 0,
  width: 'max(100%, 220px)',
  maxHeight: 260,
  overflowY: 'auto',
  boxSizing: 'border-box',
  padding: 6,
  border: '1px solid var(--dsw-alias-border-l1, var(--dsw-alias-border-l2))',
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2))',
  boxShadow: 'var(--dsw-alias-shadow-popover, 0 12px 30px rgb(0 0 0 / 24%))',
}

const choiceItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  width: '100%',
  minHeight: 34,
  padding: '6px 9px',
  border: 0,
  borderRadius: 7,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  fontSize: 13,
  textAlign: 'left',
  cursor: 'pointer',
}

function ChevronDown() {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--dsw-alias-label-tertiary)', lineHeight: 1 }}><IconChevronDownOutline14 size={14} /></span>
  )
}

function ChoiceMenu({ label, value, selectedId = value, placeholder, options, open, onToggle, onChoose }: {
  label: string
  value: string
  selectedId?: string
  placeholder: string
  options: readonly ChoiceOption[]
  open: boolean
  onToggle: () => void
  onChoose: (id: string) => void
}) {
  return (
    <div style={{ ...fieldStyle, position: 'relative' }}>
      <span style={labelStyle}>{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={choiceButtonStyle}
        onClick={onToggle}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value === '' ? 'var(--dsw-alias-label-dimmed)' : 'inherit' }}>
          {value || placeholder}
        </span>
        <ChevronDown />
      </button>
      {open ? (
        <div role="listbox" aria-label={label} style={choicePanelStyle}>
          {options.map(option => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === selectedId}
              style={option.id === selectedId ? { ...choiceItemStyle, background: 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover))' } : choiceItemStyle}
              onMouseEnter={event => { event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-1))' }}
              onMouseLeave={event => { event.currentTarget.style.background = option.id === selectedId ? 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover))' : 'transparent' }}
              onClick={() => { onChoose(option.id) }}
            >
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.label}</span>
              {option.id === selectedId ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const pickerButtonStyle: CSSProperties = {
  ...choiceButtonStyle,
  width: 'fit-content',
  maxWidth: '100%',
  minHeight: 30,
  padding: '3px 4px',
  border: 0,
  borderRadius: 7,
  background: 'transparent',
  fontSize: 14,
}

const pickerPanelStyle: CSSProperties = {
  ...choicePanelStyle,
  display: 'flex',
  position: 'absolute',
  gap: 0,
  width: 'min(210px, calc(100vw - 32px))',
  maxHeight: 260,
  padding: 5,
  overflow: 'visible',
}

const pickerColumnStyle: CSSProperties = {
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
  gap: 2,
}

const pickerSubmenuStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 1,
  top: 5,
  left: 'calc(100% + 4px)',
  width: '210px',
  maxHeight: 250,
  overflowY: 'auto',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: 5,
  border: '1px solid var(--dsw-alias-border-l1, var(--dsw-alias-border-l2))',
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2))',
  boxShadow: 'var(--dsw-alias-shadow-popover, 0 12px 30px rgb(0 0 0 / 24%))',
}

function PickerRow({ label, value, disabled, active, onClick, onHover, onLeave }: {
  label: string
  value: string
  disabled?: boolean
  active?: boolean
  onClick: () => void
  onHover?: () => void
  onLeave?: (event: ReactMouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        ...choiceItemStyle,
        minHeight: 34,
        padding: '4px 8px',
        background: active ? 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover))' : 'transparent',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={event => { if (!disabled) { event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-1))'; onHover?.() } }}
      onMouseLeave={event => { event.currentTarget.style.background = active ? 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover))' : 'transparent'; onLeave?.(event) }}
      onClick={onClick}
    >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 13 }}>
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        {!disabled ? <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>›</span> : null}
      </span>
    </button>
  )
}

function GlobalModelPicker({ modelMenuLabel, effortMenuLabel, modelLabel, modelPlaceholder, effortLabel, selectedModelId, selectedEffortId, modelOptions, effortOptions, activeMenu, onToggle, onOpenSubmenu, onCloseSubmenu, onChooseModel, onChooseEffort }: {
  modelMenuLabel: string
  effortMenuLabel: string
  modelLabel: string
  modelPlaceholder: string
  effortLabel: string
  selectedModelId: string
  selectedEffortId: string
  modelOptions: readonly ChoiceOption[]
  effortOptions: readonly ChoiceOption[]
  activeMenu: ChoiceMenuKind | null
  onToggle: () => void
  onOpenSubmenu: (menu: ChoiceMenuKind) => void
  onCloseSubmenu: () => void
  onChooseModel: (id: string) => void
  onChooseEffort: (id: string) => void
}) {
  const open = activeMenu !== null
  const modelValue = modelLabel === '' ? modelPlaceholder : modelLabel
  const buttonValue = effortLabel === '' ? modelValue : `${modelValue} · ${effortLabel}`
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancelScheduledClose = (): void => {
    if (closeTimerRef.current === undefined) return
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = undefined
  }
  const scheduleSubmenuClose = (): void => {
    cancelScheduledClose()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = undefined
      onCloseSubmenu()
    }, 220)
  }
  useEffect(() => () => { cancelScheduledClose() }, [])

  const openSubmenu = (menu: ChoiceMenuKind): void => {
    cancelScheduledClose()
    onOpenSubmenu(menu)
  }

  const closeSubmenuOnParentLeave = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    const target = event.relatedTarget
    if (target instanceof Element && target.closest('[data-dsh-cascade-submenu]') !== null) return
    scheduleSubmenuClose()
  }
  return (
    <div style={{ position: 'relative', width: 'fit-content', maxWidth: '100%' }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} style={pickerButtonStyle} onClick={onToggle}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: modelLabel === '' ? 'var(--dsw-alias-label-dimmed)' : 'var(--dsw-alias-label-primary)' }}>{buttonValue}</span>
        <ChevronDown />
      </button>
      {open ? (
        <div role="menu" style={pickerPanelStyle}>
          <div style={pickerColumnStyle}>
            <PickerRow label={modelMenuLabel} value={modelValue} active={activeMenu === 'model'} onClick={() => { openSubmenu('model') }} onHover={() => { openSubmenu('model') }} onLeave={closeSubmenuOnParentLeave} />
            <PickerRow label={effortMenuLabel} value={effortLabel} active={activeMenu === 'effort'} onClick={() => { openSubmenu('effort') }} onHover={() => { openSubmenu('effort') }} onLeave={closeSubmenuOnParentLeave} />
          </div>
          {activeMenu === 'model' ? (
            <div role="menu" aria-label={modelMenuLabel} data-dsh-cascade-submenu="model" style={pickerSubmenuStyle} onMouseEnter={cancelScheduledClose} onMouseLeave={onCloseSubmenu}>
              {modelOptions.map(option => (
                <button key={option.id} type="button" role="menuitemradio" aria-checked={option.id === selectedModelId} style={option.id === selectedModelId ? { ...choiceItemStyle, background: 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover))' } : choiceItemStyle} onMouseEnter={event => { event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-1))' }} onMouseLeave={event => { event.currentTarget.style.background = option.id === selectedModelId ? 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover))' : 'transparent' }} onClick={() => { onChooseModel(option.id) }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.label}</span>
                  {option.id === selectedModelId ? <span aria-hidden="true">✓</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          {activeMenu === 'effort' ? (
            <div role="menu" aria-label={effortMenuLabel} data-dsh-cascade-submenu="effort" style={pickerSubmenuStyle} onMouseEnter={cancelScheduledClose} onMouseLeave={onCloseSubmenu}>
              {effortOptions.map(option => (
                <button key={option.id} type="button" role="menuitemradio" aria-checked={option.id === selectedEffortId} style={option.id === selectedEffortId ? { ...choiceItemStyle, background: 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover))' } : choiceItemStyle} onMouseEnter={event => { event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-1))' }} onMouseLeave={event => { event.currentTarget.style.background = option.id === selectedEffortId ? 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover))' : 'transparent' }} onClick={() => { onChooseEffort(option.id) }}>
                  <span>{option.label}</span>
                  {option.id === selectedEffortId ? <span aria-hidden="true">✓</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
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
  const [openMenu, setOpenMenu] = useState<ChoiceMenuKind | null>(null)
  const fieldsRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (openMenu === null) return
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && fieldsRef.current?.contains(event.target)) return
      setOpenMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openMenu])

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
        <div ref={fieldsRef} style={fieldsStyle}>
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
            activeMenu={openMenu}
            onToggle={() => { setOpenMenu(current => current === null ? 'root' : null) }}
            onOpenSubmenu={menu => { setOpenMenu(menu) }}
            onCloseSubmenu={() => { setOpenMenu('root') }}
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
