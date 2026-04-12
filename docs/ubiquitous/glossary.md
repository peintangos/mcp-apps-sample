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
