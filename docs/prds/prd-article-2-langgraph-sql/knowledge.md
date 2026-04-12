# Knowledge — Article 2: LangGraph × MCP Apps × Human-in-the-loop SQL

## Reusable Patterns

<!-- Document patterns that should be reused in later tasks or later PRDs. -->

## Integration Notes

<!-- Capture cross-cutting behavior, dependencies, or setup details that are easy to forget. -->

## Gotchas

<!-- Document pitfalls, edge cases, or failure modes. -->

- OpenRouter 経由の GPT-4.x 系で Structured Output を使う場合、provider ごとに対応差がある可能性。モデル選定時に検証必須。
- `langchain-mcp-adapters` は MCP の tools を吸い上げるが、`_meta.ui.resourceUri` や `ui://` リソースの描画は扱わない。描画は自作フロントで受ける必要がある。
- LangGraph の `interrupt()` は v0.2 以降が前提。古いバージョンのドキュメントを参照しない。
- LangSmith は LangGraph 側のみ trace する。MCP Apps の iframe 内ユーザー操作 (postMessage) は trace に載らない。

## Testing Notes

<!-- Record durable testing patterns, not one-off execution logs. -->

## Article Publication Record

<!-- Record the Zenn article URL once published, plus any post-publication feedback. -->
