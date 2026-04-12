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

- [ ] `src/claude.ts` に `askClaude(question, { model, chatgpt_answer }): Promise<Result<{ text, modelUsed, latencyMs }>>` を実装
- [ ] `@anthropic-ai/sdk` の `Anthropic` クライアントを遅延初期化 (process.env.ANTHROPIC_API_KEY を読む)
- [ ] モデル識別子のマッピング: `"sonnet"` → `"claude-sonnet-4-6"`, `"opus"` → `"claude-opus-4-6"` (2026-04 時点の最新 stable を pin)
- [ ] `Result<T>` 型定義 (`{ ok: true; data } | { ok: false; error: AskClaudeError }`)
- [ ] エラー型 `AskClaudeError = { code: "unauthenticated" | "rate_limited" | "network_error" | "invalid_response"; message; resetAt? }`
- [ ] `ask_claude` ツールを zod スキーマで再定義: `{ question: z.string(), chatgpt_answer: z.string().optional(), model: z.enum(["sonnet", "opus"]).optional() }`
- [ ] tool handler を `askClaude` 呼び出しに差し替え、`content` に要約テキスト、`structuredContent` に完全データを返す
- [ ] 実 API スモークテスト: `ANTHROPIC_API_KEY` セット下で `npx tsx -e '...'` スクリプトで sonnet と opus の両方を確認
- [ ] 失敗系スモーク: `ANTHROPIC_API_KEY` を空にして `unauthenticated` エラー、無効な API キーで 401 系確認
- [ ] `knowledge.md` に rate limit の reset ヘッダ名や response shape を記録
- [ ] Review (`pytest` 相当のテスト不要、スモークパス + `/code-review`)

## Technical Notes

- **モデル識別子** (2026-04-12 時点):
  - `"sonnet"` → `"claude-sonnet-4-6"` (高速・コスパ良)
  - `"opus"` → `"claude-opus-4-6"` (最高性能)
  - デフォルトは `sonnet` で十分。記事でも sonnet を中心に紹介
- **`chatgpt_answer` の扱い**: オプション。存在する場合は Claude への system prompt に "Context: the user already got this answer from another model: {chatgpt_answer}. Compare or supplement it." のような指示を入れてもよい。入れない選択 (Claude は白紙で答える) の方が公平性は高い。**記事では両方の選択肢とトレードオフを説明**
- **Rate limit ヘッダ**: Anthropic API は `anthropic-ratelimit-requests-reset` などのヘッダで reset time を返す。これを `resetAt` に詰めて UI に見せる
- **max_tokens**: spec-002 では 1024 で十分。spec-003 で UI 幅に合わせて調整可能
- **未解決事項**: ストリーミング対応は Out of Scope。`stream: false` の Messages API を使う
