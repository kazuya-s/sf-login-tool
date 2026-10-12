import { describe, it, expect } from 'vitest'
import { findCookieStoreId } from '../src/lib/cookies'

describe('findCookieStoreId', () => {
  const stores = [
    { id: '0', tabIds: [1, 2] },
    { id: '1', tabIds: [7] },
  ]

  it('returns the regular profile store for a normal tab', () => {
    expect(findCookieStoreId(stores, 2)).toBe('0')
  })

  it('returns the incognito store for an incognito tab', () => {
    expect(findCookieStoreId(stores, 7)).toBe('1')
  })

  it('returns undefined when the tab is in no store (e.g. already closed)', () => {
    expect(findCookieStoreId(stores, 99)).toBeUndefined()
    expect(findCookieStoreId([], 1)).toBeUndefined()
  })
})
