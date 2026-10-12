import { describe, it, expect } from 'vitest'
import { createOrg, updateOrg, deleteOrg, findOrg, searchOrgs, getLoginBaseUrl, reorderOrg, reorderGroup, getGroups, toggleGroupCollapsed } from '../src/lib/orgs'
import type { Org, Vault } from '../src/lib/types'

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

describe('getLoginBaseUrl', () => {
  const buildOrg = (overrides: Partial<Org>): Org => ({
    ...createOrg(emptyVault, input).orgs[0],
    ...overrides,
  })

  it('adds type=twobox to the production login URL', () => {
    const org = buildOrg({ kind: 'production' })
    expect(getLoginBaseUrl(org)).toBe('https://login.salesforce.com/?type=twobox')
  })

  it('adds type=twobox to the developer login URL', () => {
    const org = buildOrg({ kind: 'developer' })
    expect(getLoginBaseUrl(org)).toBe('https://login.salesforce.com/?type=twobox')
  })

  it('adds type=twobox to the sandbox login URL', () => {
    const org = buildOrg({ kind: 'sandbox' })
    expect(getLoginBaseUrl(org)).toBe('https://test.salesforce.com/?type=twobox')
  })

  it('uses the custom domain as-is for mydomain orgs', () => {
    const org = buildOrg({ kind: 'mydomain', myDomainUrl: 'https://example.my.salesforce.com' })
    expect(getLoginBaseUrl(org)).toBe('https://example.my.salesforce.com')
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

describe('toggleGroupCollapsed', () => {
  const base = [
    { label: 'A', group: 'g1' },
    { label: 'B', group: 'g2' },
  ].reduce(
    (v, o) => createOrg(v, { ...o, kind: 'production', username: 'u', password: 'p' }),
    emptyVault
  )

  it('collapses an expanded group', () => {
    expect(toggleGroupCollapsed(base, 'g1').collapsedGroups).toEqual(['g1'])
  })

  it('expands a collapsed group', () => {
    const v = toggleGroupCollapsed(toggleGroupCollapsed(base, 'g1'), 'g1')
    expect(v.collapsedGroups).toEqual([])
  })

  it('keeps other groups collapsed when toggling one', () => {
    const v = toggleGroupCollapsed(toggleGroupCollapsed(base, 'g1'), 'g2')
    expect(v.collapsedGroups).toEqual(['g1', 'g2'])
  })

  it('does not mutate the original vault', () => {
    toggleGroupCollapsed(base, 'g1')
    expect(base.collapsedGroups).toBeUndefined()
  })
})

describe('collapsed group cleanup', () => {
  const base = toggleGroupCollapsed(
    [
      { label: 'A', group: 'g1' },
      { label: 'B', group: 'g2' },
    ].reduce(
      (v, o) => createOrg(v, { ...o, kind: 'production', username: 'u', password: 'p' }),
      emptyVault
    ),
    'g1'
  )
  const [a, b] = base.orgs

  it('removes a collapsed group when its last org is deleted', () => {
    expect(deleteOrg(base, a.id).collapsedGroups).toEqual([])
  })

  it('removes a collapsed group when its last org moves to another group', () => {
    expect(updateOrg(base, a.id, { group: 'g2' }).collapsedGroups).toEqual([])
  })

  it('removes a collapsed group when its last org is dragged into another group', () => {
    expect(reorderOrg(base, a.id, b.id).collapsedGroups).toEqual([])
  })

  it('keeps a collapsed group that still has orgs', () => {
    expect(deleteOrg(base, b.id).collapsedGroups).toEqual(['g1'])
  })

  it('leaves collapsedGroups undefined for vaults that never had it', () => {
    const plain = createOrg(emptyVault, input)
    expect(deleteOrg(plain, plain.orgs[0].id).collapsedGroups).toBeUndefined()
  })
})

describe('reorderGroup', () => {
  // One org per group so the groups appear in the order A, B, C, D.
  const base = ['A', 'B', 'C', 'D'].reduce(
    (v, g) => createOrg(v, { label: `${g}1`, group: g, kind: 'production', username: 'u', password: 'p' }),
    emptyVault
  )

  it.each([
    // dragging down: lands after the target
    ['A', 'D', ['B', 'C', 'D', 'A']],
    ['C', 'D', ['A', 'B', 'D', 'C']],
    ['A', 'B', ['B', 'A', 'C', 'D']],
    ['B', 'C', ['A', 'C', 'B', 'D']],
    // dragging up: lands before the target
    ['D', 'A', ['D', 'A', 'B', 'C']],
    ['D', 'C', ['A', 'B', 'D', 'C']],
    ['C', 'B', ['A', 'C', 'B', 'D']],
  ])('moves %s onto %s', (from, to, expected) => {
    expect(getGroups(reorderGroup(base, from, to))).toEqual(expected)
  })

  it('returns the vault unchanged when dropped on itself', () => {
    expect(reorderGroup(base, 'B', 'B')).toBe(base)
  })

  it('returns the vault unchanged for an unknown group', () => {
    expect(reorderGroup(base, 'Z', 'A')).toBe(base)
  })
})

describe('reorderOrg', () => {
  const base = ['x', 'y', 'z'].reduce(
    (v, label) => createOrg(v, { label, group: 'G', kind: 'production', username: 'u', password: 'p' }),
    emptyVault
  )
  const id = (label: string) => base.orgs.find(o => o.label === label)!.id
  const labels = (v: Vault) => v.orgs.map(o => o.label)

  it.each([
    ['x', 'z', ['y', 'z', 'x']],
    ['x', 'y', ['y', 'x', 'z']],
    ['y', 'z', ['x', 'z', 'y']],
    ['z', 'x', ['z', 'x', 'y']],
    ['z', 'y', ['x', 'z', 'y']],
  ])('moves %s onto %s', (from, to, expected) => {
    expect(labels(reorderOrg(base, id(from), id(to)))).toEqual(expected)
  })

  it('moves an org into the target group when dropped on another group', () => {
    const v = createOrg(base, { label: 'w', group: 'H', kind: 'production', username: 'u', password: 'p' })
    const moved = reorderOrg(v, v.orgs[3].id, id('x'))
    expect(labels(moved)).toEqual(['w', 'x', 'y', 'z'])
    expect(moved.orgs[0].group).toBe('G')
  })
})
