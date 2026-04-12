# spec-001: Project Bootstrap and Anthropic SDK Setup

## Overview

`projects/article-3/` に新しいサブプロジェクトを作成し、Article 1 の `projects/article-1/` を雛形として流用して MCP Apps の最小構成を組み立てる。最小の `ask_claude` ツール (実際には Claude API を呼ばず、hardcode した文字列を返す) が basic-host で描画できるところまでをゴールとする。**この spec では Claude API は一切叩かない** — SDK の import が通ることだけ確認し、本実装は spec-002 で行う。

## Acceptance Criteria

```gherkin
Feature: Article 3 プロジェクトの最小 MCP Apps 動作

  Background:
    Article 1 のプロジェクトが動作している、クリーンな Node.js 20 環境

  Scenario: 依存が正しくインストールされる
    Given リポジトリがクローンされている
    When 開発者が `projects/article-3/` で `npm install` を実行する
    Then `@modelcontextprotocol/sdk` / `@modelcontextprotocol/ext-apps` / `@anthropic-ai/sdk` / `react` / `react-markdown` / `vite` 等がインストールされる
    And 0 vulnerabilities で完了する

  Scenario: Anthropic SDK の import が通る
    Given プロジェクトがビルドされている
    When `server.ts` が `import Anthropic from "@anthropic-ai/sdk";` をする
    Then TypeScript コンパイルが通る
    And 実行時エラーは発生しない

  Scenario: 最小 ask_claude が basic-host で描画される
    Given MCP サーバーが起動している
    And basic-host が接続している
    When 開発者が basic-host から `ask_claude` を呼び出す
    Then iframe に最小 UI が描画される
    And ツール結果には "hello from spec-001 (placeholder)" のような hardcode テキストが入る
```

## Implementation Steps

- [x] `projects/article-1/` を雛形に `projects/article-3/` を作成 (Recharts / GitHub API / src/github.ts は除く) (2026-04-12)
- [x] `package.json` を初期化し `@modelcontextprotocol/sdk@1.29.0`, `@modelcontextprotocol/ext-apps@1.5.0`, **`@anthropic-ai/sdk@0.88.0`**, `express@5.2.1`, `cors@2.8.6`, `react@19.2.5`, `react-dom@19.2.5`, **`react-markdown@10.1.0`** をインストール (2026-04-12)
- [x] 開発依存: `typescript@6.0.2`, `tsx@4.21.0`, `vite@8.0.8`, `vite-plugin-singlefile@2.3.2`, `@vitejs/plugin-react@6.0.1`, `@types/*` をインストール (2026-04-12)
- [x] `tsconfig.json` を Article 1 から流用 (変更なし、そのまま動作、2026-04-12)
- [x] `server.ts` に最小 `ask_claude` を `registerAppTool` で登録 — zod schema で `{ question, chatgpt_answer?, model? }` を定義、handler は hardcode の placeholder 文字列 + `structuredContent` に `{ question, chatgpt_answer, claude_answer, model_used, latency_ms, placeholder: true }` を返す (2026-04-12)
- [x] `src/mcp-app.html` / `src/main.tsx` を作成 — Article 1 の `AppRouter` / `StatusBadge` パターンを流用、`AskClaudeApp` で placeholder 結果を描画 (2026-04-12)
- [x] `vite.config.ts` を Article 1 から流用 (変更なし、2026-04-12)
- [x] `ALLOWED_HOSTS` env var 対応を server.ts に入れる (Article 1 の `createMcpExpressApp` + DNS rebinding 保護回避パターンを流用、2026-04-12)
- [x] `npm run build` が通り `dist/mcp-app.html` が生成されることを確認 (313 KB / gzipped 93 KB、2026-04-12)
- [x] basic-host から `ask_claude` の hardcode 結果が描画されることをスクショで記録 (`article-3-spec-001/01-ask-claude-placeholder.png`、console エラー 0、2026-04-12)
- [x] Review (tsc EXIT=0 + chrome-devtools MCP 視覚検証、2026-04-12)

## Technical Notes

- **雛形コピー戦略**: Article 1 の `projects/article-1/` を丸ごと cp し、不要なものを削る方が早い。削るもの: `src/github.ts`、`src/components/LanguageDonut.tsx` / `StarCard.tsx` / `ContributorList.tsx`、`recharts` 依存
- **最小 `ask_claude` のシグネチャ**: spec-001 では `{ question: string }` だけで十分。spec-002 で `chatgpt_answer` / `model` を追加する
- **ANTHROPIC_API_KEY**: spec-001 段階では不要 (hardcode 返却のため)。.env.example にプレースホルダーだけ入れておく
- **UI リソース URI**: `ui://claude-second-opinion/mcp-app.html` に統一 (Article 1 の `ui://github-dashboard/mcp-app.html` と別にする)
