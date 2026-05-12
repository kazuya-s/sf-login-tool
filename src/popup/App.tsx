import './popup.css'
import { useState, useRef, type FormEvent } from 'react'
import { VaultProvider, useVault } from '../lib/useVault'
import { MasterPasswordForm } from '../components/MasterPasswordForm'
import { OrgForm } from '../components/OrgForm'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { AppSettingsProvider, useAppSettings, THEME_VARS, type Theme } from '../lib/useAppSettings'
import { getT, LANGS } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import { searchOrgs, getGroups, createOrg, updateOrg, deleteOrg, reorderOrg, reorderGroup } from '../lib/orgs'
import type { OrgInput } from '../lib/orgs'
import type { Org, BgMessage, LoginPayload, LoginResult, LoginTarget } from '../lib/types'
import { exportVaultAsJson, downloadJson, parseImportJson, applyImport } from '../lib/importExport'

const KIND_LABEL: Record<string, string> = { production: '本番', sandbox: 'SB', mydomain: 'MD' }
const KIND_COLOR: Record<string, string> = {
  production: '#0070d2', sandbox: '#27ae60', mydomain: '#8e44ad',
}

function getLoginBaseUrl(org: Org): string {
  if (org.kind === 'mydomain' && org.myDomainUrl) return org.myDomainUrl
  if (org.kind === 'sandbox') return 'https://test.salesforce.com'
  return 'https://login.salesforce.com'
}

type PopupView = 'list' | 'add' | { mode: 'edit'; org: Org } | 'settings'
type LoginStatus = {
  orgId: string; state: 'loading' | 'done' | 'error'
  target?: LoginTarget; error?: string; loginBaseUrl?: string
} | null
type DndState = { draggingId: string } | null

// Icons
function Svg({ children, size = 14 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  )
}
const TabIcon = () => <Svg><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></Svg>
const IncognitoIcon = () => <Svg><path d="M4 11c0-2 16-2 16 0"/><path d="M7 11V8a5 5 0 0110 0v3"/><circle cx="8.5" cy="15.5" r="2.5"/><circle cx="15.5" cy="15.5" r="2.5"/><line x1="11" y1="15.5" x2="13" y2="15.5"/></Svg>
const WindowIcon = () => <Svg><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></Svg>
const EditIcon = () => <Svg><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></Svg>
const DoneIcon = () => <Svg><polyline points="20 6 9 17 4 12"/></Svg>
const SearchIcon = () => <Svg size={13}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></Svg>

function ActionBtn({ onClick, title, disabled, done, loading, children }: {
  onClick?: () => void; title: string; disabled?: boolean; done?: boolean; loading?: boolean; children: React.ReactNode
}) {
  return (
    <button className="sf-action-btn" onClick={onClick} title={title} disabled={disabled || loading}
      style={{ ...s.actionBtn, ...(done ? s.actionBtnDone : {}), ...(loading ? s.actionBtnLoading : {}) }}>
      {done ? <DoneIcon /> : loading ? <span style={s.loadingDot}>•</span> : children}
    </button>
  )
}

