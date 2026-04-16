# Progress — Article 4: ChatGPT 主催の LLM 合議 MCP App

Use only these status values: `pending`, `in-progress`, `done`

## Specification Status

| Specification | Title | Status | Completed On | Notes |
|---------------|-------|--------|--------------|-------|
| spec-001-project-bootstrap-and-provider-abstraction | projects/article-4 bootstrap + Provider 抽象の導入 | done | 2026-04-14 | bootstrap + identity rewrite + `src/providers/{types,claude}.ts` 実装 + server.ts 差し替え + curl 実 Claude API 往復確認まで完了 |
| spec-002-gemini-provider-client | Gemini Provider Client 実装 | done | 2026-04-14 | `ProviderClient<GeminiModel>` 実装 + `.env.example` 整備 + 実 API スモーク (flash 1.7s / pro 15s) + `ask_gemini` tool 公開 + curl 疎通 + Review 完了。pro の thinking 枠問題で `DEFAULT_MAX_TOKENS` を 4096 に修正 |
| spec-003-council-orchestrator | Synthesizer 型 3 ラウンド合議オーケストレータ | done | 2026-04-16 | `ask_claude` / `ask_gemini` / `start_council` の 3 ツール構成を維持したまま合議オーケストレータを完了。Round 2 全失敗時も `structuredContent.error` に要約を返すよう補強し、`npm test` / article-4 vitest 26件 / `npm run build` / code-review まで完了 |
| spec-004-timeline-and-single-answer-ui | タイムライン UI + 単発応答 UI (ツール別描画分岐) | done | 2026-04-16 | ui-router + SingleAnswerView (spec-004 前半) + ConsensusBadge / SpeakerCard / RoundTimeline / RevisionFooter の 4 部品実装 + PreviewGallery (#preview モード) + theme.ts 切り出し。tsc ✅ / vite build 492KB ✅ / vitest 39 pass ✅ / code-review 完了 |
| spec-005-chatgpt-integration-and-deploy | ChatGPT Custom Connector 統合 + Fly.io デプロイ | in-progress | | OAuth / Fly.io の identity rewrite を完了。`src/oauth.ts` の fixed client id と consent branding、`fly.toml` の app/issuer/allowed_hosts を Article 4 に更新し、`src/oauth.test.ts` で回帰防止。残りは secrets 設定・Fly deploy・ChatGPT 実機確認 |
| spec-006-zenn-article-publish | Zenn 記事執筆・レビュー・公開 | pending | | |

## Summary

- Done: 4/6
- Current focus: spec-005 — ChatGPT Custom Connector 統合 + Fly.io デプロイ
