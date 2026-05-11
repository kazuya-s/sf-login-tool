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

// DOMParser is unavailable in MV3 service workers — parse with regex instead
function extractFormData(html: string): { action: string; fields: URLSearchParams } | null {
  const formTagMatch =
    /<form\b[^>]*\bid=["']theLoginPage["'][^>]*>/i.exec(html) ??
    /<form\b[^>]*\bname=["']login["'][^>]*>/i.exec(html) ??
    /<form\b[^>]*>/i.exec(html)

  if (!formTagMatch) return null

  const actionMatch = /\baction=["']([^"']+)["']/i.exec(formTagMatch[0])
  if (!actionMatch) return null

  const fields = new URLSearchParams()
  const inputRe = /<input\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = inputRe.exec(html)) !== null) {
    const tag = m[0]
    if (!/type=["']hidden["']/i.test(tag)) continue
    const nameMatch = /\bname=["']([^"']+)["']/i.exec(tag)
    const valueMatch = /\bvalue=["']([^"']*?)["']/i.exec(tag)
    if (nameMatch) fields.set(nameMatch[1], valueMatch ? valueMatch[1] : '')
  }

  return { action: actionMatch[1], fields }
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
  const extracted = extractFormData(html)
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
