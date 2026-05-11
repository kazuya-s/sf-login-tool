import { describe, it, expect, vi, beforeEach } from 'vitest'
import { performLogin } from '../src/lib/login'
import type { LoginPayload } from '../src/lib/types'

const basePayload: LoginPayload = {
  label: 'Test Org',
  username: 'user@example.com',
  password: 'mypassword',
  loginBaseUrl: 'https://login.salesforce.com',
}

const LOGIN_HTML = `
<html><body>
  <form id="theLoginPage" action="/login?ec=302">
    <input type="hidden" name="lt" value="csrf-token" />
    <input type="hidden" name="useSecure" value="1" />
    <input type="text" name="un" />
    <input type="password" name="pw" />
  </form>
</body></html>
`

function makeFetchMock(finalUrl: string) {
  return vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      text: async () => LOGIN_HTML,
    })
    .mockResolvedValueOnce({
      ok: true,
      url: finalUrl,
    })
}

describe('performLogin', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns ok:true with finalUrl on successful login', async () => {
    vi.stubGlobal('fetch', makeFetchMock('https://myorg.lightning.force.com/lightning/page/home'))
    const result = await performLogin(basePayload)
    expect(result).toEqual({ ok: true, finalUrl: 'https://myorg.lightning.force.com/lightning/page/home' })
  })

  it('POSTs un and pw to the form action URL', async () => {
    const mockFetch = makeFetchMock('https://myorg.lightning.force.com/')
    vi.stubGlobal('fetch', mockFetch)
    await performLogin(basePayload)

    const [postUrl, postInit] = mockFetch.mock.calls[1] as [string, RequestInit]
    expect(postUrl).toContain('/login?ec=302')
    expect(postInit.method).toBe('POST')
    const body = new URLSearchParams(postInit.body as string)
    expect(body.get('un')).toBe('user@example.com')
    expect(body.get('pw')).toBe('mypassword')
    expect(body.get('lt')).toBe('csrf-token')
  })

  it('includes hidden fields from the form in the POST body', async () => {
    const mockFetch = makeFetchMock('https://myorg.lightning.force.com/')
    vi.stubGlobal('fetch', mockFetch)
    await performLogin(basePayload)

    const [, postInit] = mockFetch.mock.calls[1] as [string, RequestInit]
    const body = new URLSearchParams(postInit.body as string)
    expect(body.get('useSecure')).toBe('1')
  })

  it('returns ok:false when final URL is still the login page', async () => {
    vi.stubGlobal('fetch', makeFetchMock('https://login.salesforce.com/?ec=302&error=1'))
    const result = await performLogin(basePayload)
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toMatch(/失敗/)
  })

  it('returns ok:false when final URL is test.salesforce.com (sandbox failure)', async () => {
    vi.stubGlobal('fetch', makeFetchMock('https://test.salesforce.com/?ec=302&error=1'))
    const result = await performLogin({ ...basePayload, loginBaseUrl: 'https://test.salesforce.com' })
    expect(result.ok).toBe(false)
  })

  it('returns ok:false when GET request throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')))
    const result = await performLogin(basePayload)
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toMatch(/接続/)
  })

  it('returns ok:false when GET returns non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }))
    const result = await performLogin(basePayload)
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toContain('503')
  })

  it('returns ok:false when login form is not found in the HTML', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => '<html><body><p>no form</p></body></html>' })
    )
    const result = await performLogin(basePayload)
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toMatch(/フォーム/)
  })

  it('handles trailing slash and no trailing slash in loginBaseUrl', async () => {
    const mockFetch = makeFetchMock('https://myorg.lightning.force.com/')
    vi.stubGlobal('fetch', mockFetch)
    await performLogin({ ...basePayload, loginBaseUrl: 'https://login.salesforce.com/' })
    const [getUrl] = mockFetch.mock.calls[0] as [string]
    expect(getUrl).toBe('https://login.salesforce.com/')
  })

  it('resolves relative form action to absolute URL', async () => {
    const mockFetch = makeFetchMock('https://myorg.lightning.force.com/')
    vi.stubGlobal('fetch', mockFetch)
    await performLogin(basePayload)
    const [postUrl] = mockFetch.mock.calls[1] as [string]
    expect(postUrl.startsWith('https://')).toBe(true)
  })
})
