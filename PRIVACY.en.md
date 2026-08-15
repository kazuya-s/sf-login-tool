# Privacy Policy

[日本語](./PRIVACY.md)

Last updated: 2026-08-15

KS SF Login (the "Extension") is a Chrome extension that helps users log in to multiple Salesforce organizations. This policy explains what data the Extension handles and how it is treated.

## Data We Collect

The Extension only handles information that the user voluntarily enters:

- Salesforce username and password for each registered org
- Optional fields such as org label, group name, and notes
- Organization ID and API version, automatically retrieved after a successful login

The Extension does not collect any other data, such as browsing history, location, personal communications, or payment information.

## How Data Is Stored

- All of the above data is stored **only locally in the user's browser** (`chrome.storage.local`), in encrypted form (key derivation via PBKDF2-SHA256, encryption via AES-GCM-256).
- If the optional master password feature is enabled, the password is held only in `chrome.storage.session` (volatile memory) and is automatically cleared when the browser closes. It is never written to disk.
- When the master password is disabled (the default), data is encrypted with a fixed internal key.

## Data Transmission

**The Extension never sends any data to an external server.** No third party, including the developer, can access user data. The source code is publicly available for review.

## Cookie Access

The Extension uses the `cookies` permission to read the Salesforce `sid` session cookie after a successful login. This is used solely to determine the Salesforce Organization ID; nothing else from the cookie (such as the session key) is stored or transmitted.

## Sharing With Third Parties

User data is never sold or shared with third parties. It is never used for any purpose other than the Extension's single purpose (assisting Salesforce login), and it is never used for creditworthiness or lending decisions.

## Disclaimer

This Extension is an unofficial, independently developed tool and is not affiliated with Salesforce, Inc.

## Contact

For questions about this policy or the Extension, please open an issue on GitHub:

https://github.com/kazuya-s/sf-login-tool/issues
