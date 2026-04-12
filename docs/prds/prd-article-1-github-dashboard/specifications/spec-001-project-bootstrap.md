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

- [x] `package.json` を Node 20 engines とスクリプト (`build`, `dev:ui`, `dev:server`, `start`) で初期化 (`projects/article-1/package.json`、2026-04-12)
- [x] `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, `express`, `cors`, `typescript`, `tsx`, `vite`, `vite-plugin-singlefile`, `@vitejs/plugin-react`, `react`, `react-dom` + `@types/*` をインストール (2026-04-12)
- [x] デュアル ESM サーバー + Vite クライアント構成向けの `tsconfig.json` を作成 (`projects/article-1/tsconfig.json`、`server.ts` と `src/` 両方を include、2026-04-12)
- [x] `server.ts` で `McpServer` を起動し `hello_time` を `registerAppTool` で登録 + UI リソースを `registerAppResource` で登録 + `dist/mcp-app.html` フォールバック実装 (2026-04-12)
- [x] `src/mcp-app.html` を Vite の UI リソース用エントリポイントとして作成 (2026-04-12)
- [x] `src/main.tsx` で `@modelcontextprotocol/ext-apps/react` の `useApp()` を使い、サーバー時刻を描画 (`HelloTimeApp` + `StatusBadge` で connecting/connected/error 状態を可視化、2026-04-12)
- [ ] `vite.config.ts` を `viteSingleFile()` プラグイン入りで作成し、単一 HTML を出力
- [x] `registerAppResource` を配線して `dist/mcp-app.html` を `text/html;profile=mcp-app` として返す (Vite ビルド前はフォールバック HTML、2026-04-12)
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

## Resolved Dependency Versions (2026-04-12 時点)

初回 `npm install` で確定した実バージョン (PRD 初稿の想定とはメジャーバージョンがずれたものがある)。

| パッケージ | 実バージョン | 初稿想定 | 備考 |
|---|---|---|---|
| `@modelcontextprotocol/sdk` | `^1.29.0` | — | |
| `@modelcontextprotocol/ext-apps` | `^1.5.0` | v1.x | PRD 想定通り |
| `express` | `^5.2.1` | `^4.x` | **Express 5 系を採用** (middleware API に変更あり) |
| `cors` | `^2.8.6` | — | |
| `react` | `^19.2.5` | `18` | **React 19 系を採用** |
| `react-dom` | `^19.2.5` | `18` | React に合わせる |
| `typescript` | `^6.0.2` | `5.x` | **TypeScript 6 系を採用** |
| `vite` | `^8.0.8` | `5.x` | **Vite 8 系を採用** (config 形式は後方互換あり) |
| `vite-plugin-singlefile` | `^2.3.2` | `2.x` | PRD 想定通り |
| `@vitejs/plugin-react` | `^6.0.1` | — | React 19 対応バージョン |
| `tsx` | `^4.21.0` | — | `server.ts` を TypeScript のまま起動するため |
| `@types/node` | `^25.6.0` | — | |

記事執筆時にはこのバージョン表をそのまま引用する。
