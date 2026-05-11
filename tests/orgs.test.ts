import { describe, it, expect } from 'vitest'
import { createOrg, updateOrg, deleteOrg, findOrg, searchOrgs } from '../src/lib/orgs'
import type { Vault } from '../src/lib/types'

const emptyVault: Vault = { orgs: [] }

const input = {
  label: 'My Dev Org',
  kind: 'production' as const,
  username: 'user@example.com',
  password: 'secret',
}

describe('createOrg', () => {
  it('adds an org to an empty vault', () => {
    const vault = createOrg(emptyVault, input)
    expect(vault.orgs).toHaveLength(1)
    expect(vault.orgs[0].label).toBe('My Dev Org')
  })

  it('assigns a uuid id', () => {
    const vault = createOrg(emptyVault, input)
    expect(vault.orgs[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('sets createdAt and updatedAt', () => {
    const before = Date.now()
    const vault = createOrg(emptyVault, input)
    const after = Date.now()
    expect(vault.orgs[0].createdAt).toBeGreaterThanOrEqual(before)
    expect(vault.orgs[0].createdAt).toBeLessThanOrEqual(after)
    expect(vault.orgs[0].createdAt).toBe(vault.orgs[0].updatedAt)
  })

  it('does not mutate the original vault', () => {
    createOrg(emptyVault, input)
    expect(emptyVault.orgs).toHaveLength(0)
  })
})

describe('updateOrg', () => {
  it('updates the specified org', () => {
    const vault = createOrg(emptyVault, input)
    const id = vault.orgs[0].id
    const updated = updateOrg(vault, id, { label: 'Updated Label' })
    expect(updated.orgs[0].label).toBe('Updated Label')
    expect(updated.orgs[0].username).toBe(input.username)
  })

  it('updates updatedAt', () => {
    const vault = createOrg(emptyVault, input)
    const id = vault.orgs[0].id
    const createdAt = vault.orgs[0].createdAt
    const updated = updateOrg(vault, id, { label: 'New' })
    expect(updated.orgs[0].createdAt).toBe(createdAt)
    expect(updated.orgs[0].updatedAt).toBeGreaterThanOrEqual(createdAt)
  })

  it('ignores unknown id', () => {
    const vault = createOrg(emptyVault, input)
    const updated = updateOrg(vault, 'nonexistent', { label: 'X' })
    expect(updated.orgs[0].label).toBe(input.label)
  })
})

describe('deleteOrg', () => {
  it('removes the specified org', () => {
    const vault = createOrg(emptyVault, input)
    const id = vault.orgs[0].id
    const deleted = deleteOrg(vault, id)
    expect(deleted.orgs).toHaveLength(0)
  })

  it('ignores unknown id', () => {
    const vault = createOrg(emptyVault, input)
    const deleted = deleteOrg(vault, 'nonexistent')
    expect(deleted.orgs).toHaveLength(1)
  })
})

describe('findOrg', () => {
  it('finds an existing org by id', () => {
    const vault = createOrg(emptyVault, input)
    const id = vault.orgs[0].id
    expect(findOrg(vault, id)?.label).toBe(input.label)
  })

  it('returns undefined for unknown id', () => {
    expect(findOrg(emptyVault, 'nonexistent')).toBeUndefined()
  })
})

describe('searchOrgs', () => {
  const vault = [
    { label: 'Production Org', kind: 'production' as const },
    { label: 'Sandbox Dev', kind: 'sandbox' as const },
    { label: 'Customer Demo', kind: 'production' as const },
  ].reduce(
    (v, o) => createOrg(v, { ...o, username: 'u', password: 'p' }),
    emptyVault
  )

  it('returns all orgs for empty query', () => {
    expect(searchOrgs(vault, '')).toHaveLength(3)
  })

  it('filters case-insensitively by label', () => {
    expect(searchOrgs(vault, 'sandbox')).toHaveLength(1)
    expect(searchOrgs(vault, 'SANDBOX')).toHaveLength(1)
  })

  it('matches partial label', () => {
    expect(searchOrgs(vault, 'org')).toHaveLength(1)
  })

  it('returns empty array for no match', () => {
    expect(searchOrgs(vault, 'zzz')).toHaveLength(0)
  })

  it('trims whitespace from query', () => {
    expect(searchOrgs(vault, '  sandbox  ')).toHaveLength(1)
  })
})
