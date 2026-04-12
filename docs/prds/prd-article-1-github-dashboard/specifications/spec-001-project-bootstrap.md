# spec-001: Project Bootstrap and Minimal MCP App

## Overview

プロジェクトを MCP Apps 開発に必要な最小構成で初期化し、自明な `hello_time` ツール (現在時刻を返すだけ) が公式 `basic-host` 上で UI として描画されることを検証する。この spec は MCP Apps の配線と外部 API 依存を分離し、以降の spec が既知良基準に対してデバッグできるようにする安全弁として機能する。

## Acceptance Criteria

```gherkin
Feature: 最小 MCP App の往復

  Background:
    MCP App 関連の事前設定が一切ないクリーンな Node.js 20 環境

  Scenario: プロジェクトがクローンからビルドまで通る
    Given リポジトリがクローンされている
    When 開発者が `npm install` を実行する
    And 開発者が `npm run build` を実行する
    Then Vite が単一ファイル `dist/mcp-app.html` を生成する
    And TypeScript エラーが発生しない

  Scenario: MCP サーバーが hello_time ツールを公開する
    Given MCP サーバーが起動している
    When クライアントが `tools/list` を要求する
    Then レスポンスに `hello_time` ツールが含まれる
    And ツール定義に `_meta.ui.resourceUri` が `ui://` URI を指す

  Scenario: UI が basic-host で描画される
    Given MCP サーバーがローカルで起動している
    And basic-host がこのサーバーに接続するよう設定されている
    When 開発者がブラウザで basic-host を開き `hello_time` を呼び出す
    Then UI iframe が描画される
    And iframe にサーバーの現在時刻が表示される
    And ブラウザコンソールにエラーが出ない
```

## Implementation Steps

- [ ] `package.json` を Node 20 engines とスクリプト (`build`, `start`, `dev`) で初期化
- [ ] `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, `express`, `cors`, `typescript`, `vite`, `vite-plugin-singlefile`, `react`, `react-dom` をインストール
- [ ] デュアル ESM サーバー + Vite クライアント構成向けの `tsconfig.json` を作成
- [ ] `server.ts` で `McpServer` を起動し `hello_time` を `registerAppTool` で登録
- [ ] `src/mcp-app.html` を Vite の UI リソース用エントリポイントとして作成
- [ ] `src/main.tsx` で `@modelcontextprotocol/ext-apps/react` の `useApp()` を使い、サーバー時刻を描画
- [ ] `vite.config.ts` を `viteSingleFile()` プラグイン入りで作成し、単一 HTML を出力
- [ ] `registerAppResource` を配線して `dist/mcp-app.html` を `text/html;profile=mcp-app` として返す
- [ ] `modelcontextprotocol/ext-apps` をクローンし、`basic-host` からこのサーバーに接続して往復を手動確認
- [ ] 最小 UI の basic-host 上スクリーンショットを `docs/references/MCP Apps/screenshots/spec-001/` に保存
- [ ] Review (TypeScript コンパイル + `/code-review`)

## Technical Notes

- **ディレクトリ構成** (決定): `server.ts` を repo ルート、UI 側を `src/` に置く。ビルド成果物は `dist/`
- **Node バージョン**: 20 LTS に固定 (`package.json` の `engines` で pin)
- **`hello_time` のツールシェイプ**: 引数なし、戻り値は `{ content: [{ type: "text", text: ISO8601 }] }` + UI リソース側は `ontoolresult` で同じ文字列を受ける
- **ポート番号** (決定): MCP サーバーは `3001`、basic-host 側は既定の `8080` を使う
- **MCP トランスポート**: Streamable HTTP (`/mcp` エンドポイント) を使う。stdio は使わない
- **UI のスタイル**: この spec ではベタ HTML + 最小 CSS (インライン) で十分。Recharts は spec-003 で追加
- **外部依存**: この spec では外部 API を叩かない。GitHub API は spec-002 から
- **未解決事項**: `@modelcontextprotocol/ext-apps` のバージョン pin は初回 `npm install` 時に確定し、記事内で明記する
