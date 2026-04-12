# spec-006: OAuth 2.1 Authorization Server and Fly.io Deployment

## Overview

spec-004 で cloudflared quick tunnel を使って ChatGPT から繋いだ Article 3 サーバーを、**本格的な公開ホスティング (Fly.io) + MCP 仕様準拠の OAuth 2.1 認可サーバー**に昇格させる。ChatGPT の Custom Connector UI が `OAuth / No Auth / Mixed` の 3 択しか提供しない制約に合わせ、MCP サーバー自身が OAuth 2.1 Authorization Code Flow + PKCE + Dynamic Client Registration の最小実装を持ち、自分自身を Authorization Server 兼 Resource Server として機能させる。さらに Anthropic Console の monthly spend cap を併用し、認証が万一破られても API 課金被害が絶対額で頭打ちになる "2 段構え" のガードレールを構築する。

## Acceptance Criteria

```gherkin
Feature: OAuth 認可込みでクラウドに MCP サーバーを公開

  Background:
    spec-001〜spec-004 が完了し、Article 3 サーバーの基本機能 (ask_claude + UI 描画) は動く
    Fly.io アカウントが作成済み、ANTHROPIC_API_KEY が準備できている

  Scenario: OAuth ディスカバリが動く
    Given サーバーがクラウド上で起動している
    When `GET /.well-known/oauth-authorization-server` を HTTPS で叩く
    Then RFC 8414 準拠のメタデータ JSON が返る
    And `registration_endpoint` / `authorization_endpoint` / `token_endpoint` が全て指定されている
    And `code_challenge_methods_supported` に `S256` が含まれる

  Scenario: ChatGPT が DCR で自動登録できる
    Given サーバーが /register を公開している
    When ChatGPT が Custom Connector を新規作成する
    Then ChatGPT は /register に POST してクライアント資格情報を得る
    And 以降 ChatGPT は得た client_id でフローを進める

  Scenario: ユーザー同意フローが通る
    Given ChatGPT が /authorize に redirect してきた
    When ユーザーが同意画面で OAUTH_OWNER_PASSWORD を入力して Approve
    Then サーバーは authorization code を発行する
    And ChatGPT の callback URL に redirect されて code + state が戻る

  Scenario: code と access token が交換できる (PKCE S256)
    Given ChatGPT が code + code_verifier を持っている
    When ChatGPT が /token に POST で code + verifier を送る
    Then サーバーは事前に保存した code_challenge を verifier から再計算して一致を確認
    And 不透明な access_token を返す
    And access_token には TTL (24h) が設定されている

  Scenario: MCP エンドポイントが access_token を要求
    Given access_token 未付与で `/mcp` に POST
    When サーバーが Authorization ヘッダを検証する
    Then 401 Unauthorized が返る
    And `WWW-Authenticate: Bearer resource_metadata=...` ヘッダが付与される

  Scenario: 有効な access_token で MCP ツール呼び出しが通る
    Given ChatGPT が有効な access_token を持っている
    When `/mcp` に `Authorization: Bearer <token>` で POST
    Then 既存の MCP ハンドラに到達し ask_claude ツールが実行される

  Scenario: Fly.io にデプロイされる
    Given Dockerfile / fly.toml / .dockerignore が整備されている
    When 開発者が `fly deploy` を実行
    Then アプリが Fly.io 上で起動する
    And `https://<app-name>.fly.dev/mcp` が HTTPS で到達可能
    And ANTHROPIC_API_KEY / OAUTH_OWNER_PASSWORD が fly secrets として設定されている
    And ALLOWED_HOSTS が fly.dev のホスト名と一致している

  Scenario: Anthropic 予算キャップが設定される
    Given Anthropic Console にアクセス可能
    When 開発者が Settings → Limits で monthly spend limit を設定
    Then 認証突破時でも月額 N ドルを超えて課金されない
    And 設定値が knowledge.md に記録される

  Scenario: ChatGPT で End-to-End に動作する
    Given Fly.io にデプロイ済み + OAuth 実装済み + Anthropic spend cap 設定済み
    When ChatGPT に新しい Custom Connector として Fly.io URL を登録
    Then ChatGPT が OAuth discovery → DCR → authorize → token 交換 を自動で完了させる
    And ChatGPT の会話から ask_claude が呼ばれる
    And Claude の回答カードが会話内に描画される
