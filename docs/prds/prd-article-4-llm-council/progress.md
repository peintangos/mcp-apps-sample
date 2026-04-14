# Progress — Article 4: ChatGPT 主催の LLM 合議 MCP App

Use only these status values: `pending`, `in-progress`, `done`

## Specification Status

| Specification | Title | Status | Completed On | Notes |
|---------------|-------|--------|--------------|-------|
| spec-001-project-bootstrap-and-provider-abstraction | projects/article-4 bootstrap + Provider 抽象の導入 | in-progress | | 2026-04-14: rsync ベースで Article 3 から派生、MCP サーバ層の identity を Article 4 に統一。Provider 抽象導入はまだ |
| spec-002-gemini-provider-client | Gemini Provider Client 実装 | pending | | |
| spec-003-council-orchestrator | Synthesizer 型 3 ラウンド合議オーケストレータ | pending | | |
| spec-004-timeline-and-single-answer-ui | タイムライン UI + 単発応答 UI (ツール別描画分岐) | pending | | |
| spec-005-chatgpt-integration-and-deploy | ChatGPT Custom Connector 統合 + Fly.io デプロイ | pending | | |
| spec-006-zenn-article-publish | Zenn 記事執筆・レビュー・公開 | pending | | |

## Summary

- Done: 0/6
- In progress: spec-001-project-bootstrap-and-provider-abstraction (bootstrap 完了、Provider 抽象は次タスクで着手)
- Current focus: spec-001 — `src/providers/types.ts` の ProviderClient インターフェース定義
