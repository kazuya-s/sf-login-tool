import { useState } from 'react'
import { VaultProvider, useVault } from '../lib/useVault'
import { MasterPasswordForm } from '../components/MasterPasswordForm'
import { OrgForm } from '../components/OrgForm'
import { searchOrgs, getGroups, createOrg, updateOrg, deleteOrg } from '../lib/orgs'
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

type EditState = { mode: 'add' } | { mode: 'edit'; org: Org } | null
type LoginStatus = { orgId: string; state: 'loading' | 'done' | 'error'; error?: string; loginBaseUrl?: string } | null

function OrgRow({ org, loginStatus, onEdit, onDelete, onLogin }: {
  org: Org
  loginStatus: LoginStatus
  onEdit: (org: Org) => void
  onDelete: (org: Org) => void
  onLogin: (org: Org) => void
}) {
  const isLoading = loginStatus?.orgId === org.id && loginStatus.state === 'loading'
  const isDone = loginStatus?.orgId === org.id && loginStatus.state === 'done'
  const isError = loginStatus?.orgId === org.id && loginStatus.state === 'error'
  return (
    <li style={s.item}>
      <div style={s.itemLeft}>
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
  query: string,
  _groups: string[],
  loginStatus: LoginStatus,
  setEditState: (s: EditState) => void,
  onDelete: (org: Org) => void,
  onLogin: (org: Org) => void
) {
  const props = { loginStatus, onEdit: (o: Org) => setEditState({ mode: 'edit', org: o }), onDelete, onLogin }

  // Build grouped structure: named groups (sorted) then ungrouped
  const grouped = new Map<string, Org[]>()
  const ungrouped: Org[] = []
  for (const org of orgs) {
    const g = org.group || 'default'
    if (!grouped.has(g)) grouped.set(g, [])
    grouped.get(g)!.push(org)
  }

  const rows: React.ReactNode[] = []
  for (const [groupName, groupOrgs] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    rows.push(<li key={`header-${groupName}`} style={s.groupHeader}>{groupName}</li>)
    groupOrgs.forEach(org => rows.push(<OrgRow key={org.id} org={org} {...props} />))
  }
  return rows
}

function PopupContent() {
  const { status, vault, error, initialize, unlock, lock, applyChange } = useVault()
  const [query, setQuery] = useState('')
  const [loginStatus, setLoginStatus] = useState<LoginStatus>(null)
  const [editState, setEditState] = useState<EditState>(null)

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
  const existingGroups = getGroups({ orgs })

  const handleLogin = (org: Org) => {
    setLoginStatus({ orgId: org.id, state: 'loading' })
    const payload: LoginPayload = {
      label: org.label,
      username: org.username,
      password: org.password,
      loginBaseUrl: getLoginBaseUrl(org),
    }
    const msg: BgMessage = { type: 'LOGIN', payload }
    chrome.runtime.sendMessage(msg).then((result: LoginResult) => {
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
      editState?.mode === 'edit'
        ? updateOrg(v, editState.org.id, input)
        : createOrg(v, input)
    )
    setEditState(null)
  }

  const handleDelete = async (org: Org) => {
    if (!confirm(`「${org.label}」を削除しますか？`)) return
    await applyChange(v => deleteOrg(v, org.id))
    if (loginStatus?.orgId === org.id) setLoginStatus(null)
  }

  const openOptions = () => chrome.runtime.openOptionsPage()
  const inEdit = editState !== null

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.title}>SF Login</span>
        <div style={s.headerActions}>
          {!inEdit && (
            <button onClick={() => setEditState({ mode: 'add' })} style={s.iconBtn} title="組織を追加">＋</button>
          )}
          <button onClick={openOptions} style={s.iconBtn} title="セキュリティ設定">⚙</button>
          <button onClick={lock} style={s.iconBtn} title="ロック">🔒</button>
        </div>
      </div>

      {/* Org form view */}
      {inEdit && (
        <div style={s.formWrap}>
          <OrgForm
            initial={editState.mode === 'edit' ? editState.org : undefined}
            groups={existingGroups}
            onSave={handleSave}
            onCancel={() => setEditState(null)}
          />
        </div>
      )}

      {/* List view */}
      {!inEdit && (
        <>
          {/* Error banner */}
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

          {/* Search */}
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

          {/* Org list */}
          {orgs.length === 0 ? (
            <div style={s.empty}>
              <p>組織が登録されていません</p>
              <button onClick={() => setEditState({ mode: 'add' })} style={s.setupBtn}>追加する</button>
            </div>
          ) : filtered.length === 0 ? (
            <p style={s.noResult}>「{query}」に一致する組織はありません</p>
          ) : (
            <ul style={s.list}>
              {renderOrgRows(filtered, query, existingGroups, loginStatus, setEditState, handleDelete, handleLogin)}
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
  formWrap: { padding: '12px 12px 16px', overflowY: 'auto', flex: 1 },
  searchWrap: { position: 'relative', padding: '8px 12px', borderBottom: '1px solid #eee' },
  search: { width: '100%', boxSizing: 'border-box', padding: '6px 28px 6px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, outline: 'none' },
  clearBtn: { position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 12, padding: 0 },
  list: { listStyle: 'none', margin: 0, padding: 0, flex: 1, overflowY: 'auto' },
  groupHeader: { padding: '5px 12px 3px', fontSize: 10, fontWeight: 700, color: '#888', background: '#f5f5f5', borderBottom: '1px solid #eee', letterSpacing: '0.4px', textTransform: 'uppercase' },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid #f0f0f0' },
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
