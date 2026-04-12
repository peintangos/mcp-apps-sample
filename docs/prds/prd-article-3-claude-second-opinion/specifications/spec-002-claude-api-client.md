# spec-002: Claude API Client and ask_claude Tool

## Overview

`src/claude.ts` に Anthropic SDK をラップした薄いクライアントを実装し、`ask_claude` ツール handler に接続する。tool の input schema を `{ question, chatgpt_answer?, model? }` に拡張し、`structuredContent` に `{ question, chatgpt_answer, claude_answer, model_used, latency_ms }` を返すようにする。エラー (rate limit / 401 / network) は `Result<T>` 型で構造化する (Article 1 の `github.ts` と同じパターン)。

## Acceptance Criteria

```gherkin
Feature: Claude API 統合

  Background:
    spec-001 のプロジェクトが動いており、ANTHROPIC_API_KEY が設定済み

  Scenario: シンプルな質問への回答取得
    Given ユーザーが `{ question: "1+1 は?" }` を渡す
    When ツールが呼び出される
    Then Claude API が呼ばれる
    And `structuredContent.claude_answer` に自然言語の回答が入る
    And `structuredContent.model_used` には実際に使われたモデル名が入る
    And `structuredContent.latency_ms` にリクエスト所要時間が入る

  Scenario: モデル選択
    Given ユーザーが `{ question: "X", model: "opus" }` を渡す
    When ツールが呼び出される
    Then Claude Opus が呼ばれる
    And `structuredContent.model_used` が `claude-opus-4-6` などの Opus 系モデル名になる

  Scenario: chatgpt_answer を受け取る
    Given ChatGPT が `{ question: "X", chatgpt_answer: "...", model: "sonnet" }` を渡す
    When ツールが呼び出される
    Then `structuredContent.chatgpt_answer` にそのまま値が入る
    And Claude への prompt には "ChatGPT はこう答えました: ..." というコンテキストが含まれる (任意: オプション)

  Scenario: API キー未設定エラー
    Given `ANTHROPIC_API_KEY` が未設定
    When ツールが呼び出される
    Then `isError: true` + `structuredContent.error: { code: "unauthenticated", message: "..." }` が返る

  Scenario: rate limit エラー
    Given Claude API が 429 を返した
    When ツールが呼び出される
    Then `isError: true` + `structuredContent.error: { code: "rate_limited", message: "...", resetAt: "..." }` が返る
```

## Implementation Steps

- [x] `src/claude.ts` に `askClaude(question, { model }): Promise<Result<{ text, modelUsed, latencyMs }>>` を実装 (2026-04-12)
- [x] `@anthropic-ai/sdk@0.88.0` の `Anthropic` クライアントを遅延初期化 (`process.env.ANTHROPIC_API_KEY` を読む、キャッシュ済み、2026-04-12)
- [x] モデル識別子のマッピング: `"sonnet"` → `"claude-sonnet-4-6"`, `"opus"` → `"claude-opus-4-6"` (2026-04-12)
- [x] `Result<T>` 型定義 (`{ ok: true; data } | { ok: false; error: AskClaudeError }`) (2026-04-12)
- [x] エラー型 `AskClaudeError = { code: "unauthenticated" | "rate_limited" | "network_error" | "invalid_response"; message; resetAt? }` を定義、401/403/429 を HTTP status で判別 (2026-04-12)
- [x] `ask_claude` ツールの zod schema は spec-001 で既に `{ question, chatgpt_answer?, model? }` 形式 — 調整不要 (2026-04-12)
- [x] tool handler を `askClaude` 呼び出しに差し替え、`content` に Claude の回答、`structuredContent` に `{ question, chatgpt_answer, claude_answer, model_used, latency_ms }` を返す (`placeholder` フラグ削除、2026-04-12)
- [x] **実 API スモークテスト**: `askClaude("1+1 は?", { model: "sonnet" })` → `claude-sonnet-4-6`, 1591ms で "1+1は**2**です。" を取得、`askClaude("Rust と Go どちらを学ぶべきか", { model: "opus" })` → `claude-opus-4-6`, 5911ms で構造化回答を取得 (2026-04-12)
- [x] **curl 経由のサーバー側 E2E**: `ask_claude` ツール呼び出しで実 Claude 応答が `structuredContent.claude_answer` に入ることを確認、`chatgpt_answer` も正しく保持 (2026-04-12)
- [x] dotenv 経由で `.env` から `ANTHROPIC_API_KEY` を読み込む構成を採用 — `import "dotenv/config"` を server.ts の先頭に追加、`.env.example` と `.env` を作成 (`.env` は gitignore 済み) (2026-04-12)
- [x] `knowledge.md` に Claude API 実呼び出しの実測値 (sonnet 1.5s / opus 6s、model ID、rate limit reset header 候補) を記録 (2026-04-12)
- [x] Review (tsc EXIT=0、実 API 往復 3 種すべて成功、Article 1 の Result 型 pattern と一貫性、2026-04-12)

## Technical Notes

- **モデル識別子** (2026-04-12 時点):
  - `"sonnet"` → `"claude-sonnet-4-6"` (高速・コスパ良)
  - `"opus"` → `"claude-opus-4-6"` (最高性能)
  - デフォルトは `sonnet` で十分。記事でも sonnet を中心に紹介
- **`chatgpt_answer` の扱い**: オプション。存在する場合は Claude への system prompt に "Context: the user already got this answer from another model: {chatgpt_answer}. Compare or supplement it." のような指示を入れてもよい。入れない選択 (Claude は白紙で答える) の方が公平性は高い。**記事では両方の選択肢とトレードオフを説明**
- **Rate limit ヘッダ**: Anthropic API は `anthropic-ratelimit-requests-reset` などのヘッダで reset time を返す。これを `resetAt` に詰めて UI に見せる
- **max_tokens**: spec-002 では 1024 で十分。spec-003 で UI 幅に合わせて調整可能
- **未解決事項**: ストリーミング対応は Out of Scope。`stream: false` の Messages API を使う
