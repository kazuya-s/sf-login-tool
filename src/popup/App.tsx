import { VaultProvider, useVault } from '../lib/useVault'
import { MasterPasswordForm } from '../components/MasterPasswordForm'

function PopupContent() {
  const { status, error, initialize, unlock, lock } = useVault()

  if (status === 'loading') {
    return <div style={{ padding: 16, fontSize: 13, color: '#888' }}>読み込み中...</div>
  }

  if (status === 'uninitialized') {
    return <MasterPasswordForm mode="initialize" onSubmit={initialize} error={error} />
  }

  if (status === 'locked') {
    return <MasterPasswordForm mode="unlock" onSubmit={unlock} error={error} />
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>SF Login Tool</h1>
        <button onClick={lock} style={styles.lockBtn}>ロック</button>
      </div>
      <p style={{ fontSize: 13, color: '#666' }}>組織が登録されていません。設定から追加してください。</p>
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

const styles: Record<string, React.CSSProperties> = {
  lockBtn: {
    padding: '4px 10px', fontSize: 12, border: '1px solid #ccc',
    borderRadius: 4, background: '#f5f5f5', cursor: 'pointer',
  },
}
