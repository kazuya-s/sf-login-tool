export type OrgKind = 'production' | 'sandbox' | 'mydomain' | 'developer'

export type Org = {
  id: string
  label: string
  kind: OrgKind
  group?: string
  myDomainUrl?: string
  username: string
  password: string
  notes?: string
  sfOrgId?: string
  sfVersion?: string
  createdAt: number
  updatedAt: number
}

export type Vault = {
  orgs: Org[]
  groupOrder?: string[]
}

export type Settings = {
  autoLockMinutes: number
}

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string }

export type LoginTarget = 'tab' | 'incognito' | 'window'

export type LoginPayload = {
  orgId: string
  username: string
  password: string
  loginBaseUrl: string
  target: LoginTarget
}

export type BgMessage =
  | { type: 'LOGIN'; payload: LoginPayload }
  | { type: 'VAULT_UPDATED' }
