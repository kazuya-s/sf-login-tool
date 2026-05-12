import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isInitialized, initializeVault, openVault, persistVault, changePassword } from '../src/lib/vault'

vi.mock('../src/lib/crypto', () => ({
  encrypt: vi.fn(async (_password: string, data: string) => ({
    salt: 'mock-salt',
    iv: 'mock-iv',
    ciphertext: btoa(data),
  })),
  decrypt: vi.fn(async (_password: string, blob: { ciphertext: string }) =>
    atob(blob.ciphertext)
  ),
}))

function makeStoreMock() {
  let stored: unknown = null
  return {
    saveVault: vi.fn(async (blob: unknown) => { stored = blob }),
    loadVault: vi.fn(async () => stored),
  }
}

vi.mock('../src/lib/storage', async () => {
  const store = makeStoreMock()
  return store
})

describe('vault', () => {
  beforeEach(async () => {
    const storage = await import('../src/lib/storage')
    vi.mocked(storage.loadVault).mockReset()
    vi.mocked(storage.saveVault).mockReset()
    let stored: unknown = null
    vi.mocked(storage.saveVault).mockImplementation(async (blob) => { stored = blob })
    vi.mocked(storage.loadVault).mockImplementation(async () => stored as ReturnType<typeof storage.loadVault> extends Promise<infer T> ? T : never)
  })

  it('isInitialized returns false when no vault exists', async () => {
    expect(await isInitialized()).toBe(false)
  })

  it('isInitialized returns true after initialization', async () => {
    await initializeVault('password123')
    expect(await isInitialized()).toBe(true)
  })

  it('initializeVault creates an empty vault', async () => {
    const vault = await initializeVault('password123')
    expect(vault.orgs).toEqual([])
  })

  it('openVault throws when not initialized', async () => {
    await expect(openVault('password123')).rejects.toThrow('Vault not initialized')
  })

  it('openVault returns initialized vault', async () => {
    await initializeVault('my-password')
    const vault = await openVault('my-password')
    expect(vault.orgs).toEqual([])
  })

  it('persistVault saves changes that are readable back', async () => {
    await initializeVault('my-password')
    const modified = { orgs: [{ id: '1', label: 'Test', kind: 'production' as const, username: 'u', password: 'p', createdAt: 0, updatedAt: 0 }] }
    await persistVault('my-password', modified)
    const reloaded = await openVault('my-password')
    expect(reloaded.orgs).toHaveLength(1)
    expect(reloaded.orgs[0].label).toBe('Test')
  })

  it('changePassword allows opening vault with new password', async () => {
    await initializeVault('old-pass')
    await changePassword('old-pass', 'new-pass')
    const vault = await openVault('new-pass')
    expect(vault.orgs).toEqual([])
  })
})
