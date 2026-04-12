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
| [`prd-article-1-github-dashboard`](./prds/prd-article-1-github-dashboard/prd.md) | Article 1 — GitHub Dashboard MCP App + Zenn Article | draft 完成、公開待ち | 2026-04 to 2026-05 |
| [`prd-article-2-langgraph-sql`](./prds/prd-article-2-langgraph-sql/prd.md) | Article 2 — LangGraph × MCP Apps × Human-in-the-loop SQL approval | planned (Article 1 公開後に着手) | 2026-05 to 2026-06 |
| [`prd-article-3-claude-second-opinion`](./prds/prd-article-3-claude-second-opinion/prd.md) | Article 3 — ChatGPT × Claude Second Opinion MCP App | planned (Article 1 公開後に着手、Article 2 と並行可) | 2026-07 to 2026-08 |

Planned article series:

1. **Article 1 — MCP Apps 入門**: 初見読者向け。Claude Desktop 内で自作 GitHub 分析ダッシュボードを動かすまで
2. **Article 2 — LangGraph × MCP Apps**: LangGraph 経験者向け。自作ホスト + OpenRouter + LangSmith で副作用承認エージェントを作る
3. **Article 3 — ChatGPT × Claude Second Opinion**: "LLM どうしの越境" をテーマに、ChatGPT の中で `ask_claude` ツールを呼んで Claude と ChatGPT の回答を side-by-side 比較する MCP App を作る

## Future Ideas

- 他フレームワーク (Vue / Svelte / Solid) 版のデモ実装
- Claude Desktop 以外のホスト (ChatGPT / VS Code Copilot / Goose) での動作検証記事
- CSP / CORS のハマりどころに特化した独立記事
- MCP Apps の `updateModelContext` を深掘りする記事
