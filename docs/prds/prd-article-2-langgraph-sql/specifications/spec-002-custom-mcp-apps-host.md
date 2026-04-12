# spec-002: Custom MCP Apps Host (React)

## Overview

`modelcontextprotocol/ext-apps` の公式 `basic-host` を参考に、React SPA で自作の MCP Apps ホストを構築する。最小構成として「`ui://` リソースを iframe にロードする」「`ui/initialize` ハンドシェイクに応じる」「`ui/notifications/tool-result` を送る」までを実装する。この spec では LangGraph との接続はまだ行わず、スタブのツール結果を送って iframe が正しく描画されることだけを確認する。

## Acceptance Criteria

```gherkin
Feature: 自作 MCP Apps ホストが UI リソースを描画する

  Background:
    Node.js 20 環境、spec-001 は関与しない

  Scenario: 自作ホストが起動する
    Given 開発者が `npm run dev` を実行する
    Then React SPA が `http://localhost:5173` で起動する
    And トップページに "MCP Apps Host" と表示される

  Scenario: UI リソースが iframe にロードされる
    Given スタブ MCP サーバーが `ui://hello/mcp-app.html` を提供している
    When 自作ホストがサーバーに接続する
    Then 自作ホストは `resources/read` で HTML を取得する
    And 取得した HTML を sandboxed iframe にロードする

  Scenario: postMessage ハンドシェイクが成立する
    Given iframe がロードされている
    When iframe が `ui/initialize` を送信する
    Then 自作ホストは host context を返す
    And iframe が `ui/notifications/initialized` を送信する

  Scenario: ツール結果が iframe に届く
    Given 自作ホストがスタブツール結果を保持している
    When 開発者が "Send tool result" ボタンを押す
    Then 自作ホストが `ui/notifications/tool-result` を iframe に送信する
    And iframe 内の UI が結果を描画する
```

## Implementation Steps

- [ ] `frontend/` ディレクトリを作成 (Vite + React + TypeScript)
- [ ] `basic-host` のソースを読み、iframe ローダーと postMessage ブリッジの最小実装を移植
- [ ] sandboxed iframe を生成する `IframeLoader` コンポーネントを作成 (sandbox="allow-scripts allow-same-origin")
- [ ] JSON-RPC ディスパッチャを実装し `ui/initialize`, `ui/notifications/*` を扱う
- [ ] ツール結果スタブを送るデバッグボタンを画面に配置
- [ ] spec-001 とは別プロセスで動くよう、CORS と dev server の設定を記載
- [ ] 最小スタブ MCP サーバー (Node) を `scripts/stub-server.ts` として追加し、`hello_tool` と `ui://hello/mcp-app.html` を返す
- [ ] 動作確認のスクリーンショットを `docs/references/MCP Apps/screenshots/article-2/spec-002/` に保存
- [ ] Review (build check + `/code-review`)

## Technical Notes

- 自作ホストは**ダブル iframe (Sandbox proxy)** は採用しない。理由は学習用途のためオリジン分離を厳密にしない方針で、実装コストを削るため。記事内でこの判断理由を明示する
- spec-003 で承認 UI を実装する際、この spec のスケルトンに差し込む形になる
- LangGraph 接続は spec-004。ここではスタブで動けば合格
- `@modelcontextprotocol/ext-apps/app-bridge` が使えるならそれを使う。使えない / 学習のためには生 postMessage を書く
