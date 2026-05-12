import { type FormEvent, useState } from 'react'
import { useAppSettings } from '../lib/useAppSettings'
import { getT } from '../lib/i18n'

type Props = {
  mode: 'initialize' | 'unlock'
  onSubmit: (password: string) => Promise<void>
  error: string | null
}

export function MasterPasswordForm({ mode, onSubmit, error }: Props) {
  const { settings } = useAppSettings()
  const t = getT(settings.lang)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    if (mode === 'initialize') {
      if (password.length < 8) { setValidationError(t.errPasswordTooShort); return }
      if (password !== confirm) { setValidationError(t.errPasswordMismatch); return }
    }
    setSubmitting(true)
    await onSubmit(password)
    setSubmitting(false)
  }

  const displayError = validationError ?? error

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{t.masterPasswordTitle}</h1>
      <p style={styles.subtitle}>
        {mode === 'initialize' ? t.initSubtitle : t.unlockSubtitle}
      </p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="password"
          placeholder={t.masterPasswordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          autoFocus
          disabled={submitting}
        />
        {mode === 'initialize' && (
          <input
            type="password"
            placeholder={t.confirmPasswordPlaceholder}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={styles.input}
            disabled={submitting}
          />
        )}
        {displayError && <p style={styles.error}>{displayError}</p>}
        <button type="submit" style={styles.button} disabled={submitting || !password}>
          {submitting ? t.processing : mode === 'initialize' ? t.setPasswordBtn : t.unlockBtn}
        </button>
      </form>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' },
  subtitle: { fontSize: 13, color: 'var(--text-sub)', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: {
    padding: '8px 10px', fontSize: 14, border: '1px solid var(--input-border)',
    borderRadius: 6, outline: 'none', width: '100%',
    background: 'var(--input-bg)', color: 'var(--text)',
  },
  error: { fontSize: 12, color: 'var(--danger)', margin: 0 },
  button: {
    padding: '9px 0', fontSize: 14, fontWeight: 600, background: 'var(--primary)',
    color: 'var(--primary-fg)', border: 'none', borderRadius: 6, cursor: 'pointer',
  },
}
