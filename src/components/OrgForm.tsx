import { type FormEvent, useState } from 'react'
import type { Org, OrgKind } from '../lib/types'
import type { OrgInput } from '../lib/orgs'

type Props = {
  initial?: Org
  groups?: string[]
  onSave: (input: OrgInput) => void
  onCancel: () => void
}

export function OrgForm({ initial, groups = [], onSave, onCancel }: Props) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [kind, setKind] = useState<OrgKind>(initial?.kind ?? 'production')
  const [group, setGroup] = useState(initial?.group ?? 'default')
  const [myDomainUrl, setMyDomainUrl] = useState(initial?.myDomainUrl ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!label.trim()) { setError('ラベルを入力してください'); return }
    if (!username.trim()) { setError('ユーザー名を入力してください'); return }
    if (!password) { setError('パスワードを入力してください'); return }
    if (kind === 'mydomain') {
      if (!myDomainUrl.trim()) { setError('My Domain URL を入力してください'); return }
      if (!myDomainUrl.startsWith('https://')) { setError('URL は https:// で始めてください'); return }
    }
    onSave({ label: label.trim(), kind, group: group.trim() || undefined, myDomainUrl: kind === 'mydomain' ? myDomainUrl.trim() : undefined, username: username.trim(), password })
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <h2 style={s.heading}>{initial ? '組織を編集' : '組織を追加'}</h2>

      <label style={s.label}>ラベル</label>
      <input style={s.input} value={label} onChange={e => setLabel(e.target.value)} placeholder="例: 本番環境" autoFocus />

      <label style={s.label}>グループ（任意）</label>
      <input
        style={s.input}
        list="org-group-list"
        value={group}
        onChange={e => setGroup(e.target.value)}
        placeholder="例: 本番環境"
        autoComplete="off"
      />
      {groups.length > 0 && (
        <datalist id="org-group-list">
          {groups.map(g => <option key={g} value={g} />)}
        </datalist>
      )}

      <label style={s.label}>種別</label>
      <select style={s.input} value={kind} onChange={e => setKind(e.target.value as OrgKind)}>
        <option value="production">Production (login.salesforce.com)</option>
        <option value="sandbox">Sandbox (test.salesforce.com)</option>
        <option value="mydomain">My Domain (カスタムURL)</option>
      </select>

      {kind === 'mydomain' && (
        <>
          <label style={s.label}>My Domain URL</label>
          <input style={s.input} value={myDomainUrl} onChange={e => setMyDomainUrl(e.target.value)} placeholder="https://example.my.salesforce.com" />
        </>
      )}

      <label style={s.label}>ユーザー名</label>
      <input style={s.input} value={username} onChange={e => setUsername(e.target.value)} placeholder="user@example.com" autoComplete="off" />

      <label style={s.label}>パスワード</label>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...s.input, paddingRight: 60 }}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button type="button" onClick={() => setShowPassword(v => !v)} style={s.toggleBtn}>
          {showPassword ? '隠す' : '表示'}
        </button>
      </div>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.actions}>
        <button type="button" onClick={onCancel} style={s.cancelBtn}>キャンセル</button>
        <button type="submit" style={s.saveBtn}>保存</button>
      </div>
    </form>
  )
}

const s: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 480 },
  heading: { fontSize: 16, fontWeight: 700, margin: '0 0 8px' },
  label: { fontSize: 12, fontWeight: 600, color: '#444' },
  input: { padding: '7px 10px', fontSize: 14, border: '1px solid #ccc', borderRadius: 6, width: '100%' },
  toggleBtn: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 12, color: '#0070d2', cursor: 'pointer', padding: 0 },
  error: { fontSize: 12, color: '#c0392b', margin: 0 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: { padding: '7px 16px', fontSize: 13, border: '1px solid #ccc', borderRadius: 6, background: '#f5f5f5', cursor: 'pointer' },
  saveBtn: { padding: '7px 20px', fontSize: 13, fontWeight: 600, background: '#0070d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
}
