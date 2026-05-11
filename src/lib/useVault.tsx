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
import { loadSettings } from './storage'
import type { Vault } from './types'

type VaultStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked'

type VaultContextValue = {
  status: VaultStatus
  vault: Vault | null
  error: string | null
  initialize: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => void
  applyChange: (fn: (vault: Vault) => Vault) => Promise<void>
  changeVaultPassword: (newPassword: string) => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('loading')
  const [vault, setVault] = useState<Vault | null>(null)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef<string | null>(null)
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLockTimer = () => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
  }

  const lock = useCallback(() => {
    clearLockTimer()
    passwordRef.current = null
    setVault(null)
    setStatus('locked')
  }, [])

  const startLockTimer = useCallback(
    async (password: string) => {
      clearLockTimer()
      const settings = await loadSettings()
      lockTimerRef.current = setTimeout(() => lock(), settings.autoLockMinutes * 60 * 1000)
    },
    [lock]
  )

  useEffect(() => {
    isInitialized().then((initialized) => {
      setStatus(initialized ? 'locked' : 'uninitialized')
    })
    return clearLockTimer
  }, [])

  const initialize = useCallback(
    async (password: string) => {
      setError(null)
      try {
        const newVault = await initializeVault(password)
        passwordRef.current = password
        setVault(newVault)
        setStatus('unlocked')
        startLockTimer(password)
      } catch {
        setError('初期化に失敗しました')
      }
    },
    [startLockTimer]
  )

  const unlock = useCallback(
    async (password: string) => {
      setError(null)
      try {
        const loaded = await openVault(password)
        passwordRef.current = password
        setVault(loaded)
        setStatus('unlocked')
        startLockTimer(password)
      } catch {
        setError('パスワードが正しくありません')
      }
    },
    [startLockTimer]
  )

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
