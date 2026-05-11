import type { Org, OrgKind, Vault } from './types'

export type OrgInput = {
  label: string
  kind: OrgKind
  group?: string
  myDomainUrl?: string
  username: string
  password: string
}

export function createOrg(vault: Vault, input: OrgInput): Vault {
  const now = Date.now()
  const org: Org = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...input,
    group: input.group || undefined,
  }
  return { ...vault, orgs: [...vault.orgs, org] }
}

export function updateOrg(vault: Vault, id: string, input: Partial<OrgInput>): Vault {
  return {
    ...vault,
    orgs: vault.orgs.map((org) =>
      org.id === id
        ? { ...org, ...input, group: input.group || undefined, updatedAt: Date.now() }
        : org
    ),
  }
}

export function deleteOrg(vault: Vault, id: string): Vault {
  return { ...vault, orgs: vault.orgs.filter((org) => org.id !== id) }
}

export function findOrg(vault: Vault, id: string): Org | undefined {
  return vault.orgs.find((org) => org.id === id)
}

export function getGroups(vault: Vault): string[] {
  return Array.from(new Set(vault.orgs.map((o) => o.group).filter(Boolean) as string[])).sort()
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
