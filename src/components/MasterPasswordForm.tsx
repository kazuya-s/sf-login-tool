import { type FormEvent, useState } from 'react'

type Props = {
  mode: 'initialize' | 'unlock'
  onSubmit: (password: string) => Promise<void>
  error: string | null
}

export function MasterPasswordForm({ mode, onSubmit, error }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    if (mode === 'initialize') {
      if (password.length < 8) {
        setValidationError('パスワードは8文字以上で入力してください')
        return
      }
      if (password !== confirm) {
        setValidationError('パスワードが一致しません')
        return
      }
    }
    setSubmitting(true)
    await onSubmit(password)
    setSubmitting(false)
  }

  const displayError = validationError ?? error

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>SF Login Tool</h1>
      <p style={styles.subtitle}>
        {mode === 'initialize' ? 'マスターパスワードを設定' : 'マスターパスワードを入力'}
      </p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="password"
          placeholder="マスターパスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          autoFocus
          disabled={submitting}
        />
        {mode === 'initialize' && (
          <input
            type="password"
            placeholder="パスワードを再入力"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={styles.input}
            disabled={submitting}
          />
        )}
        {displayError && <p style={styles.error}>{displayError}</p>}
        <button type="submit" style={styles.button} disabled={submitting || !password}>
          {submitting ? '処理中...' : mode === 'initialize' ? '設定する' : '解錠'}
        </button>
      </form>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  title: { fontSize: 16, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 13, color: '#555', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: {
    padding: '8px 10px', fontSize: 14, border: '1px solid #ccc',
    borderRadius: 6, outline: 'none', width: '100%',
  },
  error: { fontSize: 12, color: '#c0392b', margin: 0 },
  button: {
    padding: '9px 0', fontSize: 14, fontWeight: 600, background: '#0070d2',
    color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
  },
}
