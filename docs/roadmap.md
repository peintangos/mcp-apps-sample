# Roadmap

Use this document for repo-level direction. Detailed execution status belongs in each PRD's `progress.md`.

## Current Focus

- Keep the repository reusable as an OSS template
- Stabilize the contract between Claude Code, Ralph Loop, and GitHub Actions
- Make setup and documentation clearer for adopters

## Active PRDs

This repository (`mcp-apps-sample`) hosts MCP Apps demo projects that back a Zenn article series.

| PRD | Title | Status | Target Window |
|-----|-------|--------|----------------|
| [`prd-article-1-github-dashboard`](./prds/prd-article-1-github-dashboard/prd.md) | Article 1 — GitHub Dashboard MCP App + Zenn Article | in planning | 2026-04 to 2026-05 |
| [`prd-article-2-langgraph-sql`](./prds/prd-article-2-langgraph-sql/prd.md) | Article 2 — LangGraph × MCP Apps × Human-in-the-loop SQL approval | planned (starts after Article 1) | 2026-05 to 2026-06 |

Planned article series:

1. **Article 1 — MCP Apps 入門**: 初見読者向け。Claude Desktop 内で自作 GitHub 分析ダッシュボードを動かすまで
2. **Article 2 — LangGraph × MCP Apps**: LangGraph 経験者向け。自作ホスト + OpenRouter + LangSmith で副作用承認エージェントを作る

## Future Ideas

- 他フレームワーク (Vue / Svelte / Solid) 版のデモ実装
- Claude Desktop 以外のホスト (ChatGPT / VS Code Copilot / Goose) での動作検証記事
- CSP / CORS のハマりどころに特化した独立記事
- MCP Apps の `updateModelContext` を深掘りする記事
