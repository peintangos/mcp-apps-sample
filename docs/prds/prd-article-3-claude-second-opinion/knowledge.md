# Knowledge — Article 3: ChatGPT × Claude Second Opinion MCP App

## Reusable Patterns

<!-- Document patterns that should be reused in later tasks or later PRDs. -->

## Integration Notes

<!-- Capture cross-cutting behavior, dependencies, or setup details that are easy to forget. -->

- **Article 1 の構成 (`projects/article-1/`) をコピーベースに開始する**: server.ts / src/main.tsx / tsconfig.json / vite.config.ts の雛形が流用できる。Recharts と GitHub API 関連のみ削除し、Anthropic SDK に差し替える
- **Article 1 の ThemeContext / ColorPalette / useColors をそのまま流用**: Light / Dark 追従のパターンはすでに確立済み

## Gotchas

<!-- Document pitfalls, edge cases, or failure modes. -->

- **Claude Max サブスクでは Claude API キーは別契約**: 月額の Max プランと Claude API (従量課金) は別会計。記事読者が誤解しないよう明記
- **ChatGPT の MCP Apps 実装は制約あり**: 2026-04 時点で UI からのツール再呼び出しは一部未対応とされる (Article 1 の gemini.md 参照)。`ask_claude` が初回ツール呼び出しで完結する設計にするのが安全
- **`@anthropic-ai/sdk` の model 識別子**: `claude-sonnet-4-6` / `claude-opus-4-6` のようなバージョン付きが推奨。aliases は互換維持用で本番では specific name を pin する
- **Anthropic API の rate limit エラー**: 429 で返る。`anthropic-ratelimit-*` ヘッダでリセット時間を取得できるので、`Result<T>` の rate_limited エラーに詰めて UI に返す

## Testing Notes

<!-- Record durable testing patterns, not one-off execution logs. -->

- **実 API を叩くスモークテスト**: `ANTHROPIC_API_KEY` を env にセットして、`askClaude("1+1 は?", { model: "sonnet" })` で通ることを `tsx -e` で検証。これは Article 1 の GitHub API スモークと同じパターン

## Article Publication Record

<!-- Record the Zenn article URL once published, plus any post-publication feedback. -->
