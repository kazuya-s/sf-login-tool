import type { Org, OrgKind, Vault } from './types'

export type OrgInput = {
  label: string
  kind: OrgKind
  group?: string
  myDomainUrl?: string
  username: string
  password: string
  notes?: string
}

function normalizeGroup(g?: string): string {
  return g?.trim() || 'default'
}

function addGroupToOrder(order: string[], group: string): string[] {
  return order.includes(group) ? order : [...order, group]
}

export function createOrg(vault: Vault, input: OrgInput): Vault {
  const now = Date.now()
  const group = normalizeGroup(input.group)
  const org: Org = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...input,
    group,
  }
  const groupOrder = addGroupToOrder(vault.groupOrder ?? [], group)
  return { ...vault, orgs: [...vault.orgs, org], groupOrder }
}

export function updateOrg(vault: Vault, id: string, input: Partial<OrgInput>): Vault {
  const newGroup = normalizeGroup(input.group)
  const orgs = vault.orgs.map((org) =>
    org.id === id
      ? { ...org, ...input, group: newGroup, updatedAt: Date.now() }
      : org
  )
  const remainingGroups = new Set(orgs.map(o => o.group || 'default'))
  const groupOrder = addGroupToOrder(vault.groupOrder ?? [], newGroup)
    .filter(g => remainingGroups.has(g))
  return { ...vault, orgs, groupOrder }
}

export function deleteOrg(vault: Vault, id: string): Vault {
  const orgs = vault.orgs.filter((org) => org.id !== id)
  const remainingGroups = new Set(orgs.map(o => o.group || 'default'))
  const groupOrder = (vault.groupOrder ?? []).filter(g => remainingGroups.has(g))
  return { ...vault, orgs, groupOrder }
}

export function updateOrgMeta(vault: Vault, id: string, meta: { sfOrgId?: string; sfVersion?: string }): Vault {
  const orgs = vault.orgs.map(org =>
    org.id === id ? { ...org, ...meta, updatedAt: Date.now() } : org
  )
  return { ...vault, orgs }
}

export function findOrg(vault: Vault, id: string): Org | undefined {
  return vault.orgs.find((org) => org.id === id)
}

export function getGroups(vault: Vault): string[] {
  const all = Array.from(new Set(vault.orgs.map(o => o.group || 'default')))
  const order = vault.groupOrder ?? []
  const ordered = order.filter(g => all.includes(g))
  const rest = all.filter(g => !ordered.includes(g)).sort()
  return [...ordered, ...rest]
}

export function reorderOrg(vault: Vault, draggedId: string, targetId: string): Vault {
  const orgs = [...vault.orgs]
  const fromIdx = orgs.findIndex(o => o.id === draggedId)
  const toIdx = orgs.findIndex(o => o.id === targetId)
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return vault
  const targetGroup = orgs[toIdx].group || 'default'
  const [moved] = orgs.splice(fromIdx, 1)
  const newToIdx = orgs.findIndex(o => o.id === targetId)
  orgs.splice(newToIdx, 0, { ...moved, group: targetGroup, updatedAt: Date.now() })
  return { ...vault, orgs }
}

export function reorderGroup(vault: Vault, draggedGroup: string, targetGroup: string): Vault {
  const order = [...getGroups(vault)]
  const fromIdx = order.indexOf(draggedGroup)
  const toIdx = order.indexOf(targetGroup)
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return vault
  order.splice(fromIdx, 1)
  const newToIdx = order.indexOf(targetGroup)
  order.splice(newToIdx, 0, draggedGroup)
  return { ...vault, groupOrder: order }
}

export function searchOrgs(vault: Vault, query: string): Org[] {
  const q = query.trim().toLowerCase()
  if (!q) return vault.orgs
  return vault.orgs.filter(
    (org) =>
      org.label.toLowerCase().includes(q) ||
      org.username.toLowerCase().includes(q) ||
      (org.group?.toLowerCase().includes(q) ?? false)
  )
}