function OrgRow({ org, loginStatus, isDragTarget, onEdit, onLoginTab, onLoginIncognito, onLoginWindow, onDragStart, onDragOver, onDrop, onDragEnd, t }: {
  org: Org; loginStatus: LoginStatus; isDragTarget: boolean
  onEdit: (org: Org) => void
  onLoginTab: (org: Org) => void; onLoginIncognito: (org: Org) => void; onLoginWindow: (org: Org) => void
  onDragStart: (org: Org) => void; onDragOver: (e: React.DragEvent, org: Org) => void
  onDrop: (org: Org) => void; onDragEnd: () => void
  t: ReturnType<typeof getT>
}) {
  const isActive = loginStatus?.orgId === org.id
  const isLoading = isActive && loginStatus!.state === 'loading'
  const isDone = isActive && loginStatus!.state === 'done'
  const target = loginStatus?.target
  return (
    <li className="sf-org-row" draggable
      onDragStart={() => onDragStart(org)} onDragOver={e => onDragOver(e, org)}
      onDrop={() => onDrop(org)} onDragEnd={onDragEnd}
      style={{ ...s.item, borderLeft: `3px solid ${KIND_COLOR[org.kind]}`, ...(isDragTarget ? s.itemDragTarget : {}) }}>
      <div style={s.itemLeft}>
        <span style={s.dragHandle} title={t.dragToReorder}>⠿</span>
        <span style={{ ...s.badge, background: KIND_COLOR[org.kind] }}>{KIND_LABEL[org.kind]}</span>
        <div style={s.itemText}>
          <div style={s.orgLabel}>{org.label}</div>
          <div style={s.orgUser}>{org.username}</div>
        </div>
      </div>
      <div style={s.itemRight}>
        <ActionBtn onClick={() => onLoginTab(org)} title={t.loginTab}
          loading={isLoading && target === 'tab'} done={isDone && target === 'tab'} disabled={isLoading || isDone}>
          <TabIcon />
        </ActionBtn>
        <ActionBtn onClick={() => onLoginIncognito(org)} title={t.loginIncognito}
          loading={isLoading && target === 'incognito'} done={isDone && target === 'incognito'} disabled={isLoading || isDone}>
          <IncognitoIcon />
        </ActionBtn>
        <ActionBtn onClick={() => onLoginWindow(org)} title={t.loginWindow}
          loading={isLoading && target === 'window'} done={isDone && target === 'window'} disabled={isLoading || isDone}>
          <WindowIcon />
        </ActionBtn>
        <ActionBtn onClick={() => onEdit(org)} title={t.edit}><EditIcon /></ActionBtn>
      </div>
    </li>
  )
}

