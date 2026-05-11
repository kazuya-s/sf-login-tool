import { useState, useRef } from 'react'
import { VaultProvider, useVault } from '../lib/useVault'
import { MasterPasswordForm } from '../components/MasterPasswordForm'
import { OrgForm } from '../components/OrgForm'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { searchOrgs, getGroups, createOrg, updateOrg, deleteOrg, reorderOrg, reorderGroup } from '../lib/orgs'
import type { OrgInput } from '../lib/orgs'
import type { Org, BgMessage, LoginPayload, LoginResult } from '../lib/types'

const KIND_LABEL: Record<string, string> = {
  production: '本番',
  sandbox: 'SB',
  mydomain: 'MD',
}
const KIND_COLOR: Record<string, string> = {
  production: '#0070d2',
  sandbox: '#27ae60',
  mydomain: '#8e44ad',
}

function getLoginBaseUrl(org: Org): string {
  if (org.kind === 'mydomain' && org.myDomainUrl) return org.myDomainUrl
  if (org.kind === 'sandbox') return 'https://test.salesforce.com'
  return 'https://login.salesforce.com'
}

type PopupView = 'list' | 'add' | { mode: 'edit'; org: Org } | 'settings'
type LoginStatus = { orgId: string; state: 'loading' | 'done' | 'error'; error?: string; loginBaseUrl?: string } | null
type DndState = { draggingId: string } | null

function OrgRow({ org, loginStatus, isDragTarget, onEdit, onDelete, onLogin, onDragStart, onDragOver, onDrop, onDragEnd }: {
  org: Org
  loginStatus: LoginStatus
  isDragTarget: boolean
  onEdit: (org: Org) => void
  onDelete: (org: Org) => void
  onLogin: (org: Org) => void
  onDragStart: (org: Org) => void
  onDragOver: (e: React.DragEvent, org: Org) => void
  onDrop: (org: Org) => void
  onDragEnd: () => void
}) {
  const isLoading = loginStatus?.orgId === org.id && loginStatus.state === 'loading'
  const isDone = loginStatus?.orgId === org.id && loginStatus.state === 'done'
  const isError = loginStatus?.orgId === org.id && loginStatus.state === 'error'
  return (
    <li
      draggable
      onDragStart={() => onDragStart(org)}
      onDragOver={e => onDragOver(e, org)}
      onDrop={() => onDrop(org)}
      onDragEnd={onDragEnd}
      style={{ ...s.item, ...(isDragTarget ? s.itemDragTarget : {}) }}
    >
      <div style={s.itemLeft}>
        <span style={s.dragHandle} title="ドラッグして並び替え">⠿</span>
        <span style={{ ...s.badge, background: KIND_COLOR[org.kind] }}>{KIND_LABEL[org.kind]}</span>
        <div style={s.itemText}>
          <div style={s.orgLabel}>{org.label}</div>
          <div style={s.orgUser}>{org.username}</div>
        </div>
      </div>
      <div style={s.itemRight}>
        <button onClick={() => onEdit(org)} style={s.editBtn} title="編集">✎</button>
        <button onClick={() => onDelete(org)} style={s.deleteBtn} title="削除">✕</button>
        <button
          onClick={() => onLogin(org)}
          style={{ ...s.loginBtn, ...(isDone ? s.loginBtnDone : {}), ...(isError ? s.loginBtnError : {}) }}
          disabled={isLoading || isDone}
        >
          {isLoading ? '...' : isDone ? '✓' : isError ? '!' : 'ログイン'}
        </button>
      </div>
    </li>
  )
}

