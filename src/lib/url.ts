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

// Hosts that serve a logged-in Salesforce org (Classic / API on salesforce.com, Lightning on force.com).
const SALESFORCE_ORG_DOMAINS = ['salesforce.com', 'force.com']

export function isSalesforceHost(hostname: string): boolean {
  return SALESFORCE_ORG_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))
}

// Whether a tab that started at loginBaseUrl has finished logging in and landed on the org.
export function isPostLoginUrl(url: string, loginBaseUrl: string): boolean {
  const u = parseUrl(url)
  const login = parseUrl(loginBaseUrl)
  if (!u || !login) return false
  if (u.protocol !== 'https:' || !isSalesforceHost(u.hostname)) return false
  if (u.hostname !== login.hostname) return true
  return !u.pathname.includes('login') && !u.pathname.includes('secur')
}

// Lightning UI (*.lightning.force.com) and My Domain (*.my.salesforce.com) are two hosts of the same org.
const LIGHTNING_SUFFIX = '.lightning.force.com'
const MY_DOMAIN_SUFFIX = '.my.salesforce.com'

function counterpartHost(hostname: string): string | null {
  if (hostname.endsWith(LIGHTNING_SUFFIX)) return hostname.slice(0, -LIGHTNING_SUFFIX.length) + MY_DOMAIN_SUFFIX
  if (hostname.endsWith(MY_DOMAIN_SUFFIX)) return hostname.slice(0, -MY_DOMAIN_SUFFIX.length) + LIGHTNING_SUFFIX
  return null
}

// Origin of the REST API for the org shown in a tab: the API lives on My Domain, not on the Lightning host.
export function getApiOrigin(tabUrl: string): string | null {
  const u = parseUrl(tabUrl)
  if (!u || u.protocol !== 'https:' || !isSalesforceHost(u.hostname)) return null
  if (u.hostname.endsWith(LIGHTNING_SUFFIX)) return `https://${counterpartHost(u.hostname)}`
  return u.origin
}

// URLs whose sid cookie belongs to the org the tab logged into: the tab's own host and its
// Lightning / My Domain counterpart. Never other orgs' hosts.
export function getSidCookieUrls(tabUrl: string): string[] {
  const u = parseUrl(tabUrl)
  if (!u || u.protocol !== 'https:' || !isSalesforceHost(u.hostname)) return []
  const other = counterpartHost(u.hostname)
  return other ? [u.origin, `https://${other}`] : [u.origin]
}

// sid cookie format: "{orgId}!{sessionKey}"
export function parseOrgIdFromSid(value: string): string | null {
  const [orgId, ...rest] = value.split('!')
  return rest.length > 0 && orgId.startsWith('00D') ? orgId : null
}