function renderOrgRows(
  orgs: Org[], groups: string[], loginStatus: LoginStatus,
  dndState: DndState, dragTargetId: string | null,
  groupDragging: string | null, groupDragTarget: string | null,
  collapsedGroups: Set<string>,
  t: ReturnType<typeof getT>,
  setView: (v: PopupView) => void,
  onLoginTab: (org: Org) => void, onLoginIncognito: (org: Org) => void, onLoginWindow: (org: Org) => void,
  onDragStart: (org: Org) => void, onDragOver: (e: React.DragEvent, org: Org) => void,
  onDrop: (org: Org) => void, onDragEnd: () => void,
  onGroupDragStart: (g: string) => void, onGroupDragOver: (e: React.DragEvent, g: string) => void,
  onGroupDrop: (g: string) => void, onGroupDragEnd: () => void,
  onGroupToggle: (g: string) => void,
) {
  const grouped = new Map<string, Org[]>()
  for (const org of orgs) {
    const g = org.group || 'default'
    if (!grouped.has(g)) grouped.set(g, [])
    grouped.get(g)!.push(org)
  }
  const rows: React.ReactNode[] = []
  for (const groupName of groups) {
    const groupOrgs = grouped.get(groupName)
    if (!groupOrgs) continue
    const collapsed = collapsedGroups.has(groupName)
    rows.push(
      <li key={`h-${groupName}`} draggable
        onDragStart={e => { e.stopPropagation(); onGroupDragStart(groupName) }}
        onDragOver={e => { e.stopPropagation(); onGroupDragOver(e, groupName) }}
        onDrop={e => { e.stopPropagation(); onGroupDrop(groupName) }}
        onDragEnd={onGroupDragEnd}
        onClick={() => onGroupToggle(groupName)}
        style={{ ...s.groupHeader, ...(groupDragTarget === groupName ? s.groupHeaderTarget : {}), ...(groupDragging === groupName ? s.groupHeaderDragging : {}) }}>
        <span style={s.groupDragHandle}>⠿</span>
        <span style={{ flex: 1 }}>{groupName}</span>
        <span style={s.groupCount}>{groupOrgs.length}</span>
        <span style={{ ...s.groupChevron, transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
      </li>
    )
    if (!collapsed) {
      groupOrgs.forEach(org => rows.push(
        <OrgRow key={org.id} org={org} loginStatus={loginStatus} isDragTarget={dragTargetId === org.id} t={t}
          onEdit={o => setView({ mode: 'edit', org: o })}
          onLoginTab={onLoginTab} onLoginIncognito={onLoginIncognito} onLoginWindow={onLoginWindow}
          onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} />
      ))
    }
  }
  return rows
}

// Import / Export section (used inside SettingsPanel)
function ImportExportSection() {
  const { vault, applyChange } = useVault()
  const { settings } = useAppSettings()
  const t = getT(settings.lang)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const handleExport = () => {
    if (!vault) return
    const json = exportVaultAsJson(vault)
    const date = new Date().toISOString().slice(0, 10)
    downloadJson(json, `sf-login-tool-${date}.json`)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setBusy(true)
    setMsg(null)
    try {
      const json = await file.text()
      const { orgs, errors } = parseImportJson(json)
      if (orgs.length === 0) {
        setMsg({ ok: false, text: t.importError })
        return
      }
      if (!confirm(t.importConfirm(orgs.length))) return
      let importResult = { added: 0, skipped: errors.length }
      await applyChange(v => {
        const updated = applyImport(v, orgs)
        importResult.added = orgs.length
        return updated
      })
      setMsg({
        ok: true,
        text: importResult.skipped > 0
          ? t.importPartial(importResult.added, importResult.skipped)
          : t.importSuccess(importResult.added),
      })
    } catch {
      setMsg({ ok: false, text: t.importError })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={s.ieWrap}>
      <div style={s.ieRow}>
        <div style={s.ieInfo}>
          <span style={s.ieLabel}>{t.exportBtn}</span>
          <span style={s.ieHint}>{t.exportHint}</span>
        </div>
        <button onClick={handleExport} disabled={!vault || busy} style={s.ieBtn}>
          {t.exportBtn}
        </button>
      </div>
      <div style={s.ieRow}>
        <div style={s.ieInfo}>
          <span style={s.ieLabel}>{t.importBtn}</span>
          <span style={s.ieHint}>{t.importHint}</span>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={!vault || busy} style={s.ieBtn}>
          {busy ? t.processing : t.importBtn}
        </button>
        <input ref={fileInputRef} type="file" accept=".json,application/json"
          style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
      {msg && <p style={{ ...s.ieMsg, color: msg.ok ? 'var(--success)' : 'var(--danger)' }}>{msg.text}</p>}
    </div>
  )
}

// Master password toggle section (used inside SettingsPanel)
function MasterPasswordToggle() {
  const { isMasterPasswordEnabled, enableMasterPassword, disableMasterPassword } = useVault()
  const { settings, update } = useAppSettings()
  const t = getT(settings.lang)
  const [pendingEnable, setPendingEnable] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleToggle = async () => {
    if (isMasterPasswordEnabled) {
      if (!confirm(t.masterPasswordDisableConfirm)) return
      setSubmitting(true)
      setMsg(null)
      try {
        await disableMasterPassword()
        update({ masterPasswordEnabled: false })
        setMsg({ ok: true, text: t.masterPasswordDisableSuccess })
      } catch {
        setMsg({ ok: false, text: t.masterPasswordDisableError })
      } finally { setSubmitting(false) }
    } else {
      setMsg(null)
      setNewPw(''); setConfirmPw('')
      setPendingEnable(prev => !prev)
    }
  }

  const handleEnable = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (newPw.length < 8) { setMsg({ ok: false, text: t.errPasswordTooShort }); return }
    if (newPw !== confirmPw) { setMsg({ ok: false, text: t.errPasswordMismatch }); return }
    setSubmitting(true)
    try {
      await enableMasterPassword(newPw)
      update({ masterPasswordEnabled: true })
      setNewPw(''); setConfirmPw('')
      setPendingEnable(false)
      setMsg({ ok: true, text: t.masterPasswordEnableSuccess })
    } catch {
      setMsg({ ok: false, text: t.masterPasswordEnableError })
    } finally { setSubmitting(false) }
  }

  const isOn = isMasterPasswordEnabled || pendingEnable

  return (
    <div>
      <div style={s.mpRow}>
        <div>
          <span style={s.mpLabel}>{t.masterPasswordSection}</span>
          <p style={s.mpHint}>{isOn ? t.masterPasswordOnHint : t.masterPasswordOffHint}</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={submitting}
          style={{ ...s.mpTrack, background: isOn ? 'var(--primary)' : 'var(--border)' }}
          aria-pressed={isOn}
          aria-label={t.masterPasswordSection}
        >
          <span style={{ ...s.mpThumb, transform: isOn ? 'translateX(16px)' : 'translateX(2px)' }} />
        </button>
      </div>
      {msg && <p style={{ ...s.mpMsg, color: msg.ok ? 'var(--success)' : 'var(--danger)' }}>{msg.text}</p>}
      {pendingEnable && !isMasterPasswordEnabled && (
        <form onSubmit={handleEnable} style={s.mpForm}>
          <input type="password" placeholder={t.masterPasswordPlaceholder} value={newPw}
            onChange={e => setNewPw(e.target.value)} style={s.mpInput} disabled={submitting} autoFocus />
          <input type="password" placeholder={t.confirmPasswordPlaceholder} value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)} style={s.mpInput} disabled={submitting} />
          <button type="submit" style={s.mpSetBtn} disabled={submitting || !newPw}>
            {submitting ? t.processing : t.masterPasswordEnableBtn}
          </button>
        </form>
      )}
    </div>
  )
}

