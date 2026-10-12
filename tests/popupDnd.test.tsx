import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createOrg, getGroups } from '../src/lib/orgs'
import type { Vault } from '../src/lib/types'

// Keep the vault in memory so the popup can be driven without encryption or chrome.storage.
let current: Vault
vi.mock('../src/lib/useVault', () => ({
  VaultProvider: ({ children }: { children: ReactNode }) => children,
  useVault: () => {
    const [vault, setVault] = useState(current)
    return {
      status: 'unlocked', vault, error: null, isMasterPasswordEnabled: false,
      initialize: vi.fn(), unlock: vi.fn(), lock: vi.fn(),
      applyChange: async (fn: (v: Vault) => Vault) => { current = fn(vault); setVault(current) },
    }
  },
}))

const { App } = await import('../src/popup/App')

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => ({}), set: async () => {} } },
    runtime: { getManifest: () => ({ version: 'test' }), sendMessage: async () => ({}) },
  })
  current = ['A', 'B', 'C'].reduce(
    (v, g) => createOrg(v, { label: `${g.toLowerCase()}1`, group: g, kind: 'production', username: 'u', password: 'p' }),
    { orgs: [] } as Vault
  )
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<App />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const header = (group: string) =>
  Array.from(container.querySelectorAll('li[draggable]')).find(li => !li.classList.contains('sf-org-row') && li.textContent?.startsWith(`⠿${group}`))!
const orgRow = (label: string) =>
  Array.from(container.querySelectorAll('li.sf-org-row')).find(li => li.textContent?.includes(label))!

async function fire(el: Element, type: string) {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  await act(async () => { el.dispatchEvent(ev) })
  return ev
}

// Simulates the browser: drop only fires when dragover was cancelled.
async function drag(from: Element, to: Element) {
  await fire(from, 'dragstart')
  const over = await fire(to, 'dragover')
  if (over.defaultPrevented) await fire(to, 'drop')
  await fire(from, 'dragend')
  return over.defaultPrevented
}

describe('popup group drag and drop', () => {
  it('renders groups in A, B, C order', () => {
    expect(getGroups(current)).toEqual(['A', 'B', 'C'])
    expect(header('C')).toBeTruthy()
  })

  it('moves the first group to the end when dropped on the last header', async () => {
    expect(await drag(header('A'), header('C'))).toBe(true)
    expect(getGroups(current)).toEqual(['B', 'C', 'A'])
  })

  it('moves a group to the end when dropped on an org row of the last group', async () => {
    expect(await drag(header('B'), orgRow('c1'))).toBe(true)
    expect(getGroups(current)).toEqual(['A', 'C', 'B'])
  })

  it('moves a group to the end when dropped on the empty space below the list', async () => {
    expect(await drag(header('A'), container.querySelector('ul')!)).toBe(true)
    expect(getGroups(current)).toEqual(['B', 'C', 'A'])
  })

  it('ignores a drop on the empty space when the last group is dragged', async () => {
    expect(await drag(header('C'), container.querySelector('ul')!)).toBe(false)
    expect(getGroups(current)).toEqual(['A', 'B', 'C'])
  })

  it('moves the last group to the front', async () => {
    expect(await drag(header('C'), header('A'))).toBe(true)
    expect(getGroups(current)).toEqual(['C', 'A', 'B'])
  })
})
