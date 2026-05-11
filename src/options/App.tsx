import { VaultProvider, useVault } from '../lib/useVault'
import { MasterPasswordForm } from '../components/MasterPasswordForm'

function OptionsContent() {
  const { status, error, initialize, unlock } = useVault()

  if (status === 'loading') {
    return <p style={{ color: '#888' }}>読み込み中...</p>
  }

  if (status === 'uninitialized') {
    return <MasterPasswordForm mode="initialize" onSubmit={initialize} error={error} />
  }

  if (status === 'locked') {
    return <MasterPasswordForm mode="unlock" onSubmit={unlock} error={error} />
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>SF Login Tool - 設定</h1>
      <p style={{ color: '#666' }}>Coming soon...</p>
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
