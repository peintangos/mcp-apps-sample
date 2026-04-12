# Glossary

| Term | Definition | Context | Aliases |
|------|-----------|---------|---------|
| PRD | Product Requirements Document. Defines the delivery scope for a feature or project | Planning phase, `docs/prds/` | — |
| Ralph Loop | Autonomous headless execution workflow that processes one todo task per iteration | `scripts/ralph/`, GitHub Actions | — |
| Specification | A Gherkin-oriented feature spec with acceptance criteria and implementation steps | `docs/prds/prd-{slug}/specifications/` | spec |
| Knowledge | Reusable patterns, integration notes, and non-obvious lessons discovered during work | `docs/prds/prd-{slug}/knowledge.md` | — |
| Command Registry | The canonical mapping of role names to repository-specific commands | `ralph.toml` | — |
| Docs-first | The core principle: planning updates documents, execution reads documents | Project-wide | — |
| MCP Apps | The first official MCP extension (SEP-1865, stable as of 2026-01-26). Lets MCP servers deliver interactive HTML UIs to hosts such as Claude and ChatGPT | `docs/references/MCP Apps/`, `docs/prds/prd-article-1-*` | `io.modelcontextprotocol/ui` |
| UI Resource | An MCP resource served under the `ui://` scheme with MIME type `text/html;profile=mcp-app`. Referenced from tool definitions via `_meta.ui.resourceUri` | MCP Apps servers | — |
| MCP Apps Host | A client that renders UI Resources inside sandboxed iframes and bridges `postMessage` JSON-RPC between the UI and the MCP server | Claude Desktop, basic-host, Article 2 custom host | host |
| basic-host | The official reference MCP Apps host bundled with `modelcontextprotocol/ext-apps`, used for local development and debugging | `ext-apps/examples/basic-host` | — |
| Zenn Article | The primary external deliverable of each Article PRD; the demo exists to anchor the article in runnable code | `docs/prds/prd-article-*` | article |
| Second Opinion Pattern | The cross-vendor LLM collaboration pattern where one LLM (e.g. ChatGPT) invokes an MCP tool that internally calls another LLM (e.g. Claude) and renders both answers side-by-side via MCP Apps | `docs/prds/prd-article-3-*` | cross-vendor LLM |
| `ask_claude` tool | The MCP tool exposed by the Article 3 server; accepts `{ question, chatgpt_answer?, model? }` and returns Claude's answer as structured content | `projects/article-3/` | — |
| Claude Max vs Claude API | Two separate Anthropic offerings: Claude Max is a monthly-flat Claude chat/desktop subscription, Claude API is a usage-based HTTP API billed separately. Article 3 uses the API (not Max) | `docs/prds/prd-article-3-*` | — |
