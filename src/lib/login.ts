import type { LoginPayload } from './types'

export type LoginOutcome =
  | { ok: true; finalUrl: string }
  | { ok: false; error: string }

const LOGIN_DOMAINS = ['login.salesforce.com', 'test.salesforce.com']

function isLoginPage(url: string): boolean {
  try {
    return LOGIN_DOMAINS.some((d) => new URL(url).hostname.endsWith(d))
  } catch {
    return true
  }
}

function buildActionUrl(baseUrl: string, action: string): string {
  if (action.startsWith('http')) return action
  return new URL(action, baseUrl).href
}

function extractFormData(doc: Document): { action: string; fields: URLSearchParams } | null {
  const form =
    doc.querySelector<HTMLFormElement>('form#theLoginPage') ??
    doc.querySelector<HTMLFormElement>('form[name="login"]') ??
    doc.querySelector<HTMLFormElement>('form')
  if (!form) return null

  const action = form.getAttribute('action')
  if (!action) return null

  const fields = new URLSearchParams()
  for (const el of form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')) {
    if (el.name) fields.set(el.name, el.value)
  }
  return { action, fields }
}

export async function performLogin(payload: LoginPayload): Promise<LoginOutcome> {
  const baseUrl = payload.loginBaseUrl.endsWith('/')
    ? payload.loginBaseUrl
    : payload.loginBaseUrl + '/'

  // Step 1: GET login page to obtain CSRF/hidden fields and session cookies
  let pageRes: Response
  try {
    pageRes = await fetch(baseUrl, { credentials: 'include' })
  } catch {
    return { ok: false, error: 'ログインページへの接続に失敗しました' }
  }
  if (!pageRes.ok) {
    return { ok: false, error: `ログインページの取得に失敗しました (HTTP ${pageRes.status})` }
  }

  const html = await pageRes.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const extracted = extractFormData(doc)
  if (!extracted) {
    return { ok: false, error: 'ログインフォームが見つかりませんでした' }
  }

  const { action, fields } = extracted
  const actionUrl = buildActionUrl(baseUrl, action)

  // Step 2: POST credentials
  fields.set('un', payload.username)
  fields.set('pw', payload.password)

  let loginRes: Response
  try {
    loginRes = await fetch(actionUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fields.toString(),
    })
  } catch {
    return { ok: false, error: 'ログインリクエストに失敗しました' }
  }

  // Step 3: Verify success by checking the final URL after redirects
  const finalUrl = loginRes.url || actionUrl
  if (isLoginPage(finalUrl)) {
    return { ok: false, error: 'ログインに失敗しました。ユーザー名またはパスワードを確認してください。' }
  }

  return { ok: true, finalUrl }
}
