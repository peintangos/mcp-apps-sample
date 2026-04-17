# Progress — Article 4: ChatGPT 主催の LLM 合議 MCP App

Use only these status values: `pending`, `in-progress`, `done`

## Specification Status

| Specification | Title | Status | Completed On | Notes |
|---------------|-------|--------|--------------|-------|
| spec-001-project-bootstrap-and-provider-abstraction | projects/article-4 bootstrap + Provider 抽象の導入 | done | 2026-04-14 | bootstrap + identity rewrite + `src/providers/{types,claude}.ts` 実装 + server.ts 差し替え + curl 実 Claude API 往復確認まで完了 |
| spec-002-gemini-provider-client | Gemini Provider Client 実装 | done | 2026-04-14 | `ProviderClient<GeminiModel>` 実装 + `.env.example` 整備 + 実 API スモーク (flash 1.7s / pro 15s) + `ask_gemini` tool 公開 + curl 疎通 + Review 完了。pro の thinking 枠問題で `DEFAULT_MAX_TOKENS` を 4096 に修正 |
| spec-003-council-orchestrator | 擬似合議型 Round 1-2 オーケストレータ | done | 2026-04-17 | 初版 (2026-04-16) は Synthesizer 型で done としたが、anchoring 回避のため 2026-04-17 に擬似合議型 (Round 1 = 3 者独立 / Round 2 = 相互参照 stance) に再設計。`runCouncil` / `buildRound2Prompt` / `buildRevisionPrompt` を書き直し、council 層固有の `CouncilSpeakerError` と `round1_failed` code を追加、`start_council` tool descriptor も擬似合議型に追従。council.test.ts を 29 cases に拡張 (Round 1 failure → Round 2 skip の検証含む)。tsc ✅ / vitest 29 council tests 全 44 tests ✅ / vite build ✅ |
| spec-004-timeline-and-single-answer-ui | タイムライン UI + 単発応答 UI (ツール別描画分岐) | done | 2026-04-17 | 初版 (2026-04-16) で ui-router + SingleAnswerView + ConsensusBadge / SpeakerCard / RoundTimeline / RevisionFooter + PreviewGallery + theme.ts を完了。2026-04-17 に擬似合議型追従として `RoundTimeline` の Round 1 を 3 カラム responsive 描画 + SkeletonCard 3 枚に拡張し、`preview-gallery.tsx` の 4 mock data を 3 者 Round 1 構成に書き換え、MOCK_PARTIAL_FAILURE を Round 1 fail → Round 2 round1_failed skip パターンに変更。tsc ✅ / vite build 494KB ✅ / vitest 44 pass ✅ |
| spec-005-chatgpt-integration-and-deploy | ChatGPT Custom Connector 統合 + Fly.io デプロイ | in-progress | | OAuth / Fly.io の identity rewrite を完了。`src/oauth.ts` の fixed client id と consent branding、`fly.toml` の app/issuer/allowed_hosts を Article 4 に更新し、`src/oauth.test.ts` で回帰防止。2026-04-17 に demo rate limiting (token 毎時 20 / global 日次 200) + ChatGPT OAuth callback の Accept header 正規化 + DEMO_MODE モデル強制を追加。残りは secrets 設定・Fly deploy・ChatGPT 実機確認 |
| spec-006-zenn-article-publish | Zenn 記事執筆・レビュー・公開 | pending | | |

## Summary

- Done: 4/6
- Current focus: spec-005 — ChatGPT Custom Connector 統合 + Fly.io デプロイ
