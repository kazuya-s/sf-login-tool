import { VaultProvider, useVault } from '../lib/useVault'
import { MasterPasswordForm } from '../components/MasterPasswordForm'
import { ChangePasswordForm } from '../components/ChangePasswordForm'

function OptionsContent() {
  const { status, error, initialize, unlock, lock } = useVault()

  if (status === 'loading') return <p style={{ color: '#888' }}>読み込み中...</p>
  if (status === 'uninitialized') return <MasterPasswordForm mode="initialize" onSubmit={initialize} error={error} />
  if (status === 'locked') return <MasterPasswordForm mode="unlock" onSubmit={unlock} error={error} />

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>SF Login Tool - セキュリティ設定</h1>
        <button onClick={lock} style={s.lockBtn}>ロック</button>
      </header>

      <section style={s.section}>
        <h2 style={s.sectionTitle}>マスターパスワードの変更</h2>
        <p style={s.hint}>変更後は新しいパスワードで解錠してください。</p>
        <ChangePasswordForm />
      </section>
    </div>
  )
}

export function App() {
  return (
    <VaultProvider>
      <OptionsContent />
    </VaultProvider>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 480, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 18, fontWeight: 700, margin: 0 },
  lockBtn: { padding: '5px 12px', fontSize: 13, border: '1px solid #ccc', borderRadius: 5, background: '#f5f5f5', cursor: 'pointer' },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 15, fontWeight: 700, margin: '0 0 6px' },
  hint: { fontSize: 13, color: '#666', margin: '0 0 12px' },
}
