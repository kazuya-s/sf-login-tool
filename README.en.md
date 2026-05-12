# KS SF Login

A Chrome extension for one-click login to multiple Salesforce orgs.

[日本語](./README.md)

---

## Features

- **One-click login** — Opens the Salesforce login page, auto-fills credentials, and clicks the login button
- **Multi-org management** — Supports Production, Sandbox, and My Domain orgs
- **Group management** — Organize orgs into groups with drag-and-drop reordering and collapsible headers
- **Encrypted local storage** — AES-GCM-256 + PBKDF2-SHA256 encryption. No data is sent to any server
- **Master password** — When enabled, org credentials require a master password to access. Auto-locks when the browser closes
- **Auto-save org info** — After login, automatically saves the Organization ID and API version
- **Notes field** — Add memos to each org entry
- **Theme switcher** — Light / Dark / Blue / Forest
- **Multi-language** — Japanese / English
- **Login target** — Choose new tab, incognito window, or new window

## Installation

Not yet published on the Chrome Web Store. Load as an unpacked extension.

### Steps

1. Clone this repository
2. Build the extension (see below) to generate the `dist/` folder
3. Open `chrome://extensions/` in Chrome
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the `dist/` folder

## Usage

### Initial Setup

1. Click the extension icon in the toolbar
2. Set a master password (8+ characters)
3. Click ⚙ → Add your first org

### Adding an Org

| Field | Description |
|-------|-------------|
| Label | Display name (e.g. Production) |
| Group | Optional group name for organizing orgs |
| Type | Production / Sandbox / My Domain |
| My Domain URL | Required when type is My Domain (e.g. `https://example.my.salesforce.com`) |
| Username | Your Salesforce login ID |
| Password | Your Salesforce password |
| Notes | Optional free-text memo |

### Logging In

Click one of the buttons on each org row:

| Button | Action |
|--------|--------|
| ↗ | Login in a new tab |
| 👓 | Login in an incognito window |
| ⧉ | Login in a new window |

After a successful login, the Organization ID and API version are automatically saved to the org entry.

## Security

- All credentials are **stored locally** in `chrome.storage.local`
- No data is ever sent to external servers
- The master password is held only in `chrome.storage.session` (volatile memory), cleared when the browser closes, and never written to disk
- Encryption: **PBKDF2-SHA256** (210,000 iterations) for key derivation, **AES-GCM-256** for encryption
- **Credentials are only meaningfully protected when the master password is enabled.** When disabled (default), a fixed internal key is used for encoding
- Auto-locks when the browser closes (master password enabled only)

> **Disclaimer**: This is an unofficial, personal-use tool and is not affiliated with Salesforce, Inc.

## Development

### Requirements

- Node.js 26+ ([mise](https://mise.jdx.dev/) recommended)
- pnpm

### Setup

```bash
git clone https://github.com/kazuya-s/sf-login-tool.git
cd sf-login-tool
pnpm install
```

### Dev Build (watch mode)

```bash
pnpm dev
```

### Production Build

```bash
pnpm build
# Generates the extension in dist/
```

### Tests

```bash
pnpm test
```

### Tech Stack

| Category | Technology |
|----------|------------|
| UI | React + TypeScript |
| Build | Vite + @crxjs/vite-plugin |
| Encryption | WebCrypto API (PBKDF2 + AES-GCM) |
| Storage | chrome.storage.local / session |
| Testing | Vitest |
| Target | Chrome / Chromium (Manifest V3) |

## License

[MIT License](./LICENSE)