function renderOrgRows(
  orgs: Org[],
  groups: string[],
  loginStatus: LoginStatus,
  dndState: DndState,
  dragTargetId: string | null,
  groupDragging: string | null,
  groupDragTarget: string | null,
  setView: (v: PopupView) => void,
  onDelete: (org: Org) => void,
  onLogin: (org: Org) => void,
  onDragStart: (org: Org) => void,
  onDragOver: (e: React.DragEvent, org: Org) => void,
  onDrop: (org: Org) => void,
  onDragEnd: () => void,
  onGroupDragStart: (group: string) => void,
  onGroupDragOver: (e: React.DragEvent, group: string) => void,
  onGroupDrop: (group: string) => void,
  onGroupDragEnd: () => void
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
    const isGroupTarget = groupDragTarget === groupName
    const isGroupDragging = groupDragging === groupName
    rows.push(
      <li
        key={`header-${groupName}`}
        draggable
        onDragStart={e => { e.stopPropagation(); onGroupDragStart(groupName) }}
        onDragOver={e => { e.stopPropagation(); onGroupDragOver(e, groupName) }}
        onDrop={e => { e.stopPropagation(); onGroupDrop(groupName) }}
        onDragEnd={onGroupDragEnd}
        style={{ ...s.groupHeader, ...(isGroupTarget ? s.groupHeaderDragTarget : {}), ...(isGroupDragging ? s.groupHeaderDragging : {}) }}
      >
        <span style={s.groupDragHandle}>⠿</span>
        {groupName}
      </li>
    )
    groupOrgs.forEach(org => rows.push(
      <OrgRow
        key={org.id}
        org={org}
        loginStatus={loginStatus}
        isDragTarget={dragTargetId === org.id}
        onEdit={o => setView({ mode: 'edit', org: o })}
        onDelete={onDelete}
        onLogin={onLogin}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      />
    ))
  }
  return rows
}

