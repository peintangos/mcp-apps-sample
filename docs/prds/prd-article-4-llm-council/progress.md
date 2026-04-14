# Progress — Article 4: ChatGPT 主催の LLM 合議 MCP App

Use only these status values: `pending`, `in-progress`, `done`

## Specification Status

| Specification | Title | Status | Completed On | Notes |
|---------------|-------|--------|--------------|-------|
| spec-001-project-bootstrap-and-provider-abstraction | projects/article-4 bootstrap + Provider 抽象の導入 | done | 2026-04-14 | bootstrap + identity rewrite + `src/providers/{types,claude}.ts` 実装 + server.ts 差し替え + curl 実 Claude API 往復確認まで完了 |
| spec-002-gemini-provider-client | Gemini Provider Client 実装 | in-progress | | `@google/genai` 追加 + `src/providers/gemini.ts` 実装 (2026-04-14)、残: .env.example 追記 / 実 API スモーク / `ask_gemini` tool 登録 |
| spec-003-council-orchestrator | Synthesizer 型 3 ラウンド合議オーケストレータ | pending | | |
| spec-004-timeline-and-single-answer-ui | タイムライン UI + 単発応答 UI (ツール別描画分岐) | pending | | |
| spec-005-chatgpt-integration-and-deploy | ChatGPT Custom Connector 統合 + Fly.io デプロイ | pending | | |
| spec-006-zenn-article-publish | Zenn 記事執筆・レビュー・公開 | pending | | |

## Summary

- Done: 1/6
- Current focus: spec-002 — Gemini Provider Client 実装 + `ask_gemini` ツール公開
