export type OrgKind = 'production' | 'sandbox' | 'mydomain'

export type Org = {
  id: string
  label: string
  kind: OrgKind
  group?: string
  myDomainUrl?: string
  username: string
  password: string
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
  | { ok: true; finalUrl: string }
  | { ok: false; error: string }

export type LoginPayload = {
  label: string
  username: string
  password: string
  loginBaseUrl: string
}

export type BgMessage =
  | { type: 'LOGIN'; payload: LoginPayload }
  | { type: 'LOCK' }
