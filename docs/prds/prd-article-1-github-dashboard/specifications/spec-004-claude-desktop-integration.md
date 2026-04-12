# spec-004: Claude Desktop Integration and CSP

## Overview

ローカル MCP サーバーを `cloudflared` の HTTPS トンネル経由で Claude Desktop に公開し、UI がロードおよび (必要なら) `api.github.com` にアクセスできるよう正しい CSP を宣言する。Claude に "facebook/react を分析して" と問いかけるとダッシュボードが Claude の会話内で描画されることを End-to-End で確認する。この spec は CSP 落とし穴の実録を記事に使える形で記録するフェーズでもある。

## Acceptance Criteria

```gherkin
Feature: Claude Desktop 上での End-to-End 検証

  Background:
    spec-003 が完了し basic-host でダッシュボードが描画される

  Scenario: CSP が UI から外部 API アクセスを許可する
    Given サーバーが `_meta.ui.csp.connectDomains: ["https://api.github.com"]` を宣言している
    When UI がその CSP 付きで iframe にロードされる
    Then ブラウザは `https://api.github.com` へのリクエストをブロックしない

  Scenario: cloudflared トンネルがサーバーを公開する
    Given MCP サーバーがポート 3001 で起動している
    When 開発者が `cloudflared tunnel --url http://localhost:3001` を実行する
    Then 公開 HTTPS URL が出力される
    And その URL へのリクエストがローカル MCP サーバーに到達する

  Scenario: Claude Desktop がダッシュボードを描画する
    Given cloudflared URL が Claude Desktop Connectors に追加されている
    When ユーザーが Claude に "facebook/react を分析して" と送る
    And Claude が `analyze_repo` ツールを呼び出す
    Then ダッシュボード UI が Claude の会話内に描画される
    And ドーナツ / Star 数 / Contributor リストがすべて表示される
```

## Implementation Steps

- [ ] `server.ts` のツール登録に `_meta.ui.csp.connectDomains: ["https://api.github.com"]` を追加
- [ ] basic-host でブラウザコンソールに CSP 違反が出ないことを確認
- [ ] Contributor のアバター表示など、追加で必要なドメイン (例: `avatars.githubusercontent.com`) を `resourceDomains` に追加
- [ ] `cloudflared` を未インストールなら導入 (インストールコマンドを `knowledge.md` に記録)
- [ ] トンネルを起動し生成された HTTPS URL をキャプチャ
- [ ] URL を Claude Desktop Connectors に追加し、要求されたパーミッションを許可
- [ ] Claude に "facebook/react を分析して" と送って End-to-End テストを実行
- [ ] Claude Desktop でダッシュボードが描画されているスクリーンショットを取得し `docs/references/MCP Apps/screenshots/spec-004/` に保存
- [ ] CSP 落とし穴とホスト固有挙動を `knowledge.md` に記録
- [ ] Review (`/code-review`)

## Technical Notes

- **CSP 最終形** (初期値):
  ```json
  {
    "_meta": {
      "ui": {
        "resourceUri": "ui://github-dashboard/mcp-app.html",
        "csp": {
          "connectDomains": ["https://api.github.com"],
          "resourceDomains": ["https://avatars.githubusercontent.com"]
        }
      }
    }
  }
  ```
- **`connectDomains` vs `resourceDomains` の使い分け** (決定):
  - `connectDomains`: `fetch` / XHR / WebSocket で叩く API
  - `resourceDomains`: `<img>` / `<script>` / `<link>` で読み込むアセット
  - GitHub API は前者、アバター画像は後者
- **cloudflared コマンド** (決定):
  ```bash
  cloudflared tunnel --url http://localhost:3001
  ```
  起動時に出る `https://{random}.trycloudflare.com` を Claude Desktop に登録する
- **Claude Desktop 設定**:
  - Settings → Connectors → Add custom connector → URL を貼る
  - MCP サーバー URL のハッシュがサンドボックスのオリジンになる仕様なので、cloudflared URL が変わるたびに登録し直しが必要
- **既知のハマりどころ**:
  - CSP と CORS は別物。`connectDomains` を書いても GitHub API 側が Origin を許可しないと失敗する (GitHub 公開 API は許可済みなので通常は問題ない)
  - Claude Desktop がローカル開発中に cloudflared URL の HTTPS 証明書を要求する。`cloudflared` 既定の証明書で通る
  - 白画面になった場合、まずブラウザの DevTools で iframe を開き CSP 違反を確認する
- **未解決事項**: Claude Desktop で `ui/update-model-context` の挙動を確認するか否か (この spec の Acceptance Criteria には含まれない。将来の拡張候補)
