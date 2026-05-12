import { type FormEvent, useState } from 'react'
import { useVault } from '../lib/useVault'
import { useAppSettings } from '../lib/useAppSettings'
import { getT } from '../lib/i18n'

export function ChangePasswordForm() {
  const { changeVaultPassword } = useVault()
  const { settings } = useAppSettings()
  const t = getT(settings.lang)
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (newPassword.length < 8) { setError(t.errPasswordTooShort); return }
    if (newPassword !== confirm) { setError(t.errPasswordMismatch); return }
    setSubmitting(true)
    try {
      await changeVaultPassword(newPassword)
      setSuccess(true)
      setNewPassword('')
      setConfirm('')
    } catch {
      setError(t.changePasswordError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <input
        type="password"
        placeholder={t.newPasswordPlaceholder}
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        style={s.input}
        disabled={submitting}
      />
      <input
        type="password"
        placeholder={t.confirmPasswordPlaceholder}
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        style={s.input}
        disabled={submitting}
      />
      {error && <p style={s.error}>{error}</p>}
      {success && <p style={s.success}>{t.changePasswordSuccess}</p>}
      <button type="submit" style={s.btn} disabled={submitting || !newPassword}>
        {submitting ? t.processing : t.changePasswordBtn}
      </button>
    </form>
  )
}

const s: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 },
  input: {
    padding: '7px 10px', fontSize: 14, border: '1px solid var(--input-border)',
    borderRadius: 6, background: 'var(--input-bg)', color: 'var(--text)',
  },
  error: { fontSize: 12, color: 'var(--danger)', margin: 0 },
  success: { fontSize: 12, color: 'var(--success)', margin: 0 },
  btn: {
    padding: '8px 0', fontSize: 14, fontWeight: 600, background: 'var(--primary)',
    color: 'var(--primary-fg)', border: 'none', borderRadius: 6, cursor: 'pointer',
  },
}
