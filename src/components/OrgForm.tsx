import { type FormEvent, useState } from 'react'
import type { Org, OrgKind } from '../lib/types'
import type { OrgInput } from '../lib/orgs'
import { useAppSettings } from '../lib/useAppSettings'
import { getT } from '../lib/i18n'

type Props = {
  initial?: Org
  groups?: string[]
  onSave: (input: OrgInput) => void
  onCancel: () => void
  onDelete?: () => void
}

export function OrgForm({ initial, groups = [], onSave, onCancel, onDelete }: Props) {
  const { settings } = useAppSettings()
  const t = getT(settings.lang)
  const [label, setLabel] = useState(initial?.label ?? '')
  const [kind, setKind] = useState<OrgKind>(initial?.kind ?? 'production')
  const [group, setGroup] = useState(initial?.group ?? 'default')
  const [myDomainUrl, setMyDomainUrl] = useState(initial?.myDomainUrl ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!label.trim()) { setError(t.errLabel); return }
    if (!username.trim()) { setError(t.errUsername); return }
    if (!password) { setError(t.errPassword); return }
    if (kind === 'mydomain') {
      if (!myDomainUrl.trim()) { setError(t.errMyDomainRequired); return }
      if (!myDomainUrl.startsWith('https://')) { setError(t.errMyDomainHttps); return }
    }
    onSave({ label: label.trim(), kind, group: group.trim() || undefined, myDomainUrl: kind === 'mydomain' ? myDomainUrl.trim() : undefined, username: username.trim(), password, notes: notes.trim() || undefined })
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <h2 style={s.heading}>{initial ? t.editOrgTitle : t.addOrgTitle}</h2>

      <label style={s.label}>{t.labelField}</label>
      <input style={s.input} value={label} onChange={e => setLabel(e.target.value)} placeholder={t.labelPlaceholder} autoFocus />

      <label style={s.label}>{t.groupField}</label>
      <input
        style={s.input}
        list="org-group-list"
        value={group}
        onChange={e => setGroup(e.target.value)}
        placeholder={t.groupPlaceholder}
        autoComplete="off"
      />
      {groups.length > 0 && (
        <datalist id="org-group-list">
          {groups.map(g => <option key={g} value={g} />)}
        </datalist>
      )}

      <label style={s.label}>{t.kindField}</label>
      <select style={s.input} value={kind} onChange={e => setKind(e.target.value as OrgKind)}>
        <option value="production">{t.kindProduction}</option>
        <option value="sandbox">{t.kindSandbox}</option>
        <option value="developer">{t.kindDeveloper}</option>
        <option value="mydomain">{t.kindMydomain}</option>
      </select>

      {kind === 'mydomain' && (
        <>
          <label style={s.label}>{t.myDomainUrlField}</label>
          <input style={s.input} value={myDomainUrl} onChange={e => setMyDomainUrl(e.target.value)} placeholder="https://example.my.salesforce.com" />
        </>
      )}

      <label style={s.label}>{t.usernameField}</label>
      <input style={s.input} value={username} onChange={e => setUsername(e.target.value)} placeholder={t.usernamePlaceholder} autoComplete="off" />

      <label style={s.label}>{t.passwordField}</label>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...s.input, paddingRight: 60 }}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button type="button" onClick={() => setShowPassword(v => !v)} style={s.toggleBtn}>
          {showPassword ? t.hidePassword : t.showPassword}
        </button>
      </div>

      <label style={s.label}>{t.notesField}</label>
      <textarea style={s.textarea} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t.notesPlaceholder} rows={3} />

      {(initial?.sfOrgId || initial?.sfVersion) && (
        <div style={s.orgInfo}>
          <p style={s.orgInfoTitle}>{t.orgInfoSection}</p>
          {initial.sfOrgId && <p style={s.orgInfoRow}><span style={s.orgInfoKey}>{t.orgIdLabel}</span>{initial.sfOrgId}</p>}
          {initial.sfVersion && <p style={s.orgInfoRow}><span style={s.orgInfoKey}>{t.apiVersionLabel}</span>v{initial.sfVersion}</p>}
        </div>
      )}

      {error && <p style={s.error}>{error}</p>}

      <div style={s.actions}>
        {onDelete && (
          <button type="button" onClick={onDelete} style={s.deleteBtn}>{t.delete}</button>
        )}
        <div style={s.actionRight}>
          <button type="button" onClick={onCancel} style={s.cancelBtn}>{t.cancel}</button>
          <button type="submit" style={s.saveBtn}>{t.save}</button>
        </div>
      </div>
    </form>
  )
}

const s: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 480 },
  heading: { fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-sub)' },
  input: {
    padding: '7px 10px', fontSize: 14, border: '1px solid var(--input-border)',
    borderRadius: 6, width: '100%', background: 'var(--input-bg)', color: 'var(--text)',
  },
  toggleBtn: {
    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', fontSize: 12, color: 'var(--primary)', cursor: 'pointer', padding: 0,
  },
  textarea: {
    padding: '7px 10px', fontSize: 13, border: '1px solid var(--input-border)',
    borderRadius: 6, width: '100%', background: 'var(--input-bg)', color: 'var(--text)',
    resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.4',
  },
  orgInfo: { background: 'var(--bg-group)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', marginTop: 2 },
  orgInfoTitle: { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' },
  orgInfoRow: { fontSize: 12, color: 'var(--text)', margin: '2px 0', display: 'flex', gap: 6 },
  orgInfoKey: { color: 'var(--text-sub)', fontWeight: 600, minWidth: 80, flexShrink: 0 },
  error: { fontSize: 12, color: 'var(--danger)', margin: 0 },
  actions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  actionRight: { display: 'flex', gap: 8 },
  cancelBtn: {
    padding: '7px 16px', fontSize: 13, border: '1px solid var(--btn-sec-border)',
    borderRadius: 6, background: 'var(--btn-sec-bg)', color: 'var(--text)', cursor: 'pointer',
  },
  saveBtn: {
    padding: '7px 20px', fontSize: 13, fontWeight: 600, background: 'var(--primary)',
    color: 'var(--primary-fg)', border: 'none', borderRadius: 6, cursor: 'pointer',
  },
  deleteBtn: {
    padding: '7px 14px', fontSize: 13, fontWeight: 600, background: 'none',
    color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 6, cursor: 'pointer',
  },
}
