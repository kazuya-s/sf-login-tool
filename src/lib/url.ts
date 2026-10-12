// Salesforce login pages (login / test / My Domain, incl. *.sandbox.my.salesforce.com)
// all live under salesforce.com. Pages on other hosts covered by host_permissions
// (e.g. *.force.com) can serve org-authored content, so credentials are never sent there.
const SALESFORCE_LOGIN_DOMAIN = '.salesforce.com'

function parseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function isSalesforceLoginHost(hostname: string): boolean {
  return hostname.endsWith(SALESFORCE_LOGIN_DOMAIN)
}

// A My Domain URL must be a plain https origin on a Salesforce login host
// (no embedded credentials or custom port).
export function isValidMyDomainUrl(url: string): boolean {
  const u = parseUrl(url.trim())
  if (!u) return false
  return u.protocol === 'https:'
    && isSalesforceLoginHost(u.hostname)
    && !u.username && !u.password
    && !u.port
}

// Whether login credentials may be autofilled into the page currently loaded in a tab.
export function canAutofillCredentials(tabUrl: string): boolean {
  const u = parseUrl(tabUrl)
  if (!u) return false
  return u.protocol === 'https:' && isSalesforceLoginHost(u.hostname)
}
