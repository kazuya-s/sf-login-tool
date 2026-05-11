# Salesforce Login Tool — アーキテクチャ

Chrome 拡張機能として複数の Salesforce 組織へワンクリックでログインするツール。Windows / Mac / Linux の Chrome / Chromium で動作する。

## 技術スタック

| 分類 | 採用技術 |
|---|---|
| 拡張形式 | Chrome Extension Manifest V3 |
| UI | React 19 + TypeScript |
| ビルド | Vite 5 + @crxjs/vite-plugin 2.4.0 |
| 暗号化 | WebCrypto API（PBKDF2-SHA256 + AES-GCM-256） |
| 永続化 | chrome.storage.local |
| テスト | Vitest + jsdom |
| パッケージ管理 | pnpm（Node 26） |

## ディレクトリ構成

```
src/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.ts      # ログイン処理・メッセージハンドラ
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx                # 組織一覧・検索・ログインボタン
│   ├── options/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx                # 組織CRUD・マスターパスワード変更
│   ├── components/
│   │   ├── MasterPasswordForm.tsx # 解錠・初期化フォーム
│   │   ├── OrgForm.tsx            # 組織追加・編集フォーム
│   │   └── ChangePasswordForm.tsx # マスターパスワード変更フォーム
│   └── lib/
│       ├── types.ts               # 共通型定義
│       ├── crypto.ts              # 暗号化・復号ラッパー
│       ├── storage.ts             # chrome.storage.local ラッパー
│       ├── vault.ts               # Vault 操作（ステートレス）
│       ├── orgs.ts                # Org CRUD（純関数）
│       ├── useVault.tsx           # React Context（インメモリ鍵管理）
│       └── login.ts               # ログイン処理
└── tests/
    ├── crypto.test.ts
    ├── storage.test.ts
    ├── vault.test.ts
    ├── orgs.test.ts
    └── login.test.ts
```

## 権限

```json
"permissions": ["storage", "cookies", "tabs", "alarms"],
"host_permissions": [
  "https://login.salesforce.com/*",
  "https://test.salesforce.com/*",
  "https://*.my.salesforce.com/*",
  "https://*.lightning.force.com/*",
  "https://*.force.com/*"
]
```

`alarms` は自動ロックの計時に使用。

## 暗号化仕様（`lib/crypto.ts`）

- 鍵派生: PBKDF2-SHA256、イテレーション 210,000、ソルト 16 バイト（ランダム）
- 暗号化: AES-GCM-256、IV 12 バイト（保存ごとに再生成）
- 保存形式: `{ salt, iv, ciphertext }` を base64 文字列として chrome.storage.local に 1 キーで格納
- マスターパスワードは UI で 8 文字以上を強制

## データモデル（`lib/types.ts`）

```ts
type OrgKind = 'production' | 'sandbox' | 'mydomain'

type Org = {
  id: string          // crypto.randomUUID()
  label: string
  kind: OrgKind
  myDomainUrl?: string  // kind === 'mydomain' のときのみ
  username: string
  password: string
  createdAt: number
  updatedAt: number
}

type Vault = { orgs: Org[] }

type Settings = { autoLockMinutes: number }  // デフォルト 5、暗号化対象外

type LoginResult =
  | { ok: true; finalUrl: string }
  | { ok: false; error: string }

type LoginPayload = {
  label: string
  username: string
  password: string
  loginBaseUrl: string
}

type BgMessage =
  | { type: 'LOGIN'; payload: LoginPayload }
  | { type: 'LOCK' }
```

## 状態管理（`lib/useVault.tsx`）

React Context で Vault の状態を管理する。マスターパスワードは `useRef` でインメモリに保持し、Popup が閉じると自然にクリアされる（= 自然ロック）。`alarms` API を使って `autoLockMinutes` 経過後に自動ロックする。

```
VaultStatus: 'loading' | 'uninitialized' | 'locked' | 'unlocked'
```

`vault.ts` はステートレスな非同期関数群（`initializeVault` / `openVault` / `persistVault` / `changePassword`）として実装し、`useVault.tsx` からのみ呼び出す。

## ログインフロー（`lib/login.ts` + `background/service-worker.ts`）

SOAP API `login()` は Summer '27（2027-06-01）廃止、API 65.0 以降では既に使用不可のため採用しない。OAuth Web Server Flow は Phase 2。MVP ではログインフォームへの直接 POST を採用する。

### URL 解決

| 種別 | loginBaseUrl |
|---|---|
| Production | `https://login.salesforce.com` |
| Sandbox | `https://test.salesforce.com` |
| My Domain | ユーザー入力の `https://<name>.my.salesforce.com` |

### 処理シーケンス

1. Popup がログインボタンをクリック → `{ type: 'LOGIN', payload }` を Service Worker へ送信
2. Service Worker: `GET <loginBaseUrl>/` を `credentials:'include'` で取得
3. レスポンス HTML を正規表現でパース（`DOMParser` は MV3 Service Worker で利用不可）、フォームの `action` 属性と全 `<input type="hidden">` を抽出
4. 抽出フィールド + `un=<username>` + `pw=<password>` を `application/x-www-form-urlencoded` で POST
5. `response.url`（リダイレクト後の最終 URL）を確認。`login.salesforce.com` / `test.salesforce.com` のままなら失敗と判断
6. `{ ok: true, finalUrl }` または `{ ok: false, error }` を Popup へ返す
7. Popup: 成功なら ✓ を 1.5 秒表示後 `chrome.tabs.create({ url: finalUrl })` でタブを開く
8. Popup: 失敗なら赤バナーでエラーメッセージを表示し、「手動でログイン →」ボタンで `loginBaseUrl` を開く救済導線を提供

### 設計上の注意点

- `DOMParser` は MV3 Service Worker で使用不可のため、HTML パースは正規表現で実装
- `chrome.tabs.create` は Popup 側で呼び出す。Service Worker から開くとレスポンス到達前に Popup が閉じてしまう
- Salesforce のフォーム構造（action URL・hidden フィールド名）が変わると機能しなくなる。フォールバックとして手動ログイン導線を必ず提供する

## 開発コマンド

```bash
pnpm install    # 依存インストール
pnpm dev        # 開発ビルド（ウォッチモード）
pnpm build      # 本番ビルド → dist/
pnpm test       # ユニットテスト（Vitest）
```

ビルド後 `dist/` を `chrome://extensions/` の「パッケージ化されていない拡張機能を読み込む」で読み込む。

## MVP スコープ外（Phase 2）

- OAuth Web Server Flow（PKCE）+ MFA / SSO 対応
- TOTP 自動入力
- インポート / エクスポート
- クラウド同期
- タブ装飾・Setup クイックリンク・URL 置換
- i18n
