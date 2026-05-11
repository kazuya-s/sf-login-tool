import { encrypt, decrypt } from './crypto'
import { saveVault, loadVault } from './storage'
import type { Vault } from './types'

const EMPTY_VAULT: Vault = { orgs: [] }

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
  return JSON.parse(json) as Vault
}

export async function persistVault(password: string, vault: Vault): Promise<void> {
  const blob = await encrypt(password, JSON.stringify(vault))
  await saveVault(blob)
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const vault = await openVault(oldPassword)
  await persistVault(newPassword, vault)
}
