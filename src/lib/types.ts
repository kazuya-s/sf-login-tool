export type OrgKind = 'production' | 'sandbox' | 'mydomain'

export type Org = {
  id: string
  label: string
  kind: OrgKind
  myDomainUrl?: string
  username: string
  password: string
  createdAt: number
  updatedAt: number
}

export type Vault = {
  orgs: Org[]
}

export type Settings = {
  autoLockMinutes: number
}

export type LoginResult =
  | { ok: true; tabId: number }
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
