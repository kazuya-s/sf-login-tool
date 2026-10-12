import { describe, it, expect } from 'vitest'
import { parseImportJson, exportVaultAsJson, applyImport } from '../src/lib/importExport'
import type { Vault } from '../src/lib/types'

const base = { label: 'Org', username: 'u@example.com', password: 'p' }
const parse = (items: unknown[]) => parseImportJson(JSON.stringify({ version: 1, orgs: items }))

describe('parseImportJson', () => {
  it('accepts a bare array as well as the export wrapper', () => {
    const item = { ...base, kind: 'production' }
    expect(parseImportJson(JSON.stringify([item])).orgs).toHaveLength(1)
    expect(parse([item]).orgs).toHaveLength(1)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseImportJson('{')).toThrow('invalid_json')
  })

  it('throws when there is no orgs array', () => {
    expect(() => parseImportJson('{"foo":1}')).toThrow('invalid_format')
  })

  it('skips items missing required fields', () => {
    const { orgs, errors } = parse([{ kind: 'production', username: 'u', password: 'p' }])
    expect(orgs).toHaveLength(0)
    expect(errors).toHaveLength(1)
  })

  it('accepts a valid My Domain URL and trims it', () => {
    const { orgs, errors } = parse([{ ...base, kind: 'mydomain', myDomainUrl: ' https://example.my.salesforce.com ' }])
    expect(errors).toEqual([])
    expect(orgs[0].myDomainUrl).toBe('https://example.my.salesforce.com')
  })

  it('rejects a mydomain org without a URL', () => {
    const { orgs, errors } = parse([{ ...base, kind: 'mydomain' }])
    expect(orgs).toHaveLength(0)
    expect(errors[0]).toMatch(/myDomainUrl required/)
  })

  it.each([
    'https://evil.example',
    'http://example.my.salesforce.com',
    'https://example.lightning.force.com',
    'javascript:alert(1)',
  ])('rejects the non-Salesforce My Domain URL %s', url => {
    const { orgs, errors } = parse([{ ...base, kind: 'mydomain', myDomainUrl: url }])
    expect(orgs).toHaveLength(0)
    expect(errors[0]).toMatch(/myDomainUrl must be/)
  })

  it('rejects an invalid URL even on a non-mydomain org', () => {
    const { orgs } = parse([{ ...base, kind: 'production', myDomainUrl: 'https://evil.example' }])
    expect(orgs).toHaveLength(0)
  })

  it('imports the valid items and reports the invalid ones', () => {
    const { orgs, errors } = parse([
      { ...base, kind: 'production' },
      { ...base, kind: 'mydomain', myDomainUrl: 'https://evil.example' },
      { ...base, kind: 'sandbox' },
    ])
    expect(orgs.map(o => o.kind)).toEqual(['production', 'sandbox'])
    expect(errors).toEqual(['#2: myDomainUrl must be a Salesforce https URL'])
  })
})

describe('export → import round trip', () => {
  it('re-imports what was exported', () => {
    const source = applyImport({ orgs: [] }, [
      { ...base, kind: 'mydomain', myDomainUrl: 'https://example.my.salesforce.com', group: 'G' },
      { ...base, kind: 'sandbox', notes: 'n' },
    ])
    const { orgs, errors } = parseImportJson(exportVaultAsJson(source))
    expect(errors).toEqual([])
    const restored: Vault = applyImport({ orgs: [] }, orgs)
    const strip = (v: Vault) => v.orgs.map(({ label, kind, group, myDomainUrl, username, password, notes }) =>
      ({ label, kind, group, myDomainUrl, username, password, notes }))
    expect(strip(restored)).toEqual(strip(source))
  })
})
