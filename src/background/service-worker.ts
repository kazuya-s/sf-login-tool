import { performLogin } from '../lib/login'
import type { BgMessage, LoginResult } from '../lib/types'

chrome.runtime.onInstalled.addListener(() => {
  console.log('SF Login Tool installed')
})

chrome.runtime.onMessage.addListener(
  (message: BgMessage, _sender, sendResponse: (result: LoginResult) => void) => {
    if (message.type === 'LOGIN') {
      handleLogin(message.payload).then(sendResponse).catch((err: unknown) => {
        sendResponse({ ok: false, error: String(err) })
      })
      return true // async response
    }
  }
)

async function handleLogin(
  payload: Parameters<typeof performLogin>[0]
): Promise<LoginResult> {
  const outcome = await performLogin(payload)
  if (!outcome.ok) return { ok: false, error: outcome.error }
  return { ok: true, finalUrl: outcome.finalUrl }
}
