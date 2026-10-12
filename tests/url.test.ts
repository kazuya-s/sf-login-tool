import { describe, it, expect } from 'vitest'
import { isSalesforceLoginHost, isValidMyDomainUrl, canAutofillCredentials } from '../src/lib/url'

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
