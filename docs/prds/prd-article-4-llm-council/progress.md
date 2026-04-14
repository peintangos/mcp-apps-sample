# Progress — Article 4: ChatGPT 主催の LLM 合議 MCP App

Use only these status values: `pending`, `in-progress`, `done`

## Specification Status

| Specification | Title | Status | Completed On | Notes |
|---------------|-------|--------|--------------|-------|
| spec-001-project-bootstrap-and-provider-abstraction | projects/article-4 bootstrap + Provider 抽象の導入 | done | 2026-04-14 | bootstrap + identity rewrite + `src/providers/{types,claude}.ts` 実装 + server.ts 差し替え + curl 実 Claude API 往復確認まで完了 |
| spec-002-gemini-provider-client | Gemini Provider Client 実装 | done | 2026-04-14 | `ProviderClient<GeminiModel>` 実装 + `.env.example` 整備 + 実 API スモーク (flash 1.7s / pro 15s) + `ask_gemini` tool 公開 + curl 疎通 + Review 完了。pro の thinking 枠問題で `DEFAULT_MAX_TOKENS` を 4096 に修正 |
| spec-003-council-orchestrator | Synthesizer 型 3 ラウンド合議オーケストレータ | in-progress | | `src/council.ts` スケルトン実装完了 (runCouncil + 型骨格 + Round 1 passthrough + Round 2 並列、2026-04-15)。残: Stance/Consensus + computeConsensus + 独立評価プロンプト + buildRevisionPrompt + start_council tool 登録 + テスト + curl E2E |
| spec-004-timeline-and-single-answer-ui | タイムライン UI + 単発応答 UI (ツール別描画分岐) | pending | | |
| spec-005-chatgpt-integration-and-deploy | ChatGPT Custom Connector 統合 + Fly.io デプロイ | pending | | |
| spec-006-zenn-article-publish | Zenn 記事執筆・レビュー・公開 | pending | | |

## Summary

- Done: 2/6
- Current focus: spec-003 — Synthesizer 型 3 ラウンド合議オーケストレータ
