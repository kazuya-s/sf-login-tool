# KS SF Login — アーキテクチャ

Chrome 拡張機能として複数の Salesforce 組織へワンクリックでログインするツール。Windows / Mac / Linux の Chrome / Chromium で動作する。

## 技術スタック

| 分類 | 採用技術 |
|---|---|
| 拡張形式 | Chrome Extension Manifest V3 |
| UI | React 19 + TypeScript |
| ビルド | Vite 5 + @crxjs/vite-plugin 2.4.0 |
| 暗号化 | WebCrypto API（PBKDF2-SHA256 + AES-GCM-256） |
| 永続化 | chrome.storage.local（Vault）/ chrome.storage.session（セッションパスワード） |
| テスト | Vitest + jsdom |
| パッケージ管理 | pnpm（Node 22+） |

## ディレクトリ構成

```
src/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.ts      # ログイン処理・組織情報自動取得・メッセージハンドラ
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx                # 組織一覧・検索・ログイン・設定（全機能をPopupに統合）
│   ├── components/
│   │   ├── MasterPasswordForm.tsx # 解錠・初期化フォーム
│   │   ├── OrgForm.tsx            # 組織追加・編集フォーム
│   │   └── ChangePasswordForm.tsx # マスターパスワード変更フォーム
│   └── lib/
│       ├── types.ts               # 共通型定義
│       ├── crypto.ts              # 暗号化・復号ラッパー
│       ├── storage.ts             # chrome.storage.local / session ラッパー
│       ├── vault.ts               # Vault 操作（ステートレス）
│       ├── orgs.ts                # Org CRUD（純関数）
│       ├── importExport.ts        # JSON インポート・エクスポート
│       ├── useVault.tsx           # React Context（インメモリ鍵管理・マスターパスワード ON/OFF）
│       ├── useAppSettings.tsx     # React Context（言語・テーマ・masterPasswordEnabled）
│       └── i18n.ts               # 日本語 / English 翻訳テーブル
└── tests/
    ├── crypto.test.ts
    ├── storage.test.ts
    ├── vault.test.ts
    └── orgs.test.ts
```

## 権限

```json
"permissions": ["storage", "cookies", "tabs", "alarms", "scripting"],
"host_permissions": [
  "https://login.salesforce.com/*",
  "https://test.salesforce.com/*",
  "https://*.my.salesforce.com/*",
  "https://*.lightning.force.com/*",
  "https://*.force.com/*"
]
```

`scripting` は autofill ログイン（フォームへの値注入）と組織情報の自動取得に使用。

## 暗号化仕様（`lib/crypto.ts`）

- 鍵派生: PBKDF2-SHA256、イテレーション 210,000、ソルト 16 バイト（ランダム）
- 暗号化: AES-GCM-256、IV 12 バイト（保存ごとに再生成）
- 保存形式: `{ salt, iv, ciphertext }` を base64 文字列として chrome.storage.local に 1 キーで格納
- マスターパスワードは UI で 8 文字以上を強制

## データモデル（`lib/types.ts`）

```ts
type OrgKind = 'production' | 'sandbox' | 'mydomain' | 'developer'

type Org = {
  id: string           // crypto.randomUUID()
  label: string
  kind: OrgKind
  group?: string       // グループ名。省略時は 'default'
  myDomainUrl?: string // kind === 'mydomain' のときのみ
  username: string
  password: string
  notes?: string
  sfOrgId?: string     // ログイン後に自動取得した組織 ID
  sfVersion?: string   // ログイン後に自動取得した API バージョン
  createdAt: number
  updatedAt: number
}

type Vault = {
  orgs: Org[]
  groupOrder?: string[]  // グループ表示順
}

type Settings = { autoLockMinutes: number }  // 現在未使用（将来の自動ロック用）

type LoginResult =
  | { ok: true }
  | { ok: false; error: string }

type LoginTarget = 'tab' | 'incognito' | 'window'

type LoginPayload = {
  orgId: string
  label: string
  username: string
  password: string
  loginBaseUrl: string
  target: LoginTarget
}

type BgMessage =
  | { type: 'LOGIN'; payload: LoginPayload }
  | { type: 'VAULT_UPDATED' }
```

