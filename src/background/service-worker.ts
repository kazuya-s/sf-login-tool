import type { BgMessage, LoginPayload, LoginResult } from '../lib/types'
import { openVault, persistVault } from '../lib/vault'
import { loadSessionPassword } from '../lib/storage'
import { updateOrgMeta } from '../lib/orgs'

chrome.runtime.onInstalled.addListener(() => {
  console.log('SF Login Tool installed')
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
    await saveOrgInfo(tabId, monitor.orgId)
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

async function saveOrgInfo(tabId: number, orgId: string): Promise<void> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        try {
          const versions = await fetch('/services/data/').then(r => r.json()) as { version: string }[]
          const latest = versions[versions.length - 1]
          const version = latest?.version
          if (!version) return null
          const orgQuery = await fetch(`/services/data/v${version}/query?q=SELECT+Id+FROM+Organization+LIMIT+1`).then(r => r.json()) as { records?: { Id: string }[] }
          const sfOrgId = orgQuery?.records?.[0]?.Id
          return { version, sfOrgId }
        } catch {
          return null
        }
      },
    })

    const info = result?.result as { version?: string; sfOrgId?: string } | null
    if (!info) return

    const password = await loadSessionPassword()
    if (!password) return

    const vault = await openVault(password)
    const updated = updateOrgMeta(vault, orgId, {
      sfOrgId: info.sfOrgId,
      sfVersion: info.version,
    })
    await persistVault(password, updated)
    chrome.runtime.sendMessage({ type: 'VAULT_UPDATED' } as BgMessage).catch(() => {})
  } catch {
    // Org info save failed; not critical
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
