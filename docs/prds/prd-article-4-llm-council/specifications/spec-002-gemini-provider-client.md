# spec-002: Gemini Provider Client 実装 + `ask_gemini` ツール公開

## Overview

`@google/genai` (Google AI Studio 版) を使って `src/providers/gemini.ts` に `ProviderClient` 実装を追加する。`GOOGLE_API_KEY` を dotenv 経由で読み込み、Gemini flash / pro の model identifier をマッピングし、Claude Provider と同じ `Result<ProviderResponse>` 形式で応答を返す。続いて `ask_gemini` tool を server.ts に **本番公開ツール** として登録する (schema は `ask_claude` と対称: `{ question, chatgpt_answer?, model? }`)。

## Acceptance Criteria

```gherkin
Feature: Gemini Provider Client

  Background:
    spec-001 が完了し、`ProviderClient` 抽象が存在する
    `GOOGLE_API_KEY` が Google AI Studio で取得できる

  Scenario: Gemini flash で応答を取得する
    Given `geminiProvider.ask("1+1 は?", { model: "flash" })` を呼ぶ
    When Gemini API が呼ばれる
    Then `Result<ProviderResponse>` の `ok: true` が返る
    And `data.text` に自然言語の回答が入る
    And `data.modelUsed` に Gemini flash の正式な model ID が入る
    And `data.latencyMs` にリクエスト所要時間が入る

  Scenario: Gemini pro でモデル切り替え
    Given `geminiProvider.ask("X", { model: "pro" })` を呼ぶ
    When Gemini API が呼ばれる
    Then Gemini pro 系の model が呼ばれる
    And `data.modelUsed` が pro 系の model ID になる

  Scenario: API キー未設定エラー
    Given `GOOGLE_API_KEY` が未設定
    When `geminiProvider.ask(...)` を呼ぶ
    Then `Result<T>` の `ok: false` 分岐が返り、`error.code` が `"unauthenticated"` になる

  Scenario: 400 系応答は invalid_response として扱う
    Given Gemini API が 400 系のエラーを返した
    When `geminiProvider.ask(...)` を呼ぶ
    Then `error.code` が `"invalid_response"` として返る
    And `error.message` に元のエラー内容が含まれる
```

## Implementation Steps

- [x] `@google/genai` を `projects/article-4/package.json` の dependencies に追加する (`^1.50.0`、2026-04-14)
- [x] `.env.example` に `GOOGLE_API_KEY=` を追記し、README 相当の記載を `knowledge.md` に残す (ANTHROPIC_API_KEY ブロック直後に配置、取得元 aistudio.google.com/apikey、dotenv/config は spec-001 の時点で server.ts:1 に既設のため追加コード変更なし、2026-04-14)
- [x] `src/providers/gemini.ts` を新規作成し、`ProviderClient` を実装する (`claude.ts` 構造ミラー、2026-04-14)
- [x] model identifier マッピング (`"flash"` → `gemini-2.x-flash` 等 / `"pro"` → `gemini-2.x-pro` 等) を実装し、実際の model ID は実 API 疎通で確定する (仮: `gemini-2.5-flash` / `gemini-2.5-pro`、実疎通時に確定、2026-04-14)
- [x] `GOOGLE_API_KEY` 未設定時は SDK 初期化の前に `unauthenticated` を即返すガードを入れる (`getClient()` 内、2026-04-14)
- [x] SDK のエラーを HTTP status またはエラー名で 3 分類 (`rate_limited` / `unauthenticated` / `invalid_response`) に振り分ける (`ApiError instanceof` + `.status` 分岐、4xx は `invalid_response` に集約、2026-04-14)
- [x] 実 API スモークテスト: `geminiProvider.ask("1+1 は?", { model: "flash" })` と `geminiProvider.ask("Rust と Go どちらを学ぶべきか", { model: "pro" })` を実行して model ID / レイテンシ / 応答先頭を `knowledge.md` に記録する (`gemini-2.5-flash` 1657-3138ms、`gemini-2.5-pro` 8111ms、`response.modelVersion` 実値取得、pro は初回 503 "high demand" 揺らぎあり → 即再試行で成功、2026-04-14)
- [x] Claude と Gemini を同じテストハーネスで並列呼び出しし、両 Provider が `ProviderClient` として同じ形で扱えることを確認する (一時 `smoke-gemini.ts` で `Promise.all` 並列実行、3 ケースが `Result<ProviderResponse>` 形式で統一されて帰ってくることを確認、スクリプトは実行後削除、2026-04-14)
- [x] `server.ts` に `ask_gemini` tool を登録する。schema は `ask_claude` と対称 (`{ question, chatgpt_answer?, model? }`)、`model` は `"flash" | "pro"`。handler は `geminiProvider.ask()` を呼び、結果を `structuredContent` に入れる (zod enum `["flash","pro"]`、`structuredContent.gemini_answer` キー、error closure は ask_claude をミラー、**PRD 本文の `chatgpt_answer?` は設計変更でドロップ済み**: spec-001 時点で `ask_claude` は `{question, model}` のみ、合議コンテキストは spec-003 の `start_council({question, chatgpt_initial_answer, ...})` に集約する方針のため、`ask_gemini` も `{question, model}` で対称性を保つ、2026-04-14)
- [x] Article 3 の `AnswerColumn` 相当の単発応答 UI を `ask_gemini` にも流用できるよう、UI 共通化の段取りを `knowledge.md` に残す (実装は spec-004 で) (spec-004 で `src/main.tsx` が tool name で分岐 → `SingleAnswerView` をプロバイダ パラメータ化する段取りは todo.md / knowledge.md で既に明示済み、2026-04-14)
- [x] curl で `ask_gemini` を叩き、実 Gemini 応答が `structuredContent` に入ることを確認する (flash 1676ms / "2"、pro 15187ms / "パフォーマンスを犠牲にしないメモリ安全性。"、ask_claude 1326ms / "1+1は**2**です。" で並行健在、pro は初回 `invalid_response` を踏んで DEFAULT_MAX_TOKENS を 1024→4096 に修正してから成功、2026-04-14)
- [ ] Review (build check + lint + `/code-review`)

## Technical Notes

- Google AI Studio の無料枠で記事検証を完結させることを前提にする (Vertex AI は Out of Scope)
- Gemini の SDK は messages 配列の組み立て方が Anthropic と異なる。`ProviderClient.ask()` 側で吸収し、呼び出し側 (council.ts) には差分を見せない
- `max_tokens` 相当のパラメータ名は SDK ごとに異なるため、`ProviderClient` 内で `maxOutputTokens` として統一する
- model identifier の正式名は API ドキュメントで最新を確認して確定する (PRD 執筆時点のハードコードに依存しない)