// Settings panel
function ThemeSwatch({ theme, label, selected, onClick }: {
  theme: Theme; label: string; selected: boolean; onClick: () => void
}) {
  const v = THEME_VARS[theme]
  return (
    <button onClick={onClick} style={{
      flex: 1, height: 52, border: `2px solid ${selected ? v['--primary'] : v['--border']}`,
      borderRadius: 10, background: v['--bg'], cursor: 'pointer', padding: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: selected ? `0 0 0 2px ${v['--primary']}` : '0 1px 3px rgba(0,0,0,0.08)',
      transition: 'box-shadow 0.15s, border-color 0.15s',
    }}>
      <div style={{ flex: 1, display: 'flex', gap: 3, padding: '7px 7px 4px' }}>
        <div style={{ width: 14, height: 14, borderRadius: 3, background: v['--primary'] }} />
        <div style={{ flex: 1, height: 5, borderRadius: 2, background: v['--border-light'], marginTop: 4 }} />
      </div>
      <div style={{ background: v['--bg-group'], padding: '2px 0', fontSize: 9, color: v['--text-muted'], textAlign: 'center', fontWeight: 700, letterSpacing: '0.3px' }}>
        {label}
      </div>
    </button>
  )
}

function SettingsPanel({ t, lang, theme, onLangChange, onThemeChange }: {
  t: ReturnType<typeof getT>; lang: Lang; theme: Theme
  onLangChange: (l: Lang) => void; onThemeChange: (th: Theme) => void
}) {
  const { settings } = useAppSettings()
  return (
    <div style={s.formWrap}>
      <div style={s.settingsSection}>
        <h3 style={s.settingsSectionTitle}>{t.languageSection}</h3>
        <select value={lang} onChange={e => onLangChange(e.target.value as Lang)} style={s.langSelect}>
          {LANGS.map(l => (
            <option key={l.code} value={l.code}>{l.nativeName}</option>
          ))}
        </select>
      </div>

      <div style={s.settingsDivider} />

      <div style={s.settingsSection}>
        <h3 style={s.settingsSectionTitle}>{t.themeSection}</h3>
        <div style={s.themeRow}>
          {(['light', 'dark', 'blue', 'forest'] as Theme[]).map(th => (
            <ThemeSwatch key={th} theme={th} selected={theme === th} onClick={() => onThemeChange(th)}
              label={t[`theme${th.charAt(0).toUpperCase()}${th.slice(1)}` as keyof typeof t] as string} />
          ))}
        </div>
      </div>

      <div style={s.settingsDivider} />

      <div style={s.settingsSection}>
        <h3 style={s.settingsSectionTitle}>{t.securitySection}</h3>
        <MasterPasswordToggle />
        {settings.masterPasswordEnabled && (
          <>
            <div style={{ ...s.settingsDivider, margin: '16px 0' }} />
            <p style={s.hint}>{t.changePasswordHint}</p>
            <ChangePasswordForm />
          </>
        )}
      </div>

      <div style={s.settingsDivider} />

      <div style={s.settingsSection}>
        <h3 style={s.settingsSectionTitle}>{t.dataSection}</h3>
        <ImportExportSection />
      </div>
    </div>
  )
}

