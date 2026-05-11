import { type FormEvent, useState } from 'react'
import { useVault } from '../lib/useVault'

export function ChangePasswordForm() {
  const { changeVaultPassword } = useVault()
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (newPassword.length < 8) { setError('パスワードは8文字以上で入力してください'); return }
    if (newPassword !== confirm) { setError('パスワードが一致しません'); return }
    setSubmitting(true)
    try {
      await changeVaultPassword(newPassword)
      setSuccess(true)
      setNewPassword('')
      setConfirm('')
    } catch {
      setError('パスワードの変更に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <input
        type="password"
        placeholder="新しいパスワード（8文字以上）"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        style={s.input}
        disabled={submitting}
      />
      <input
        type="password"
        placeholder="パスワードを再入力"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        style={s.input}
        disabled={submitting}
      />
      {error && <p style={s.error}>{error}</p>}
      {success && <p style={s.success}>パスワードを変更しました</p>}
      <button type="submit" style={s.btn} disabled={submitting || !newPassword}>
        {submitting ? '処理中...' : 'パスワードを変更'}
      </button>
    </form>
  )
}

const s: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 },
  input: { padding: '7px 10px', fontSize: 14, border: '1px solid #ccc', borderRadius: 6 },
  error: { fontSize: 12, color: '#c0392b', margin: 0 },
  success: { fontSize: 12, color: '#27ae60', margin: 0 },
  btn: { padding: '8px 0', fontSize: 14, fontWeight: 600, background: '#0070d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
}
