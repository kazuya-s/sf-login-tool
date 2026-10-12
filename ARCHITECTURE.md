# KS SF Login — アーキテクチャ

Chrome 拡張機能として複数の Salesforce 組織へワンクリックでログインするツール。Windows / Mac / Linux の Chrome / Chromium で動作する。

## 技術スタック

| 分類 | 採用技術 |
|---|---|
| 拡張形式 | Chrome Extension Manifest V3 |
| UI | React 19 + TypeScript |
| ビルド | Vite 8 + @crxjs/vite-plugin 2.7 |
| 暗号化 | WebCrypto API（PBKDF2-SHA256 + AES-GCM-256） |
| 永続化 | chrome.storage.local（Vault）/ chrome.storage.session（セッションパスワード） |
| テスト | Vitest + jsdom |
| パッケージ管理 | pnpm 11（Node 22.12+） |

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
│       ├── url.ts                 # My Domain URL 検証・自動入力先 URL の判定
│       ├── useVault.tsx           # React Context（インメモリ鍵管理・マスターパスワード ON/OFF）
│       ├── useAppSettings.tsx     # React Context（言語・テーマ・masterPasswordEnabled）
│       └── i18n.ts               # 日本語 / English 翻訳テーブル
└── tests/
    ├── crypto.test.ts
    ├── storage.test.ts
    ├── vault.test.ts
    ├── orgs.test.ts
    ├── importExport.test.ts
    ├── url.test.ts
    └── i18n.test.ts
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
  createdAt: number
  updatedAt: number
}

type Vault = {
  orgs: Org[]
  groupOrder?: string[]  // グループ表示順
  collapsedGroups?: string[]  // 折りたたみ中のグループ名
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

### グループの開閉状態

- グループの開閉状態は `Vault.collapsedGroups` に保存し、ポップアップを閉じても維持する。グループ名を平文で残さないため、`chrome.storage.local` の設定ではなく暗号化された Vault に含める。
- org の削除・グループ変更・DnD 移動で空になったグループは `collapsedGroups` からも除去する。
- 検索中は開閉状態に関わらず全グループを展開表示する（保存された状態は変更しない）。

### ドラッグ&ドロップによる並べ替え

- グループ（`reorderGroup`）・org（`reorderOrg`）とも、下方向へのドラッグではドロップ先の**後ろ**、上方向へのドラッグではドロップ先の**前**に挿入する。これにより先頭・末尾のどちらへも移動できる。
- org を別グループの org 上にドロップした場合は、ドロップ先のグループへ移動する。
- ドラッグの上下は**画面の表示順**（`sortOrgsByGroup`：`getGroups` のグループ順 → グループ内は保存順）で判定する。グループの並べ替え後は `vault.orgs` の保存順と表示順が一致しないため、保存順で判定すると方向が逆になる。`reorderOrg` は表示順に並べ直した配列を保存する。
- ドロップ位置のインジケーターは、挿入先に合わせて「前」なら上線、「後ろ」なら下線を表示する（`getDropPosition`）。グループを後ろに入れる場合は、そのグループの最後の表示行に下線を表示する。
- グループのドラッグ中は、見出しだけでなく他グループの org 行にもドロップでき、その org が属するグループにドロップしたものとして扱う。
- グループをリスト下部の余白にドロップした場合は、末尾のグループにドロップしたものとして扱い、一番最後に移動する。

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

My Domain URL は `isValidMyDomainUrl()`（`lib/url.ts`）で検証する。`https:` で、ホストが `*.salesforce.com`、認証情報やポート指定を含まないものだけを受け付ける。フォーム保存時とインポート時の両方で適用し、インポートでは不正な行をスキップしてエラー件数に含める。

### 処理シーケンス

1. Popup がログインボタンをクリック → `{ type: 'LOGIN', payload }` を Service Worker へ送信
2. Service Worker が `loginBaseUrl` でタブ（新規 / シークレット / 新規ウィンドウ）を開く
3. Service Worker が `chrome.tabs.onUpdated` でページ読み込み完了を検知
4. 注入前に `canAutofillCredentials()` でタブの URL を確認し、`https://*.salesforce.com` 以外のページでは注入せず監視を終了する。確認できたら `chrome.scripting.executeScript` でログインフォームに `username` / `password` を注入してログインボタンをクリック（autofill 方式）
5. 再度 `onUpdated` でリダイレクト後の URL を確認。`isPostLoginUrl()`（`lib/url.ts`）で、`https` かつホスト名が `salesforce.com` / `force.com` またはそのサブドメインのページへ遷移していれば成功と判断する（ホスト名の末尾一致で判定し、パスやクエリに含まれる文字列では判定しない）
   - `*.salesforce.com` のトップページ（`/`）は、ログイン用ホストと同じかどうかに関わらずログイン後と判定しない。ログイン画面はここで表示され、ログインに失敗すると同じページに再表示されるため（リダイレクト先の `*.sandbox.my.salesforce.com` なども含む）
6. 成功後: `sid` Cookie から組織 ID を抽出（`parseOrgIdFromSid()`）して Vault に保存し、`{ type: 'VAULT_UPDATED' }` メッセージで Popup に通知
   - API バージョンは取得・保存しない。Salesforce のリリースで自動的に上がるため、ログイン時に保存した値はすぐに古くなり、実際と異なる値を表示してしまう（#76）。以前のバージョンが保存した `sfVersion` は `openVault()` で取り除く
   - `sid` Cookie は `getSidCookieUrls()` が返す、ログインしたタブのホストと、その Lightning（`*.lightning.force.com`）↔ My Domain（`*.my.salesforce.com`）の対応ホストからのみ `chrome.cookies.get` で読む。ブラウザ内の全 `sid` を探す処理は、ログイン中の別組織の ID を誤って保存したり不要なセッション Cookie を読んだりするため行わない
   - Cookie はログインしたタブが属する Cookie ストア（`chrome.cookies.getAllCookieStores()` から `findCookieStoreId()` で特定）を `storeId` に指定して読む。`storeId` を省略すると常に通常プロファイルのストアが使われ、シークレットウィンドウでのログインでもシークレット側のセッションを読めないため。タブのストアが見つからない場合は読まない
7. Popup: `VAULT_UPDATED` を受信したら Vault を再読み込みして表示を更新

### 設計上の注意点

- SOAP API `login()` は Summer '27（2027-06-01）廃止、API 65.0 以降では使用不可のため採用しない
- OAuth Web Server Flow は Phase 2
- `DOMParser` は MV3 Service Worker で使用不可のため、Salesforce の HTML パースは別途 `login.ts`（直接 POST 方式）に実装済みだったが現在は未使用。autofill 方式はフォーム DOM を直接操作するため HTML パースが不要
- 資格情報の注入先を `*.salesforce.com` に限定する。`*.force.com`（Visualforce・Lightning・旧 Sites など）は組織側が作成したコンテンツを配信できるため、`host_permissions` に含まれていても注入しない。ログイン先と異なるホストでも `*.salesforce.com` 内なら許可するのは、旧 Sandbox ドメインから `*.sandbox.my.salesforce.com` へのリダイレクトなどに対応するため
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

## 依存パッケージの管理

- 依存の脆弱性は `pnpm audit` で確認する。本番用の依存（`pnpm audit --prod`）は常に 0 件を保つ
- 上位パッケージが更新されるまで解消しない推移的依存の脆弱性は、`pnpm-workspace.yaml` の `overrides` で修正版を指定する。上位パッケージの更新で不要になったら削除する
