import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveVault,
  loadVault,
  saveSettings,
  loadSettings,
  clearAll,
  DEFAULT_SETTINGS,
} from '../src/lib/storage'
import type { EncryptedBlob } from '../src/lib/crypto'

function makeChromeMock() {
  const store: Record<string, unknown> = {}
  return {
    storage: {
      local: {
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(store, items)
        }),
        get: vi.fn(async (key: string) => {
          return { [key]: store[key] }
        }),
        clear: vi.fn(async () => {
          for (const k of Object.keys(store)) delete store[k]
        }),
        _store: store,
      },
    },
  }
}

const sampleBlob: EncryptedBlob = {
  salt: 'c2FsdA==',
  iv: 'aXY=',
  ciphertext: 'Y2lwaGVydGV4dA==',
}

describe('storage', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', makeChromeMock())
  })

  describe('vault', () => {
    it('returns null when no vault is stored', async () => {
      expect(await loadVault()).toBeNull()
    })

    it('saves and loads a vault blob', async () => {
      await saveVault(sampleBlob)
      expect(await loadVault()).toEqual(sampleBlob)
    })

    it('overwrites existing vault on save', async () => {
      await saveVault(sampleBlob)
      const updated: EncryptedBlob = { ...sampleBlob, ciphertext: 'bmV3' }
      await saveVault(updated)
      expect(await loadVault()).toEqual(updated)
    })
  })

  describe('settings', () => {
    it('returns defaults when no settings are stored', async () => {
      expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
    })

    it('saves and loads settings', async () => {
      await saveSettings({ autoLockMinutes: 15 })
      expect(await loadSettings()).toEqual({ autoLockMinutes: 15 })
    })

    it('merges missing fields with defaults', async () => {
      await chrome.storage.local.set({ settings: {} })
      expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
    })
  })

  describe('clearAll', () => {
    it('removes vault and settings', async () => {
      await saveVault(sampleBlob)
      await saveSettings({ autoLockMinutes: 30 })
      await clearAll()
      expect(await loadVault()).toBeNull()
      expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
    })
  })
})