## 状態管理

### `lib/useVault.tsx`

React Context で Vault の状態を管理する。マスターパスワードは `chrome.storage.session`（揮発メモリ）に保持し、ブラウザ終了時に自動クリアされる（= 自然ロック）。ディスクには保存しない。

```
VaultStatus: 'loading' | 'uninitialized' | 'locked' | 'unlocked'
```

`vault.ts` はステートレスな非同期関数群（`initializeVault` / `openVault` / `persistVault` / `changePassword`）として実装し、`useVault.tsx` からのみ呼び出す。

#### マスターパスワード ON/OFF

- **無効（デフォルト）**: `INTERNAL_KEY`（固定文字列）で Vault を暗号化。ユーザー認証なしでアクセス可能。パスワード保護の実効性なし。
- **有効**: ユーザー入力のマスターパスワードで Vault を暗号化。`chrome.storage.session` にパスワードを保持してブラウザセッション中はロック解除状態を維持。ブラウザ終了で自動ロック。
- ON/OFF 切り替え時は `changePassword()` で Vault を再暗号化。`masterPasswordEnabled` フラグを `chrome.storage.local` の `app_settings` に保存。

### `lib/useAppSettings.tsx`

言語・テーマ・`masterPasswordEnabled` を `chrome.storage.local` の `app_settings` キーに JSON で保存。

## ログインフロー（`background/service-worker.ts`）

### URL 解決

| 種別 | loginBaseUrl |
|---|---|
| Production | `https://login.salesforce.com` |
| Sandbox | `https://test.salesforce.com` |
| Developer Edition | `https://login.salesforce.com` |
| My Domain | ユーザー入力の `https://<name>.my.salesforce.com` |

### 処理シーケンス

1. Popup がログインボタンをクリック → `{ type: 'LOGIN', payload }` を Service Worker へ送信
2. Service Worker が `loginBaseUrl` でタブ（新規 / シークレット / 新規ウィンドウ）を開く
3. Service Worker が `chrome.tabs.onUpdated` でページ読み込み完了を検知
4. `chrome.scripting.executeScript` でログインフォームに `username` / `password` を注入してログインボタンをクリック（autofill 方式）
5. 再度 `onUpdated` でリダイレクト後の URL を確認。Salesforce 内ページへ遷移していれば成功と判断
6. 成功後: `chrome.scripting.executeScript` で `/services/data/` を fetch し最新 API バージョンを取得。`sid` Cookie から組織 ID を抽出。両値を Vault に保存し `{ type: 'VAULT_UPDATED' }` メッセージで Popup に通知
7. Popup: `VAULT_UPDATED` を受信したら Vault を再読み込みして表示を更新

### 設計上の注意点

- SOAP API `login()` は Summer '27（2027-06-01）廃止、API 65.0 以降では使用不可のため採用しない
- OAuth Web Server Flow は Phase 2
- `DOMParser` は MV3 Service Worker で使用不可のため、Salesforce の HTML パースは別途 `login.ts`（直接 POST 方式）に実装済みだったが現在は未使用。autofill 方式はフォーム DOM を直接操作するため HTML パースが不要
- autofill 方式はサイト改変に強い反面、Salesforce がスクリプト注入を制限した場合に壊れる

## 開発コマンド

```bash
pnpm install    # 依存インストール
pnpm dev        # 開発ビルド（ウォッチモード）
pnpm build      # 本番ビルド → dist/
pnpm test       # ユニットテスト（Vitest）
pnpm typecheck  # TypeScript 型チェック
pnpm lint       # ESLint
```

ビルド後 `dist/` を `chrome://extensions/` の「パッケージ化されていない拡張機能を読み込む」で読み込む。

## MVP スコープ外（Phase 2）

- OAuth Web Server Flow（PKCE）+ MFA / SSO 対応
- TOTP 自動入力
- クラウド同期
- タブ装飾・Setup クイックリンク・URL 置換
- 自動ロック（alarms API による一定時間後のロック）