function PopupContent() {
  const { status, vault, error, isMasterPasswordEnabled, initialize, unlock, lock, applyChange } = useVault()
  const { settings, update } = useAppSettings()
  const t = getT(settings.lang)
  const [view, setView] = useState<PopupView>('list')
  const [query, setQuery] = useState('')
  const [loginStatus, setLoginStatus] = useState<LoginStatus>(null)
  const [dndState, setDndState] = useState<DndState>(null)
  const [dragTargetId, setDragTargetId] = useState<string | null>(null)
  const [groupDragging, setGroupDragging] = useState<string | null>(null)
  const [groupDragTarget, setGroupDragTarget] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const groupDraggingRef = useRef<string | null>(null)

  const handleGroupToggle = (group: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(group) ? next.delete(group) : next.add(group)
      return next
    })

  const themeStyle = THEME_VARS[settings.theme] as React.CSSProperties

  if (status === 'loading') return (
    <div style={{ ...s.container, ...themeStyle }}>
      <div style={s.topBar} />
      <div style={s.loadingMsg}>{t.loading}</div>
    </div>
  )
  if (status === 'uninitialized') return (
    <div style={{ ...s.container, ...themeStyle }}>
      <div style={s.topBar} />
      <MasterPasswordForm mode="initialize" onSubmit={initialize} error={error} />
    </div>
  )
  if (status === 'locked') return (
    <div style={{ ...s.container, ...themeStyle }}>
      <div style={s.topBar} />
      <MasterPasswordForm mode="unlock" onSubmit={unlock} error={error} />
    </div>
  )

  const orgs = vault?.orgs ?? []
  const filtered = searchOrgs({ orgs }, query)
  const existingGroups = vault ? getGroups(vault) : []

  const handleLogin = (org: Org, target: LoginTarget) => {
    setLoginStatus({ orgId: org.id, state: 'loading', target })
    const payload: LoginPayload = { orgId: org.id, username: org.username, password: org.password, loginBaseUrl: getLoginBaseUrl(org), target }
    chrome.runtime.sendMessage({ type: 'LOGIN', payload } as BgMessage).then((result: LoginResult) => {
      if (result.ok) {
        setLoginStatus({ orgId: org.id, state: 'done', target })
        setTimeout(() => setLoginStatus(null), 1500)
      } else {
        setLoginStatus({ orgId: org.id, state: 'error', error: result.error, loginBaseUrl: payload.loginBaseUrl })
        setTimeout(() => setLoginStatus(null), 6000)
      }
    }).catch(() => setLoginStatus(null))
  }

  const handleSave = async (input: OrgInput) => {
    await applyChange(v => typeof view === 'object' && view.mode === 'edit' ? updateOrg(v, view.org.id, input) : createOrg(v, input))
    setView('list')
  }

  const handleDelete = async (org: Org) => {
    if (!confirm(`「${org.label}」を削除しますか？`)) return
    await applyChange(v => deleteOrg(v, org.id))
    if (loginStatus?.orgId === org.id) setLoginStatus(null)
    setView('list')
  }

  const handleDragStart = (org: Org) => setDndState({ draggingId: org.id })
  const handleDragOver = (e: React.DragEvent, org: Org) => {
    if (!dndState || org.id === dndState.draggingId) return
    e.preventDefault(); setDragTargetId(org.id)
  }
  const handleDrop = async (org: Org) => {
    if (!dndState || org.id === dndState.draggingId) return
    await applyChange(v => reorderOrg(v, dndState.draggingId, org.id))
    setDndState(null); setDragTargetId(null)
  }
  const handleDragEnd = () => { setDndState(null); setDragTargetId(null) }

  const handleGroupDragStart = (group: string) => {
    setDndState(null); groupDraggingRef.current = group; setGroupDragging(group)
  }
  const handleGroupDragOver = (e: React.DragEvent, group: string) => {
    if (!groupDraggingRef.current || group === groupDraggingRef.current) return
    e.preventDefault(); setGroupDragTarget(group)
  }
  const handleGroupDrop = async (group: string) => {
    const dragging = groupDraggingRef.current
    if (!dragging || group === dragging) return
    await applyChange(v => reorderGroup(v, dragging, group))
    groupDraggingRef.current = null; setGroupDragging(null); setGroupDragTarget(null)
  }
  const handleGroupDragEnd = () => {
    groupDraggingRef.current = null; setGroupDragging(null); setGroupDragTarget(null)
  }

  const inList = view === 'list'
  const inSettings = view === 'settings'
  const inForm = view === 'add' || (typeof view === 'object' && view.mode === 'edit')
  const editOrg = typeof view === 'object' && view.mode === 'edit' ? view.org : undefined

  return (
    <div style={{ ...s.container, ...themeStyle }}>
      {/* Top accent bar */}
      <div style={s.topBar} />

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logoMark}>SF</div>
          <span style={s.title}>Login Tool</span>
        </div>
        <div style={s.headerActions}>
          {inList && (
            <button className="sf-icon-btn" onClick={() => setView('add')} style={s.iconBtn} title={t.addOrg}>＋</button>
          )}
          {!inForm && (
            <button className="sf-icon-btn" onClick={() => setView(inSettings ? 'list' : 'settings')}
              style={{ ...s.iconBtn, ...(inSettings ? s.iconBtnActive : {}) }}
              title={inSettings ? t.backToList : t.settingsTitle}>⚙</button>
          )}
          {isMasterPasswordEnabled && (
            <button className="sf-icon-btn" onClick={lock} style={s.iconBtn} title={t.lock}>🔒</button>
          )}
        </div>
      </div>

      {/* Settings */}
      {inSettings && (
        <SettingsPanel t={t} lang={settings.lang} theme={settings.theme}
          onLangChange={l => update({ lang: l })}
          onThemeChange={th => update({ theme: th })} />
      )}

      {/* Org form */}
      {inForm && (
        <div style={s.formWrap}>
          <OrgForm initial={editOrg} groups={existingGroups} onSave={handleSave}
            onCancel={() => setView('list')}
            onDelete={editOrg ? () => handleDelete(editOrg) : undefined} />
        </div>
      )}

      {/* List */}
      {inList && (
        <>
          {loginStatus?.state === 'error' && (
            <div style={s.errorBanner}>
              <div style={s.errorTop}>
                <span style={s.errorMsg}>{loginStatus.error}</span>
                <button onClick={() => setLoginStatus(null)} style={s.errorClose}>✕</button>
              </div>
              <button onClick={() => { chrome.tabs.create({ url: loginStatus.loginBaseUrl! }); setLoginStatus(null) }}
                style={s.errorLink}>{t.manualLogin}</button>
            </div>
          )}
          <div style={s.searchWrap}>
            <span style={s.searchIconWrap}><SearchIcon /></span>
            <input style={s.search} placeholder={t.searchPlaceholder} value={query}
              onChange={e => setQuery(e.target.value)} autoFocus />
            {query && <button onClick={() => setQuery('')} style={s.clearBtn}>✕</button>}
          </div>
          {orgs.length === 0 ? (
            <div style={s.empty}>
              <div style={s.emptyIcon}>☁️</div>
              <div style={s.emptyTitle}>{t.noOrgs}</div>
              <button onClick={() => setView('add')} style={s.setupBtn}>{t.addFirst}</button>
            </div>
          ) : filtered.length === 0 ? (
            <p style={s.noResult}>{t.noResult(query)}</p>
          ) : (
            <ul style={s.list}>
              {renderOrgRows(
                filtered, existingGroups, loginStatus,
                dndState, dragTargetId, groupDragging, groupDragTarget,
                query ? new Set() : collapsedGroups,
                t, setView,
                org => handleLogin(org, 'tab'),
                org => handleLogin(org, 'incognito'),
                org => handleLogin(org, 'window'),
                handleDragStart, handleDragOver, handleDrop, handleDragEnd,
                handleGroupDragStart, handleGroupDragOver, handleGroupDrop, handleGroupDragEnd,
                handleGroupToggle
              )}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export function App() {
  return (
    <AppSettingsProvider>
      <VaultProvider>
        <PopupContent />
      </VaultProvider>
    </AppSettingsProvider>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { width: 400, minHeight: 400, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif', background: 'var(--bg)', color: 'var(--text)' },
  topBar: { height: 3, background: 'var(--primary)', flexShrink: 0 },
  loadingMsg: { padding: '20px 16px', fontSize: 13, color: 'var(--text-muted)' },
  // Header
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  logoMark: { width: 26, height: 26, borderRadius: 7, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '-0.5px', flexShrink: 0 },
  title: { fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' },
  headerActions: { display: 'flex', gap: 2 },
  iconBtn: { background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: 'var(--text)', lineHeight: 1 },
  iconBtnActive: { color: 'var(--primary)', background: 'var(--primary-light)' },
  formWrap: { padding: '12px 12px 16px', overflowY: 'auto', flex: 1, background: 'var(--bg)' },
  hint: { fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 },
  // Search
  searchWrap: { position: 'relative', padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' },
  searchIconWrap: { position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', pointerEvents: 'none' },
  search: { width: '100%', boxSizing: 'border-box', padding: '7px 28px 7px 32px', fontSize: 13, border: '1px solid var(--input-border)', borderRadius: 20, outline: 'none', background: 'var(--input-bg)', color: 'var(--text)' },
  clearBtn: { position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 4px', lineHeight: 1 },
  // List
  list: { listStyle: 'none', margin: 0, padding: 0, flex: 1, overflowY: 'auto' },
  groupHeader: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-group)', borderBottom: '1px solid var(--border)', letterSpacing: '0.6px', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' },
  groupHeaderTarget: { borderTop: '2px solid var(--primary)' },
  groupHeaderDragging: { opacity: 0.4 },
  groupDragHandle: { fontSize: 12, color: 'var(--drag-handle)', lineHeight: 1, flexShrink: 0, cursor: 'grab' },
  groupCount: { background: 'var(--border)', color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, lineHeight: '14px', flexShrink: 0 },
  groupChevron: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1, flexShrink: 0, transition: 'transform 0.15s ease' },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px 7px 9px', borderBottom: '1px solid var(--border-light)', cursor: 'grab', background: 'var(--bg)' },
  itemDragTarget: { borderTop: '2px solid var(--primary)' },
  dragHandle: { fontSize: 14, color: 'var(--drag-handle)', cursor: 'grab', flexShrink: 0, lineHeight: 1 },
  itemLeft: { display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 },
  itemText: { minWidth: 0, flex: 1 },
  itemRight: { display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, borderLeft: '1px solid var(--border-light)', paddingLeft: 4, marginLeft: 4 },
  badge: { fontSize: 9, color: '#fff', padding: '2px 5px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 700, letterSpacing: '0.2px' },
  orgLabel: { fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  orgUser: { fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  actionBtn: { background: 'none', border: 'none', color: 'var(--icon)', cursor: 'pointer', padding: '5px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionBtnDone: { color: 'var(--success)' },
  actionBtnLoading: { opacity: 0.4, cursor: 'default' },
  loadingDot: { fontSize: 16, lineHeight: '14px', display: 'block' },
  // Error banner
  errorBanner: { background: 'var(--danger-bg)', borderBottom: '1px solid var(--danger-border)', padding: '8px 12px' },
  errorTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  errorMsg: { fontSize: 12, color: 'var(--danger)', fontWeight: 600, lineHeight: '1.4', flex: 1 },
  errorClose: { background: 'none', border: 'none', fontSize: 14, color: 'var(--danger)', cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0 },
  errorLink: { marginTop: 6, background: 'none', border: 'none', fontSize: 11, color: 'var(--danger)', cursor: 'pointer', padding: 0, textDecoration: 'underline', display: 'block' },
  // Empty state
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '32px 24px', textAlign: 'center' },
  emptyIcon: { fontSize: 44, lineHeight: 1, marginBottom: 4 },
  emptyTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 2 },
  setupBtn: { padding: '8px 22px', fontSize: 13, background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 },
  noResult: { padding: '24px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' },
  // Settings panel
  settingsSection: { marginBottom: 20 },
  settingsDivider: { height: 1, background: 'var(--border)', margin: '0 0 20px' },
  settingsSectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.6px' },
  langSelect: { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--input-border)', borderRadius: 8, background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer' },
  themeRow: { display: 'flex', gap: 8 },
  // Master password toggle
  mpRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  mpLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 3 },
  mpHint: { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 },
  mpTrack: { flexShrink: 0, width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', padding: 0, position: 'relative', transition: 'background 0.2s', marginTop: 1 },
  mpThumb: { position: 'absolute', top: 2, width: 16, height: 16, borderRadius: 8, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'transform 0.2s', display: 'block' },
  mpMsg: { fontSize: 12, margin: '0 0 8px' },
  mpForm: { display: 'flex', flexDirection: 'column', gap: 8 },
  mpInput: { padding: '7px 10px', fontSize: 13, border: '1px solid var(--input-border)', borderRadius: 6, background: 'var(--input-bg)', color: 'var(--text)' },
  mpSetBtn: { alignSelf: 'flex-start', padding: '6px 14px', fontSize: 12, fontWeight: 600, background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none', borderRadius: 6, cursor: 'pointer' },
  // Import / Export
  ieWrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  ieRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  ieInfo: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  ieLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text-sub)' },
  ieHint: { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 },
  ieBtn: { flexShrink: 0, padding: '6px 14px', fontSize: 12, fontWeight: 600, background: 'var(--btn-sec-bg)', color: 'var(--text)', border: '1px solid var(--btn-sec-border)', borderRadius: 6, cursor: 'pointer' },
  ieMsg: { fontSize: 12, margin: 0 },
}
