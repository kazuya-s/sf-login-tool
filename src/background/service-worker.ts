import type { BgMessage, LoginPayload, LoginResult } from '../lib/types'
import { openVault, persistVault } from '../lib/vault'
import { loadSessionPassword } from '../lib/storage'
import { updateOrgMeta } from '../lib/orgs'

chrome.runtime.onInstalled.addListener(() => {
  console.log('KS SF Login installed')
})

interface TabMonitor {
  orgId: string
  loginBaseUrl: string
  username: string
  password: string
  phase: 'autofill_pending' | 'monitoring'
}

const monitoredTabs = new Map<number, TabMonitor>()

chrome.tabs.onRemoved.addListener((tabId) => {
  monitoredTabs.delete(tabId)
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const monitor = monitoredTabs.get(tabId)
  if (!monitor || changeInfo.status !== 'complete') return

  const url = tab.url ?? ''

  if (monitor.phase === 'autofill_pending') {
    monitor.phase = 'monitoring'
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (username: string, password: string) => {
          const u = document.querySelector<HTMLInputElement>('#username')
          const p = document.querySelector<HTMLInputElement>('#password')
          const btn = document.querySelector<HTMLElement>('#Login')
          if (u) u.value = username
          if (p) p.value = password
          if (btn) btn.click()
        },
        args: [monitor.username, monitor.password],
      })
    } catch {
      monitoredTabs.delete(tabId)
    }
    return
  }

  if (monitor.phase === 'monitoring' && isPostLoginUrl(url, monitor.loginBaseUrl)) {
    monitoredTabs.delete(tabId)
    await saveOrgInfo(tabId, monitor.orgId, url)
  }
})

function isPostLoginUrl(url: string, loginBaseUrl: string): boolean {
  if (!url.startsWith('https://')) return false
  const sfDomain = url.includes('.salesforce.com') || url.includes('.force.com')
  if (!sfDomain) return false
  try {
    const loginHost = new URL(loginBaseUrl).host
    const urlHost = new URL(url).host
    if (urlHost !== loginHost) return true
    const urlPath = new URL(url).pathname
    return !urlPath.includes('login') && !urlPath.includes('secur')
  } catch {
    return false
  }
}

async function saveOrgInfo(tabId: number, orgId: string, tabUrl: string): Promise<void> {
  try {
    // Get API version via page fetch (injected script, same-origin)
    const [versionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        try {
          const r = await fetch('/services/data/')
          if (!r.ok) return null
          const versions = await r.json() as { version: string }[]
          return versions[versions.length - 1]?.version ?? null
        } catch { return null }
      },
    })
    const sfVersion = (versionResult?.result as string | null | undefined) ?? undefined

    // Get Org ID from the Salesforce sid cookie.
    // sid format: "{orgId}!{sessionKey}" — service worker can read HttpOnly cookies.
    let sfOrgId: string | undefined
    try {
      let sidCookies = await chrome.cookies.getAll({ url: tabUrl, name: 'sid' })
      if (!sidCookies.length) {
        // Broaden search across all accessible SF domains
        const all = await chrome.cookies.getAll({ name: 'sid' })
        sidCookies = all.filter(c =>
          c.domain.includes('salesforce.com') || c.domain.includes('force.com')
        )
      }
      for (const c of sidCookies) {
        const parts = c.value.split('!')
        if (parts.length >= 2 && parts[0].startsWith('00D')) {
          sfOrgId = parts[0]
          break
        }
      }
    } catch { /* ignore */ }

    if (!sfVersion && !sfOrgId) return

    const password = await loadSessionPassword()
    if (!password) return

    const vault = await openVault(password)
    const updated = updateOrgMeta(vault, orgId, { sfOrgId, sfVersion })
    await persistVault(password, updated)
    chrome.runtime.sendMessage({ type: 'VAULT_UPDATED' } as BgMessage).catch(() => {})
  } catch {
    // Not critical
  }
}

chrome.runtime.onMessage.addListener(
  (message: BgMessage, _sender, sendResponse: (result: LoginResult) => void) => {
    if (message.type === 'LOGIN') {
      handleLogin(message.payload).then(sendResponse).catch((err: unknown) => {
        sendResponse({ ok: false, error: String(err) })
      })
      return true
    }
  }
)

async function handleLogin(payload: LoginPayload): Promise<LoginResult> {
  const { orgId, username, password, loginBaseUrl, target } = payload
  try {
    let tabId: number
    if (target === 'incognito') {
      const win = await chrome.windows.create({ url: loginBaseUrl, incognito: true })
      tabId = win.tabs![0].id!
    } else if (target === 'window') {
      const win = await chrome.windows.create({ url: loginBaseUrl })
      tabId = win.tabs![0].id!
    } else {
      const tab = await chrome.tabs.create({ url: loginBaseUrl })
      tabId = tab.id!
    }
    monitoredTabs.set(tabId, { orgId, loginBaseUrl, username, password, phase: 'autofill_pending' })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
