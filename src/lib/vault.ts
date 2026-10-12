import { encrypt, decrypt } from './crypto'
import { saveVault, loadVault } from './storage'
import type { Vault } from './types'

const EMPTY_VAULT: Vault = { orgs: [] }

// Fixed key used to encrypt vault when master password is disabled.
// Provides storage-at-rest encoding without requiring user authentication.
export const INTERNAL_KEY = 'sf-login-tool-no-master-password-v1'

export async function isInitialized(): Promise<boolean> {
  return (await loadVault()) !== null
}

export async function initializeVault(password: string): Promise<Vault> {
  const blob = await encrypt(password, JSON.stringify(EMPTY_VAULT))
  await saveVault(blob)
  return EMPTY_VAULT
}

export async function openVault(password: string): Promise<Vault> {
  const blob = await loadVault()
  if (!blob) throw new Error('Vault not initialized')
  const json = await decrypt(password, blob)
  return dropRemovedFields(JSON.parse(json) as Vault)
}

// Fields that older versions stored but are no longer used. They are dropped on open,
// so they disappear from storage on the next save.
// - sfVersion: the API version captured at login, which went stale after each Salesforce release.
function dropRemovedFields(vault: Vault): Vault {
  const orgs = vault.orgs.map(org => {
    const copy: typeof org & { sfVersion?: unknown } = { ...org }
    delete copy.sfVersion
    return copy
  })
  return { ...vault, orgs }
}

export async function persistVault(password: string, vault: Vault): Promise<void> {
  const blob = await encrypt(password, JSON.stringify(vault))
  await saveVault(blob)
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const vault = await openVault(oldPassword)
  await persistVault(newPassword, vault)
}
