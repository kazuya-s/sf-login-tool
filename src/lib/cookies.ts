// The cookie store a tab belongs to: the regular profile, or the incognito session for incognito tabs.
// Reading cookies without a storeId always uses the regular profile, even for an incognito tab.
export function findCookieStoreId(stores: { id: string; tabIds: number[] }[], tabId: number): string | undefined {
  return stores.find(s => s.tabIds.includes(tabId))?.id
}
