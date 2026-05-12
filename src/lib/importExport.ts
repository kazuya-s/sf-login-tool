import { createOrg } from './orgs'
import type { OrgInput } from './orgs'
import type { OrgKind, Vault } from './types'

const EXPORT_VERSION = 1

interface ExportOrg {
  label: string
  kind: OrgKind
  group?: string
  myDomainUrl?: string
  username: string
  password: string
  notes?: string
}

interface ExportData {
  version: number
  exportedAt: string
  orgs: ExportOrg[]
}

export function exportVaultAsJson(vault: Vault): string {
  const data: ExportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    orgs: vault.orgs.map(org => ({
      label: org.label,
      kind: org.kind,
      ...(org.group ? { group: org.group } : {}),
      ...(org.myDomainUrl ? { myDomainUrl: org.myDomainUrl } : {}),
      username: org.username,
      password: org.password,
      ...(org.notes ? { notes: org.notes } : {}),
    })),
  }
  return JSON.stringify(data, null, 2)
}

export function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export type ImportResult = { added: number; skipped: number; errors: string[] }

export function parseImportJson(json: string): { orgs: ExportOrg[]; errors: string[] } {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('invalid_json')
  }

  if (!data || typeof data !== 'object') throw new Error('invalid_format')

  // Support both {version, orgs:[]} wrapper and bare [] array
  const raw = data as Record<string, unknown>
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(raw.orgs)
      ? (raw.orgs as unknown[])
      : (() => { throw new Error('invalid_format') })()

  const orgs: ExportOrg[] = []
  const errors: string[] = []
  const VALID_KINDS: OrgKind[] = ['production', 'sandbox', 'mydomain']

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown>
    const num = i + 1
    if (!item.label || typeof item.label !== 'string') { errors.push(`#${num}: label required`); continue }
    if (!item.username || typeof item.username !== 'string') { errors.push(`#${num}: username required`); continue }
    if (!item.password || typeof item.password !== 'string') { errors.push(`#${num}: password required`); continue }
    if (!item.kind || !VALID_KINDS.includes(item.kind as OrgKind)) { errors.push(`#${num}: kind must be production/sandbox/mydomain`); continue }
    orgs.push({
      label: item.label as string,
      kind: item.kind as OrgKind,
      group: typeof item.group === 'string' ? item.group : undefined,
      myDomainUrl: typeof item.myDomainUrl === 'string' ? item.myDomainUrl : undefined,
      username: item.username as string,
      password: item.password as string,
      notes: typeof item.notes === 'string' ? item.notes : undefined,
    })
  }
  return { orgs, errors }
}

export function applyImport(vault: Vault, orgs: ExportOrg[]): Vault {
  let result = vault
  for (const org of orgs) {
    const input: OrgInput = {
      label: org.label,
      kind: org.kind,
      group: org.group,
      myDomainUrl: org.myDomainUrl,
      username: org.username,
      password: org.password,
      notes: org.notes,
    }
    result = createOrg(result, input)
  }
  return result
}
