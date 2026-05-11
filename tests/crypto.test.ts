import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../src/lib/crypto'

describe('crypto', () => {
  const password = 'correct-horse-battery-staple'
  const plaintext = JSON.stringify({ orgs: [{ id: '1', label: 'Test Org' }] })

  it('encrypts and decrypts correctly (round-trip)', async () => {
    const blob = await encrypt(password, plaintext)
    const result = await decrypt(password, blob)
    expect(result).toBe(plaintext)
  })

  it('produces different ciphertext each call (random IV + salt)', async () => {
    const blob1 = await encrypt(password, plaintext)
    const blob2 = await encrypt(password, plaintext)
    expect(blob1.iv).not.toBe(blob2.iv)
    expect(blob1.salt).not.toBe(blob2.salt)
    expect(blob1.ciphertext).not.toBe(blob2.ciphertext)
  })

  it('blob fields are non-empty base64 strings', async () => {
    const blob = await encrypt(password, plaintext)
    const b64 = /^[A-Za-z0-9+/]+=*$/
    expect(blob.salt).toMatch(b64)
    expect(blob.iv).toMatch(b64)
    expect(blob.ciphertext).toMatch(b64)
  })

  it('throws on wrong password', async () => {
    const blob = await encrypt(password, plaintext)
    await expect(decrypt('wrong-password', blob)).rejects.toThrow()
  })

  it('throws on tampered ciphertext', async () => {
    const blob = await encrypt(password, plaintext)
    const tampered = { ...blob, ciphertext: blob.ciphertext.slice(0, -4) + 'AAAA' }
    await expect(decrypt(password, tampered)).rejects.toThrow()
  })

  it('throws on tampered IV', async () => {
    const blob = await encrypt(password, plaintext)
    const tampered = { ...blob, iv: blob.iv.slice(0, -4) + 'AAAA' }
    await expect(decrypt(password, tampered)).rejects.toThrow()
  })
})
