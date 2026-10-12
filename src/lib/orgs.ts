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

// Salesforce switched the login page to username-first (Release 262). The
// type=twobox param keeps the two-box (username + password) UI this tool autofills.
// https://help.salesforce.com/s/articleView?id=release-notes.rn_security_login_changes.htm&release=262&type=5
export function getLoginBaseUrl(org: Org): string {
  if (org.kind === 'mydomain' && org.myDomainUrl) return org.myDomainUrl
  if (org.kind === 'sandbox') return 'https://test.salesforce.com/?type=twobox'
  return 'https://login.salesforce.com/?type=twobox'
}

function addGroupToOrder(order: string[], group: string): string[] {
  return order.includes(group) ? order : [...order, group]
}

// Drop collapsed-state entries for groups that no longer have any org.
function pruneCollapsed(vault: Vault, orgs: Org[]): string[] | undefined {
  if (!vault.collapsedGroups) return undefined
  const remainingGroups = new Set(orgs.map(o => o.group || 'default'))
  return vault.collapsedGroups.filter(g => remainingGroups.has(g))
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
  return { ...vault, orgs, groupOrder, collapsedGroups: pruneCollapsed(vault, orgs) }
}

export function deleteOrg(vault: Vault, id: string): Vault {
  const orgs = vault.orgs.filter((org) => org.id !== id)
  const remainingGroups = new Set(orgs.map(o => o.group || 'default'))
  const groupOrder = (vault.groupOrder ?? []).filter(g => remainingGroups.has(g))
  return { ...vault, orgs, groupOrder, collapsedGroups: pruneCollapsed(vault, orgs) }
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

// Orgs in the order the popup shows them: grouped by getGroups(), stored order within each group.
export function sortOrgsByGroup(vault: Vault): Org[] {
  const groups = getGroups(vault)
  const rank = (o: Org) => groups.indexOf(o.group || 'default')
  return [...vault.orgs].sort((a, b) => rank(a) - rank(b))
}

// Where a dragged item lands relative to the drop target: after it when dragging down, before it when dragging up.
export function getDropPosition<T>(order: T[], dragged: T, target: T): 'before' | 'after' {
  return order.indexOf(dragged) < order.indexOf(target) ? 'after' : 'before'
}

export function reorderOrg(vault: Vault, draggedId: string, targetId: string): Vault {
  // Work in display order: the stored order can differ from it after groups are reordered,
  // which would otherwise flip the drag direction across groups.
  const orgs = sortOrgsByGroup(vault)
  const fromIdx = orgs.findIndex(o => o.id === draggedId)
  const toIdx = orgs.findIndex(o => o.id === targetId)
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return vault
  const targetGroup = orgs[toIdx].group || 'default'
  // Inserting at the target's original index places the item after the target
  // when dragging down and before it when dragging up, so the last slot is reachable.
  const [moved] = orgs.splice(fromIdx, 1)
  orgs.splice(toIdx, 0, { ...moved, group: targetGroup, updatedAt: Date.now() })
  return { ...vault, orgs, collapsedGroups: pruneCollapsed(vault, orgs) }
}

export function reorderGroup(vault: Vault, draggedGroup: string, targetGroup: string): Vault {
  const order = [...getGroups(vault)]
  const fromIdx = order.indexOf(draggedGroup)
  const toIdx = order.indexOf(targetGroup)
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return vault
  // Same insertion rule as reorderOrg: after the target when dragging down, before it when dragging up.
  order.splice(fromIdx, 1)
  order.splice(toIdx, 0, draggedGroup)
  return { ...vault, groupOrder: order }
}

export function toggleGroupCollapsed(vault: Vault, group: string): Vault {
  const current = vault.collapsedGroups ?? []
  const collapsedGroups = current.includes(group)
    ? current.filter(g => g !== group)
    : [...current, group]
  return { ...vault, collapsedGroups }
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