function PopupContent() {
  const { status, vault, error, initialize, unlock, lock, applyChange } = useVault()
  const [view, setView] = useState<PopupView>('list')
  const [query, setQuery] = useState('')
  const [loginStatus, setLoginStatus] = useState<LoginStatus>(null)
  const [dndState, setDndState] = useState<DndState>(null)
  const [dragTargetId, setDragTargetId] = useState<string | null>(null)
  const [groupDragging, setGroupDragging] = useState<string | null>(null)
  const [groupDragTarget, setGroupDragTarget] = useState<string | null>(null)
  const groupDraggingRef = useRef<string | null>(null)

  if (status === 'loading') {
    return <div style={{ padding: 16, fontSize: 13, color: '#888' }}>読み込み中...</div>
  }
  if (status === 'uninitialized') {
    return <MasterPasswordForm mode="initialize" onSubmit={initialize} error={error} />
  }
  if (status === 'locked') {
    return <MasterPasswordForm mode="unlock" onSubmit={unlock} error={error} />
  }

  const orgs = vault?.orgs ?? []
  const filtered = searchOrgs({ orgs }, query)
  const existingGroups = vault ? getGroups(vault) : []

  const handleLogin = (org: Org) => {
    setLoginStatus({ orgId: org.id, state: 'loading' })
    const payload: LoginPayload = {
      label: org.label,
      username: org.username,
      password: org.password,
      loginBaseUrl: getLoginBaseUrl(org),
    }
    chrome.runtime.sendMessage({ type: 'LOGIN', payload } as BgMessage).then((result: LoginResult) => {
      if (result.ok) {
        setLoginStatus({ orgId: org.id, state: 'done' })
        setTimeout(() => chrome.tabs.create({ url: result.finalUrl }), 1500)
      } else {
        setLoginStatus({ orgId: org.id, state: 'error', error: result.error, loginBaseUrl: payload.loginBaseUrl })
        setTimeout(() => setLoginStatus(null), 6000)
      }
    }).catch(() => setLoginStatus(null))
  }

  const handleSave = async (input: OrgInput) => {
    await applyChange(v =>
      typeof view === 'object' && view.mode === 'edit'
        ? updateOrg(v, view.org.id, input)
        : createOrg(v, input)
    )
    setView('list')
  }

  const handleDelete = async (org: Org) => {
    if (!confirm(`「${org.label}」を削除しますか？`)) return
    await applyChange(v => deleteOrg(v, org.id))
    if (loginStatus?.orgId === org.id) setLoginStatus(null)
  }

  const handleDragStart = (org: Org) => {
    setDndState({ draggingId: org.id })
  }

  const handleDragOver = (e: React.DragEvent, org: Org) => {
    if (!dndState || org.id === dndState.draggingId) return
    e.preventDefault()
    setDragTargetId(org.id)
  }

  const handleDrop = async (org: Org) => {
    if (!dndState || org.id === dndState.draggingId) return
    await applyChange(v => reorderOrg(v, dndState.draggingId, org.id))
    setDndState(null)
    setDragTargetId(null)
  }

  const handleDragEnd = () => {
    setDndState(null)
    setDragTargetId(null)
  }

  const handleGroupDragStart = (group: string) => {
    setDndState(null)
    groupDraggingRef.current = group
    setGroupDragging(group)
  }

  const handleGroupDragOver = (e: React.DragEvent, group: string) => {
    if (!groupDraggingRef.current || group === groupDraggingRef.current) return
    e.preventDefault()
    setGroupDragTarget(group)
  }

  const handleGroupDrop = async (group: string) => {
    const dragging = groupDraggingRef.current
    if (!dragging || group === dragging) return
    await applyChange(v => reorderGroup(v, dragging, group))
    groupDraggingRef.current = null
    setGroupDragging(null)
    setGroupDragTarget(null)
  }

  const handleGroupDragEnd = () => {
    groupDraggingRef.current = null
    setGroupDragging(null)
    setGroupDragTarget(null)
  }

  const inList = view === 'list'
  const inSettings = view === 'settings'
  const inForm = view === 'add' || (typeof view === 'object' && view.mode === 'edit')

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.title}>SF Login</span>
        <div style={s.headerActions}>
          {inList && (
            <button onClick={() => setView('add')} style={s.iconBtn} title="組織を追加">＋</button>
          )}
          {!inForm && (
            <button
              onClick={() => setView(inSettings ? 'list' : 'settings')}
              style={{ ...s.iconBtn, ...(inSettings ? s.iconBtnActive : {}) }}
              title={inSettings ? '一覧に戻る' : 'セキュリティ設定'}
            >⚙</button>
          )}
          <button onClick={lock} style={s.iconBtn} title="ロック">🔒</button>
        </div>
      </div>

      {/* Settings view */}
      {inSettings && (
        <div style={s.formWrap}>
          <h2 style={s.sectionTitle}>マスターパスワードの変更</h2>
          <p style={s.hint}>変更後は新しいパスワードで解錠してください。</p>
          <ChangePasswordForm />
        </div>
      )}

      {/* Org form view (add / edit) */}
      {inForm && (
        <div style={s.formWrap}>
          <OrgForm
            initial={typeof view === 'object' && view.mode === 'edit' ? view.org : undefined}
            groups={existingGroups}
            onSave={handleSave}
            onCancel={() => setView('list')}
          />
        </div>
      )}

      {/* List view */}
      {inList && (
        <>
          {loginStatus?.state === 'error' && (
            <div style={s.errorBanner}>
              <div style={s.errorTop}>
                <span style={s.errorMsg}>{loginStatus.error}</span>
                <button onClick={() => setLoginStatus(null)} style={s.errorClose}>✕</button>
              </div>
              <button
                onClick={() => { chrome.tabs.create({ url: loginStatus.loginBaseUrl! }); setLoginStatus(null) }}
                style={s.errorLink}
              >
                手動でログイン →
              </button>
            </div>
          )}

          <div style={s.searchWrap}>
            <input
              style={s.search}
              placeholder="組織を検索..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} style={s.clearBtn}>✕</button>
            )}
          </div>

          {orgs.length === 0 ? (
            <div style={s.empty}>
              <p>組織が登録されていません</p>
              <button onClick={() => setView('add')} style={s.setupBtn}>追加する</button>
            </div>
          ) : filtered.length === 0 ? (
            <p style={s.noResult}>「{query}」に一致する組織はありません</p>
          ) : (
            <ul style={s.list}>
              {renderOrgRows(filtered, existingGroups, loginStatus, dndState, dragTargetId, groupDragging, groupDragTarget, setView, handleDelete, handleLogin, handleDragStart, handleDragOver, handleDrop, handleDragEnd, handleGroupDragStart, handleGroupDragOver, handleGroupDrop, handleGroupDragEnd)}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export function App() {
  return (
    <VaultProvider>
      <PopupContent />
    </VaultProvider>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { width: 320, minHeight: 400, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #eee' },
  title: { fontSize: 14, fontWeight: 700 },
  headerActions: { display: 'flex', gap: 4 },
  iconBtn: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 },
  iconBtnActive: { color: '#0070d2', background: '#e8f0fe' },
  formWrap: { padding: '12px 12px 16px', overflowY: 'auto', flex: 1 },
  sectionTitle: { fontSize: 14, fontWeight: 700, margin: '0 0 4px' },
  hint: { fontSize: 12, color: '#666', margin: '0 0 12px' },
  searchWrap: { position: 'relative', padding: '8px 12px', borderBottom: '1px solid #eee' },
  search: { width: '100%', boxSizing: 'border-box', padding: '6px 28px 6px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, outline: 'none' },
  clearBtn: { position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 12, padding: 0 },
  list: { listStyle: 'none', margin: 0, padding: 0, flex: 1, overflowY: 'auto' },
  groupHeader: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px 3px', fontSize: 10, fontWeight: 700, color: '#888', background: '#f5f5f5', borderBottom: '1px solid #eee', letterSpacing: '0.4px', textTransform: 'uppercase', cursor: 'grab' },
  groupHeaderDragTarget: { borderTop: '2px solid #0070d2' },
  groupHeaderDragging: { opacity: 0.4 },
  groupDragHandle: { fontSize: 12, color: '#bbb', lineHeight: 1, flexShrink: 0 },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid #f0f0f0', cursor: 'grab' },
  itemDragTarget: { borderTop: '2px solid #0070d2' },
  dragHandle: { fontSize: 14, color: '#ccc', cursor: 'grab', flexShrink: 0, lineHeight: 1 },
  itemLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 },
  itemText: { minWidth: 0 },
  itemRight: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  badge: { fontSize: 10, color: '#fff', padding: '1px 5px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0 },
  orgLabel: { fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 },
  orgUser: { fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 },
  editBtn: { background: 'none', border: 'none', fontSize: 14, color: '#888', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, lineHeight: 1 },
  deleteBtn: { background: 'none', border: 'none', fontSize: 12, color: '#c0392b', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, lineHeight: 1 },
  loginBtn: { flexShrink: 0, padding: '4px 10px', fontSize: 12, fontWeight: 600, background: '#0070d2', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' },
  loginBtnDone: { background: '#27ae60' },
  loginBtnError: { background: '#e74c3c' },
  errorBanner: { background: '#fdf0ef', borderBottom: '1px solid #f5c6c1', padding: '8px 12px' },
  errorTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  errorMsg: { fontSize: 12, color: '#c0392b', fontWeight: 600, lineHeight: '1.4', flex: 1 },
  errorClose: { background: 'none', border: 'none', fontSize: 14, color: '#c0392b', cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0 },
  errorLink: { marginTop: 6, background: 'none', border: 'none', fontSize: 11, color: '#e74c3c', cursor: 'pointer', padding: 0, textDecoration: 'underline', display: 'block' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#888', fontSize: 13, padding: 24 },
  setupBtn: { padding: '7px 16px', fontSize: 13, background: '#0070d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
  noResult: { padding: '20px 16px', fontSize: 13, color: '#999', textAlign: 'center' },
}
