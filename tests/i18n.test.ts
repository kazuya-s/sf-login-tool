import { describe, it, expect } from 'vitest'
import { LANGS, getT } from '../src/lib/i18n'

describe('i18n', () => {
  it('defines the same set of keys for every language', () => {
    const [first, ...rest] = LANGS.map(({ code }) => Object.keys(getT(code)).sort())
    for (const keys of rest) {
      expect(keys).toEqual(first)
    }
  })

  it('gives every language the same type (string or function) for each key', () => {
    const [first, ...rest] = LANGS.map(({ code }) => getT(code))
    for (const key of Object.keys(first) as (keyof ReturnType<typeof getT>)[]) {
      const expectedType = typeof first[key]
      for (const t of rest) {
        expect(typeof t[key]).toBe(expectedType)
      }
    }
  })

  it('has no empty translation strings', () => {
    for (const { code } of LANGS) {
      const t = getT(code)
      for (const [key, value] of Object.entries(t)) {
        if (typeof value === 'string') expect(value.trim(), `${code}.${key}`).not.toBe('')
      }
    }
  })
})
