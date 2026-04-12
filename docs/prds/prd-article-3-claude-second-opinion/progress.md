# Progress — Article 3: ChatGPT × Claude Second Opinion MCP App

Use only these status values: `pending`, `in-progress`, `done`

## Specification Status

| Specification | Title | Status | Completed On | Notes |
|---------------|-------|--------|--------------|-------|
| spec-001-project-bootstrap | Project Bootstrap and Anthropic SDK Setup | done | 2026-04-12 | Article 1 パターン流用で雛形+依存+最小 ask_claude+UI+basic-host 検証まで 1 イテレーションで完走 |
| spec-002-claude-api-client | Claude API Client and ask_claude Tool | done | 2026-04-12 | `src/claude.ts` + Result 型 + dotenv で `.env` 読み込み、sonnet/opus 両方で実 API 往復成功、curl E2E 検証済み |
| spec-003-comparison-ui | Side-by-Side Comparison UI | done | 2026-04-12 | ChatGPT 列 + Claude 列 + react-markdown + ThemeContext、basic-host で light/dark 両テーマ視覚検証済み、gzip 129KB |
| spec-004-chatgpt-integration | ChatGPT Custom Connector Integration | pending | | |
| spec-005-zenn-article-publish | Zenn Article Draft and Publish | in-progress | | ドラフト執筆完了 (`articles/mcp-apps-github-dashboard.md`)、OAuth セクション追記と画像配置と公開は spec-006 完了後 |
| spec-006-oauth-cloud-deploy | OAuth 2.1 Authorization Server and Fly.io Deployment | pending | | spec-005 公開より前に実装、2段構えガードレール (OAuth + Anthropic spend cap) |

## Summary

- Done: 3/6
- Current focus: spec-006-oauth-cloud-deploy (OAuth 2.1 自前実装 + Fly.io デプロイ)、その後に spec-005 公開
