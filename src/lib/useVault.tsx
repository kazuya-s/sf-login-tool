import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { openVault, initializeVault, isInitialized, persistVault, changePassword, INTERNAL_KEY } from './vault'
import { saveSessionPassword, loadSessionPassword, clearSessionPassword } from './storage'
import { SETTINGS_STORAGE_KEY } from './useAppSettings'
import type { AppSettings } from './useAppSettings'
import type { Vault } from './types'

type VaultStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked'

type VaultContextValue = {
  status: VaultStatus
  vault: Vault | null
  error: string | null
  isMasterPasswordEnabled: boolean
  initialize: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => Promise<void>
  applyChange: (fn: (vault: Vault) => Vault) => Promise<void>
  changeVaultPassword: (newPassword: string) => Promise<void>
  enableMasterPassword: (newPassword: string) => Promise<void>
  disableMasterPassword: () => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('loading')
  const [vault, setVault] = useState<Vault | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isMasterPasswordEnabled, setIsMasterPasswordEnabled] = useState(false)
  const passwordRef = useRef<string | null>(null)
  const masterPwEnabledRef = useRef(false)

  const lock = useCallback(async () => {
    if (!masterPwEnabledRef.current) return
    await clearSessionPassword()
    passwordRef.current = null
    setVault(null)
    setStatus('locked')
  }, [])

  useEffect(() => {
    const handler = (msg: { type?: string }) => {
      if (msg.type === 'VAULT_UPDATED' && passwordRef.current) {
        openVault(passwordRef.current).then(loaded => setVault(loaded)).catch(() => {})
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  useEffect(() => {
    async function init() {
      const r = await chrome.storage.local.get(SETTINGS_STORAGE_KEY)
      const settings = r[SETTINGS_STORAGE_KEY] as Partial<AppSettings> | undefined
      const masterPasswordEnabled = settings?.masterPasswordEnabled ?? false
      masterPwEnabledRef.current = masterPasswordEnabled
      setIsMasterPasswordEnabled(masterPasswordEnabled)

      if (!masterPasswordEnabled) {
        const initialized = await isInitialized()
        if (!initialized) {
          const newVault = await initializeVault(INTERNAL_KEY)
          passwordRef.current = INTERNAL_KEY
          setVault(newVault)
          setStatus('unlocked')
          return
        }
        try {
          const loaded = await openVault(INTERNAL_KEY)
          passwordRef.current = INTERNAL_KEY
          setVault(loaded)
          setStatus('unlocked')
        } catch {
          // Vault encrypted with real password but settings say disabled — fall back to locked
          setStatus('locked')
        }
        return
      }

      const initialized = await isInitialized()
      if (!initialized) {
        setStatus('uninitialized')
        return
      }
      const sessionPw = await loadSessionPassword()
      if (sessionPw) {
        try {
          const loaded = await openVault(sessionPw)
          passwordRef.current = sessionPw
          setVault(loaded)
          setStatus('unlocked')
          return
        } catch {
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

  const enableMasterPassword = useCallback(async (newPassword: string) => {
    if (!passwordRef.current) throw new Error('Vault is locked')
    await changePassword(passwordRef.current, newPassword)
    passwordRef.current = newPassword
    await saveSessionPassword(newPassword)
    masterPwEnabledRef.current = true
    setIsMasterPasswordEnabled(true)
  }, [])

  const disableMasterPassword = useCallback(async () => {
    if (!passwordRef.current) throw new Error('Vault is locked')
    await changePassword(passwordRef.current, INTERNAL_KEY)
    passwordRef.current = INTERNAL_KEY
    await clearSessionPassword()
    masterPwEnabledRef.current = false
    setIsMasterPasswordEnabled(false)
  }, [])

  return (
    <VaultContext.Provider value={{ status, vault, error, isMasterPasswordEnabled, initialize, unlock, lock, applyChange, changeVaultPassword, enableMasterPassword, disableMasterPassword }}>
      {children}
    </VaultContext.Provider>
  )
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used within VaultProvider')
  return ctx
}
