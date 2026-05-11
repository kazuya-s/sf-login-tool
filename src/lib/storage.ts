import type { EncryptedBlob } from './crypto'
import type { Settings } from './types'

const KEY_VAULT = 'vault'
const KEY_SETTINGS = 'settings'

export const DEFAULT_SETTINGS: Settings = { autoLockMinutes: 5 }

export async function saveVault(blob: EncryptedBlob): Promise<void> {
  await chrome.storage.local.set({ [KEY_VAULT]: blob })
}

export async function loadVault(): Promise<EncryptedBlob | null> {
  const result = await chrome.storage.local.get(KEY_VAULT)
  return (result[KEY_VAULT] as EncryptedBlob) ?? null
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY_SETTINGS]: settings })
}

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(KEY_SETTINGS)
  return { ...DEFAULT_SETTINGS, ...(result[KEY_SETTINGS] as Partial<Settings>) }
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.clear()
}

const KEY_SESSION_PASSWORD = 'session_password'

export async function saveSessionPassword(password: string): Promise<void> {
  await chrome.storage.session.set({ [KEY_SESSION_PASSWORD]: password })
}

export async function loadSessionPassword(): Promise<string | null> {
  const result = await chrome.storage.session.get(KEY_SESSION_PASSWORD)
  return (result[KEY_SESSION_PASSWORD] as string) ?? null
}

export async function clearSessionPassword(): Promise<void> {
  await chrome.storage.session.remove(KEY_SESSION_PASSWORD)
}
