# spec-001: projects/article-4 bootstrap + Provider 抽象の導入

## Overview

`projects/article-4/` を Article 3 の構成から派生して新規に立ち上げ、`src/providers/{types,claude}.ts` の薄い抽象を導入する。Article 3 の `src/claude.ts` に相当するロジックを、新しい `ProviderClient` インターフェース実装として移植する。この spec の完了時点で、Article 4 プロジェクトは `ask_claude` ツールを **本番公開ツールとして** 登録済み (Article 3 と同じ UX で動作)、`ask_gemini` / `start_council` は spec-002 / spec-003 で追加する。

## Acceptance Criteria

```gherkin
Feature: Article 4 プロジェクトの土台と Provider 抽象

  Background:
    Article 3 の `projects/article-3/` が動作している
    Node.js 20 LTS と npm が利用可能

  Scenario: プロジェクトが単独で起動する
    Given `projects/article-4/` に Article 3 由来の構成がコピーされている
    When `npm install` と `npm run build` を実行する
    Then ビルドが成功し `dist/` に成果物が生成される
    And `projects/article-3/` には一切影響を与えない

  Scenario: Provider 抽象を経由して Claude が呼べる
    Given `src/providers/types.ts` に `ProviderClient` インターフェースが定義されている
    And `src/providers/claude.ts` が `ProviderClient` を実装している
    When 任意の呼び出し元が `claudeProvider.ask(question, { model: "sonnet" })` を呼ぶ
    Then `Result<ProviderResponse>` が返り、`ok: true` のとき `text / modelUsed / latencyMs` が入る
    And Article 3 と同じ `ANTHROPIC_API_KEY` で実 API 応答が取得できる

  Scenario: エラー型が抽象側に統一されている
    Given `ANTHROPIC_API_KEY` が未設定
    When `claudeProvider.ask(...)` を呼ぶ
    Then `Result<T>` の `ok: false` 分岐が返り、`error.code` が `"unauthenticated"` になる
    And このエラー型は provider 固有ではなく `ProviderError` として共通化されている
```

## Implementation Steps

- [x] `projects/article-4/` ディレクトリを作り、Article 3 から `package.json` / `tsconfig.json` / `vite.config.ts` / `server.ts` / `src/main.tsx` / `src/components/` / `src/mcp-app.html` / `.env.example` / `Dockerfile` / `fly.toml` / `src/oauth.ts` / `src/claude.ts` / `.dockerignore` / `package-lock.json` を `rsync` で一括コピーした (`node_modules` / `dist` / `.env` を除外、2026-04-14)
- [x] `projects/article-4/package.json` の `name` を `article-4-llm-council`、`description` を Article 4 向けに書き換え (2026-04-14)
- [x] `tsconfig.json` と `vite.config.ts` は path-relative で Article 識別子を含まないため書き換え不要と判定 (2026-04-14)
- [x] **Article 4 identity の MCP サーバ層書き換え** (task 本文の "package.json / tsconfig.json / vite.config.ts" に加えて identity 整合性のため拡張実施): `server.ts` の `UI_RESOURCE_URI` を `ui://llm-council/mcp-app.html`、`McpServer.name` を `article-4-llm-council`、`registerAppResource` のタイトル / 説明、4 箇所のログ prefix `[article-3]` を `[article-4]` に、`src/main.tsx` の `useApp.appInfo.name` と Header フッターを Article 4 に、`.env.example` のヘッダと Fly.io URL 例 2 件と spec-006 → spec-005 参照を更新 (2026-04-14)
- [x] **デプロイ層は意図的に未着手**: `fly.toml` (app name / OAuth issuer / allowed_hosts の 5 行) と `src/oauth.ts` (`FIXED_CLIENT_ID = "article-3-mcp-client"`) は Fly.io app 名と OAuth client 登録が一体で、本番 Fly.io / ChatGPT 連携と合わせて扱うべきため spec-005 で書き換える (2026-04-14)
- [x] `npm install` で 246 packages / 0 vulnerabilities、`npm run build` で `dist/mcp-app.html` 473.85 kB (gzip 140.46 kB) 生成を確認、`npx tsc --noEmit` もエラーなし (2026-04-14)
- [ ] `src/providers/types.ts` を新規作成し、`Result<T>`, `ProviderError`, `ProviderClient`, `ProviderResponse` 型を定義する
- [ ] `src/providers/claude.ts` を新規作成し、Article 3 の `src/claude.ts` のロジックを `ProviderClient` 実装として移植する (model identifier マッピング・401/429 判別・latency 計測を引き継ぐ)
- [ ] `server.ts` の `ask_claude` tool handler を `claudeProvider.ask()` 経由に書き換え、**本番公開ツール** として登録する (Article 3 と同じ `{ question, chatgpt_answer?, model? }` schema を維持)
- [ ] `npm install` + `npm run build` が成功することを確認する
- [ ] curl で `ask_claude` を叩き、実 Claude 応答が Article 3 と同等に取れることを確認する
- [ ] Article 3 の progress.md / knowledge.md / server.ts に一切影響を与えていないことを `git status` で確認する
- [ ] `knowledge.md` に Provider 抽象の採用理由と Article 3 との差分を記録する
- [ ] Review (build check + lint + `/code-review`)

## Technical Notes

- `src/providers/types.ts` は依存ゼロに保つ。各 provider 実装側が SDK をインポートする
- Article 3 の `src/claude.ts` は残したまま (Article 3 は凍結)。Article 4 は完全コピーから始めて Article 3 との結合は持たない
- Article 3 の OAuth 2.1 (`src/oauth.ts`) と `fly.toml` も spec-005 で再利用する前提でコピーしておく
