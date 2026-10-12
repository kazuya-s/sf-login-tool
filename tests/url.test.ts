import { describe, it, expect } from 'vitest'
import { isSalesforceLoginHost, isValidMyDomainUrl, canAutofillCredentials, isSalesforceHost, isPostLoginUrl, getSidCookieUrls, parseOrgIdFromSid } from '../src/lib/url'

describe('isSalesforceLoginHost', () => {
  it.each([
    'login.salesforce.com',
    'test.salesforce.com',
    'example.my.salesforce.com',
    'example--dev.sandbox.my.salesforce.com',
  ])('accepts %s', host => {
    expect(isSalesforceLoginHost(host)).toBe(true)
  })

  it.each([
    'salesforce.com.evil.example',
    'evilsalesforce.com',
    'example.lightning.force.com',
    'example.my.site.com',
    'evil.example',
  ])('rejects %s', host => {
    expect(isSalesforceLoginHost(host)).toBe(false)
  })
})

describe('isValidMyDomainUrl', () => {
  it.each([
    'https://example.my.salesforce.com',
    'https://example.my.salesforce.com/',
    'https://example--dev.sandbox.my.salesforce.com',
    '  https://example.my.salesforce.com  ',
  ])('accepts %s', url => {
    expect(isValidMyDomainUrl(url)).toBe(true)
  })

  it.each([
    ['http', 'http://example.my.salesforce.com'],
    ['non-Salesforce host', 'https://evil.example'],
    ['look-alike host', 'https://example.my.salesforce.com.evil.example'],
    ['host only in path', 'https://evil.example/.salesforce.com'],
    ['force.com host', 'https://example.lightning.force.com'],
    ['embedded credentials', 'https://user:pass@example.my.salesforce.com'],
    ['custom port', 'https://example.my.salesforce.com:8443'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['not a URL', 'example.my.salesforce.com'],
    ['empty', ''],
  ])('rejects %s', (_, url) => {
    expect(isValidMyDomainUrl(url)).toBe(false)
  })
})

describe('canAutofillCredentials', () => {
  it.each([
    'https://login.salesforce.com/?type=twobox',
    'https://test.salesforce.com/',
    'https://example.my.salesforce.com/?startURL=%2Fhome',
    'https://example--dev.sandbox.my.salesforce.com/',
  ])('allows %s', url => {
    expect(canAutofillCredentials(url)).toBe(true)
  })

  it.each([
    'http://login.salesforce.com/',
    'https://example.lightning.force.com/lightning/page/home',
    'https://example--c.vf.force.com/apex/Page',
    'https://evil.example/?.salesforce.com',
    'https://idp.example.com/sso',
    'about:blank',
    '',
  ])('blocks %s', url => {
    expect(canAutofillCredentials(url)).toBe(false)
  })
})

describe('isSalesforceHost', () => {
  it.each([
    'login.salesforce.com',
    'example.my.salesforce.com',
    'example.lightning.force.com',
    'example--dev.sandbox.lightning.force.com',
    'salesforce.com',
    'force.com',
  ])('accepts %s', host => {
    expect(isSalesforceHost(host)).toBe(true)
  })

  it.each([
    'salesforce.com.evil.example',
    'force.com.evil.example',
    'evilsalesforce.com',
    'notforce.com',
    'evil.example',
  ])('rejects %s', host => {
    expect(isSalesforceHost(host)).toBe(false)
  })
})

describe('isPostLoginUrl', () => {
  const login = 'https://login.salesforce.com'

  it.each([
    ['Lightning home', 'https://example.lightning.force.com/lightning/page/home'],
    ['My Domain frontdoor', 'https://example.my.salesforce.com/secur/frontdoor.jsp?sid=x'],
    ['Classic home on the login host', 'https://login.salesforce.com/home/home.jsp'],
    ['Classic home on My Domain', 'https://example.my.salesforce.com/home/home.jsp'],
    ['Lightning root (redirects to home)', 'https://example.lightning.force.com/'],
  ])('accepts %s', (_, url) => {
    expect(isPostLoginUrl(url, login)).toBe(true)
  })

  it.each([
    // a failed login re-renders the login form at the root
    ['login page re-rendered after a failed login', 'https://login.salesforce.com/'],
    ['login page with query', 'https://login.salesforce.com/?un=x'],
    ['My Domain login page', 'https://example.my.salesforce.com/'],
    ['sandbox login page reached by redirect', 'https://example--dev.sandbox.my.salesforce.com/'],
    ['login page with path', 'https://login.salesforce.com/login.jsp'],
    ['secur page on the login host', 'https://login.salesforce.com/secur/verification.jsp'],
    ['http', 'http://example.my.salesforce.com/home/home.jsp'],
    ['domain only in path', 'https://evil.example/.salesforce.com/home'],
    ['domain only in query', 'https://evil.example/?next=.force.com'],
    ['look-alike host', 'https://example.my.salesforce.com.evil.example/home'],
    ['invalid url', 'not a url'],
  ])('rejects %s', (_, url) => {
    expect(isPostLoginUrl(url, login)).toBe(false)
  })

  it('rejects everything when the login base URL is invalid', () => {
    expect(isPostLoginUrl('https://example.lightning.force.com/', 'nope')).toBe(false)
  })
})

describe('getSidCookieUrls', () => {
  it('returns the Lightning host and its My Domain counterpart', () => {
    expect(getSidCookieUrls('https://example.lightning.force.com/lightning/page/home'))
      .toEqual(['https://example.lightning.force.com', 'https://example.my.salesforce.com'])
  })

  it('returns the My Domain host and its Lightning counterpart', () => {
    expect(getSidCookieUrls('https://example--dev.sandbox.my.salesforce.com/home'))
      .toEqual(['https://example--dev.sandbox.my.salesforce.com', 'https://example--dev.sandbox.lightning.force.com'])
  })

  it('returns only the tab host when it has no counterpart', () => {
    expect(getSidCookieUrls('https://login.salesforce.com/home/home.jsp')).toEqual(['https://login.salesforce.com'])
  })

  it.each([
    'https://evil.example/.salesforce.com',
    'http://example.my.salesforce.com',
    'not a url',
  ])('returns nothing for %s', url => {
    expect(getSidCookieUrls(url)).toEqual([])
  })
})

describe('parseOrgIdFromSid', () => {
  it('extracts the org ID', () => {
    expect(parseOrgIdFromSid('00D5g000000abcd!AQ8AQ.session')).toBe('00D5g000000abcd')
  })

  it.each(['00D5g000000abcd', '005xx!AQ8AQ', ''])('returns null for %s', value => {
    expect(parseOrgIdFromSid(value)).toBeNull()
  })
})
