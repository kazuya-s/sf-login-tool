import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { openVault, initializeVault, isInitialized, persistVault, changePassword } from './vault'
import { saveSessionPassword, loadSessionPassword, clearSessionPassword } from './storage'
import type { Vault } from './types'

type VaultStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked'

type VaultContextValue = {
  status: VaultStatus
  vault: Vault | null
  error: string | null
  initialize: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => Promise<void>
  applyChange: (fn: (vault: Vault) => Vault) => Promise<void>
  changeVaultPassword: (newPassword: string) => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('loading')
  const [vault, setVault] = useState<Vault | null>(null)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef<string | null>(null)

  const lock = useCallback(async () => {
    await clearSessionPassword()
    passwordRef.current = null
    setVault(null)
    setStatus('locked')
  }, [])

  useEffect(() => {
    async function init() {
      const initialized = await isInitialized()
      if (!initialized) {
        setStatus('uninitialized')
        return
      }
      // Restore session across popup open/close cycles
      const sessionPw = await loadSessionPassword()
      if (sessionPw) {
        try {
          const loaded = await openVault(sessionPw)
          passwordRef.current = sessionPw
          setVault(loaded)
          setStatus('unlocked')
          return
        } catch {
          // Session password no longer valid; clear it and ask user
          await clearSessionPassword()
        }
      }
      setStatus('locked')
    }
    init()
  }, [])

  const initialize = useCallback(async (password: string) => {
    setError(null)
    try {
      const newVault = await initializeVault(password)
      passwordRef.current = password
      await saveSessionPassword(password)
      setVault(newVault)
      setStatus('unlocked')
    } catch {
      setError('初期化に失敗しました')
    }
  }, [])

  const unlock = useCallback(async (password: string) => {
    setError(null)
    try {
      const loaded = await openVault(password)
      passwordRef.current = password
      await saveSessionPassword(password)
      setVault(loaded)
      setStatus('unlocked')
    } catch {
      setError('パスワードが正しくありません')
    }
  }, [])

  const applyChange = useCallback(async (fn: (vault: Vault) => Vault) => {
    if (!vault || !passwordRef.current) throw new Error('Vault is locked')
    const updated = fn(vault)
    await persistVault(passwordRef.current, updated)
    setVault(updated)
  }, [vault])

  const changeVaultPassword = useCallback(async (newPassword: string) => {
    if (!passwordRef.current) throw new Error('Vault is locked')
    await changePassword(passwordRef.current, newPassword)
    passwordRef.current = newPassword
    await saveSessionPassword(newPassword)
  }, [])

  return (
    <VaultContext.Provider value={{ status, vault, error, initialize, unlock, lock, applyChange, changeVaultPassword }}>
      {children}
    </VaultContext.Provider>
  )
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used within VaultProvider')
  return ctx
}
