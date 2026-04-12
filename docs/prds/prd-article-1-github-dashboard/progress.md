# Progress — Article 1: GitHub Dashboard MCP App

Use only these status values: `pending`, `in-progress`, `done`

## Specification Status

| Specification | Title | Status | Completed On | Notes |
|---------------|-------|--------|--------------|-------|
| spec-001-project-bootstrap | Project Bootstrap and Minimal MCP App | done | 2026-04-12 | basic-host から `hello_time` 呼び出しまで End-to-End 検証、スクショ 3 枚保存、console エラー 0 |
| spec-002-github-analyze-tool | GitHub Analyze Repo Tool | done | 2026-04-12 | `server.ts` に `analyze_repo` 登録、facebook/react で 244k stars を取得・構造化、404 系も isError で返る |
| spec-003-dashboard-ui | React Dashboard UI Resource | done | 2026-04-12 | Recharts ダッシュボード + ThemeContext による light/dark 追従完了、basic-host で両テーマ視覚検証済み |
| spec-004-claude-desktop-integration | Claude Desktop Integration and CSP | done | 2026-04-12 | Claude.ai で analyze_repo を実行、ハッシュサブドメイン経由で iframe ダッシュボードが描画、記事のヒーローショット取得済み |
| spec-005-zenn-article-publish | Zenn Article Draft and Publish | pending | | |

## Summary

- Done: 4/5
- Current focus: spec-005-zenn-article-publish
