import { useState } from 'react'
import { VaultProvider, useVault } from '../lib/useVault'
import { MasterPasswordForm } from '../components/MasterPasswordForm'
import { searchOrgs } from '../lib/orgs'
import type { Org, BgMessage, LoginPayload } from '../lib/types'

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


function PopupContent() {
  const { status, vault, error, initialize, unlock, lock } = useVault()
  const [query, setQuery] = useState('')
  const [loginStatus, setLoginStatus] = useState<{ orgId: string; state: 'loading' | 'done' } | null>(null)

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

  const handleLogin = (org: Org) => {
    setLoginStatus({ orgId: org.id, state: 'loading' })
    const payload: LoginPayload = {
      label: org.label,
      username: org.username,
      password: org.password,
      loginBaseUrl: getLoginBaseUrl(org),
    }
    const msg: BgMessage = { type: 'LOGIN', payload }
    chrome.runtime.sendMessage(msg).then(() => {
      setLoginStatus({ orgId: org.id, state: 'done' })
      setTimeout(() => setLoginStatus(null), 1500)
    }).catch(() => setLoginStatus(null))
  }

  const openOptions = () => chrome.runtime.openOptionsPage()

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.title}>SF Login</span>
        <div style={s.headerActions}>
          <button onClick={openOptions} style={s.iconBtn} title="設定">⚙</button>
          <button onClick={lock} style={s.iconBtn} title="ロック">🔒</button>
        </div>
      </div>

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
          <button onClick={openOptions} style={s.setupBtn}>設定を開いて追加する</button>
        </div>
      ) : filtered.length === 0 ? (
        <p style={s.noResult}>「{query}」に一致する組織はありません</p>
      ) : (
        <ul style={s.list}>
          {filtered.map(org => {
            const isLoading = loginStatus?.orgId === org.id && loginStatus.state === 'loading'
            const isDone = loginStatus?.orgId === org.id && loginStatus.state === 'done'
            return (
              <li key={org.id} style={s.item}>
                <div style={s.itemLeft}>
                  <span style={{ ...s.badge, background: KIND_COLOR[org.kind] }}>
                    {KIND_LABEL[org.kind]}
                  </span>
                  <div>
                    <div style={s.orgLabel}>{org.label}</div>
                    <div style={s.orgUser}>{org.username}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleLogin(org)}
                  style={{ ...s.loginBtn, ...(isDone ? s.loginBtnDone : {}) }}
                  disabled={isLoading || isDone}
                >
                  {isLoading ? '...' : isDone ? '✓' : 'ログイン'}
                </button>
              </li>
            )
          })}
        </ul>
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
  searchWrap: { position: 'relative', padding: '8px 12px', borderBottom: '1px solid #eee' },
  search: { width: '100%', padding: '6px 28px 6px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, outline: 'none' },
  clearBtn: { position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 12, padding: 0 },
  list: { listStyle: 'none', margin: 0, padding: '4px 0', flex: 1, overflowY: 'auto' },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f0f0f0' },
  itemLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  badge: { fontSize: 10, color: '#fff', padding: '1px 6px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0 },
  orgLabel: { fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 },
  orgUser: { fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 },
  loginBtn: { flexShrink: 0, padding: '5px 12px', fontSize: 12, fontWeight: 600, background: '#0070d2', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' },
  loginBtnDone: { background: '#27ae60' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#888', fontSize: 13, padding: 24 },
  setupBtn: { padding: '7px 16px', fontSize: 13, background: '#0070d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
  noResult: { padding: '20px 16px', fontSize: 13, color: '#999', textAlign: 'center' },
}
