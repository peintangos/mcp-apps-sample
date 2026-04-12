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

- [ ] `projects/article-1/` を雛形に `projects/article-3/` を作成 (Recharts / GitHub API / src/github.ts は除く)
- [ ] `package.json` を初期化し `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, `@anthropic-ai/sdk`, `express`, `cors`, `react`, `react-dom`, `react-markdown` をインストール
- [ ] 開発依存: `typescript`, `tsx`, `vite`, `vite-plugin-singlefile`, `@vitejs/plugin-react`, `@types/*` をインストール
- [ ] `tsconfig.json` を Article 1 から流用 (変更不要のはず)
- [ ] `server.ts` に最小 `ask_claude` (hardcode 文字列を返す) を `registerAppTool` で登録
- [ ] `src/mcp-app.html` / `src/main.tsx` を Article 1 から最小構成にして流用、`AnalyzeRepoResult` 依存を削除
- [ ] `vite.config.ts` を Article 1 から流用
- [ ] `ALLOWED_HOSTS` env var 対応を server.ts に入れる (Article 1 から流用)
- [ ] `npm run build` が通り `dist/mcp-app.html` が生成されることを確認
- [ ] basic-host から `ask_claude` の hardcode 結果が描画されることをスクショで記録
- [ ] Review (tsc 通過 + `/code-review`)

## Technical Notes

- **雛形コピー戦略**: Article 1 の `projects/article-1/` を丸ごと cp し、不要なものを削る方が早い。削るもの: `src/github.ts`、`src/components/LanguageDonut.tsx` / `StarCard.tsx` / `ContributorList.tsx`、`recharts` 依存
- **最小 `ask_claude` のシグネチャ**: spec-001 では `{ question: string }` だけで十分。spec-002 で `chatgpt_answer` / `model` を追加する
- **ANTHROPIC_API_KEY**: spec-001 段階では不要 (hardcode 返却のため)。.env.example にプレースホルダーだけ入れておく
- **UI リソース URI**: `ui://claude-second-opinion/mcp-app.html` に統一 (Article 1 の `ui://github-dashboard/mcp-app.html` と別にする)