```

## Implementation Steps

- [ ] `projects/article-3/src/oauth.ts` を新規作成 — ディスカバリ / DCR / authorize / token ハンドラ + インメモリストア (Map + TTL) + PKCE S256 検証 + access_token 検証ミドルウェア
- [ ] `projects/article-3/server.ts` を更新 — oauth.ts のルートを Express に mount、`/mcp` の前に `verifyAccessToken` を挟む、既存の `AUTH_TOKEN` ベースの Bearer チェックを削除
- [ ] `projects/article-3/.env.example` を更新 — `OAUTH_OWNER_PASSWORD`, `OAUTH_ISSUER` を追加、`AUTH_TOKEN` 行を削除
- [ ] ローカルで curl ベースのエンドツーエンドテスト (discovery → register → authorize → token → /mcp) を手動実行し、全ステップが通ることを確認
- [ ] `projects/article-3/fly.toml` / `Dockerfile` は既存のまま流用可、Dockerfile が `OAUTH_*` env を想定できているか確認
- [ ] `fly apps create` + `fly secrets set ANTHROPIC_API_KEY AUTH_TOKEN_NONE(=削除) OAUTH_OWNER_PASSWORD OAUTH_ISSUER ALLOWED_HOSTS` + `fly deploy`
- [ ] Anthropic Console で monthly spend limit を設定し、設定金額を `knowledge.md` に記録
- [ ] ChatGPT Custom Connector を新規作成し、Fly.io URL + OAuth 自動ディスカバリで繋ぐ
- [ ] 同意画面で `OAUTH_OWNER_PASSWORD` を入力して Approve し、フロー全体を手動で検証
- [ ] 実際に "Claude にも聞いてみて" と送り、ask_claude が OAuth 越しに呼ばれて UI が描画されることを確認
- [ ] スクショを `docs/references/MCP Apps/screenshots/article-3-spec-006/` に保存 (OAuth 同意画面 / ChatGPT 内描画 / Fly.io dashboard)
- [ ] `knowledge.md` に記録 — minimal OAuth サーバー実装の割り切り項目、ChatGPT の OAuth 実装の癖、cold-start 懸念、spend cap の実効値
- [ ] Review (`/code-review` + `/build-check`)
- [ ] spec-005 の記事ドラフトに OAuth 実装の章を追記

## Technical Notes

- **設計の割り切り 7 項目** (ユーザー合意済み):
  1. ユーザー認証 = env の `OAUTH_OWNER_PASSWORD` を同意画面で入力するだけ
  2. DCR で誰が register しても **固定の `client_id`** を返す
  3. トークン形式 = **不透明なランダム文字列** (JWT ではない)
  4. ストレージ = **インメモリ `Map` + TTL** (サーバー再起動で全部消える)
  5. スコープ = 定義しない (全権限トークン 1 種)
  6. リフレッシュトークン = 発行しない、access_token TTL を 24h にする
  7. PKCE = `S256` のみ (`plain` は拒否)

- **新規エンドポイント**:
  - `GET /.well-known/oauth-authorization-server` — RFC 8414 メタデータ
  - `POST /register` — Dynamic Client Registration (RFC 7591)
  - `GET /authorize` — 同意画面 HTML
  - `POST /authorize` — 同意 submit → code 発行 → ChatGPT callback へ redirect
  - `POST /token` — code + PKCE verifier → access_token
- **`/mcp` の認可**: 既存の POST ハンドラの前に `verifyAccessToken` ミドルウェアを挟む。401 時は `WWW-Authenticate: Bearer resource_metadata="<discovery URL>"` を付与 (RFC 9728)
- **同意画面 UI**: 最小の HTML フォーム。テーマは Claude オレンジで統一し、記事のスクショ映えも考慮
- **トークン管理構造**:
  ```ts
  type CodeEntry = { clientId: string; codeChallenge: string; redirectUri: string; expiresAt: number };
  type TokenEntry = { clientId: string; expiresAt: number };
  const codes = new Map<string, CodeEntry>();
  const tokens = new Map<string, TokenEntry>();
  ```
- **PKCE S256 検証**:
  ```ts
  const expected = crypto.createHash("sha256").update(verifier).digest("base64url");
  if (expected !== storedChallenge) throw ...;
  ```
- **ChatGPT の OAuth 挙動の未知数**: state の扱い / scope の強制値 / callback URL の完全一致チェック / cold-start タイムアウト時のリトライ可否 — これらはテストで洗い出す想定
- **HTTPS 要件**: OAuth redirect は HTTPS 必須なので、ローカルで ChatGPT との end-to-end は不可能。curl でサーバー単体テスト → Fly.io 本番でのみ ChatGPT 検証
- **cold-start 対策**: `auto_stop_machines = "stop"` + `min_machines_running = 0` のままだと初回 discovery がタイムアウトする可能性あり。ダメなら `min_machines_running = 1` に昇格 (月数十セント)
- **spend cap 推奨値**: $10 / 月 (自分用 + 記事読者が少し叩いてもセーフな範囲)
- **記事への組み込み**: spec-005 の現在の「MCP サーバーを外に置くときの注意点」セクションの後ろに、**"認証はどう足したか (OAuth 2.1 の最小実装)"** という 1 章を追加する想定。Zenn 記事 1 本のメインテーマを "OAuth 実装の話" にシフトさせるのではなく、"MCP Apps の面白さ + 公開する時のリアル" の片翼として扱う
