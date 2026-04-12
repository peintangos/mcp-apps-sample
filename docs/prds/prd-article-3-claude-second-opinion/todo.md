# TODO — Article 3: ChatGPT × Claude Second Opinion MCP App

<!--
Keep tasks in priority order.
Each unchecked task should be small enough to complete in one `/implement` run or one Ralph iteration.
Mark completed tasks with `- [x]` instead of removing them.
NOTE: Article 3 の実装は Article 1 公開後に着手する。Article 2 とは並行可。
-->

- [x] spec-001: `projects/article-3/` に `package.json` を初期化し、`@modelcontextprotocol/sdk` / `@modelcontextprotocol/ext-apps` / `@anthropic-ai/sdk` / `express` / `react` / `react-markdown` / `vite` / `vite-plugin-singlefile` / `tsx` などを導入 — 18 パッケージ、0 vulnerabilities (2026-04-12)
- [x] spec-001: `server.ts` で MCP サーバーを初期化し、最小 `ask_claude` (hardcode placeholder + structuredContent) と UI リソースを登録 — Article 1 の stateless パターン + `ALLOWED_HOSTS` 対応済み (2026-04-12)
- [x] spec-001: `src/mcp-app.html` + `src/main.tsx` + `tsconfig.json` + `vite.config.ts` を Article 1 構成から流用して作成 — `AskClaudeApp` + `StatusBadge` で placeholder 結果を描画 (2026-04-12)
- [x] spec-001: `basic-host` で `ask_claude` の呼び出しと最小 UI 描画を確認、スクショ取得 — Connected + placeholder answer 描画まで視覚確認、`article-3-spec-001/01-ask-claude-placeholder.png` 保存 (2026-04-12)
- [x] spec-002: `src/claude.ts` に Anthropic SDK ラッパーを実装 (`askClaude(question, { model })` で Claude API を呼ぶ、`Result<T>` 型エラーハンドリング) — 401/429 を HTTP status で分類、遅延初期化 + キャッシュ (2026-04-12)
- [x] spec-002: `ask_claude` ツールの input schema は spec-001 で既に zod で定義済み、変更不要 (2026-04-12)
- [x] spec-002: tool handler を `src/claude.ts` の呼び出しに差し替え、`structuredContent` に `{ question, chatgpt_answer, claude_answer, model_used, latency_ms }` を返す (2026-04-12)
- [x] spec-002: 実 API でスモークテスト — sonnet (1591ms で "1+1は**2**です。") + opus (5911ms で Rust vs Go の構造化回答) 両方成功、curl 経由のサーバー E2E も成功 (2026-04-12)
- [ ] spec-003: `src/components/AnswerColumn.tsx` と `src/components/ComparisonView.tsx` を作成 (2 カラム、Markdown 描画)
- [ ] spec-003: `react-markdown` を導入し、コードブロックのシンタックスハイライトを追加
- [ ] spec-003: `main.tsx` の AppRouter を更新し、structuredContent の shape で ComparisonView を描画
- [ ] spec-003: ローディング / エラー / `chatgpt_answer` 未指定時のフォールバック UI を追加
- [ ] spec-003: Article 1 の ThemeContext を流用して light/dark 追従
- [ ] spec-003: basic-host で side-by-side UI の視覚検証、スクショ取得
- [ ] spec-004: `ALLOWED_HOSTS` env var 対応 (Article 1 から流用) を server.ts にも入れる
- [ ] spec-004: cloudflared トンネル起動 → ChatGPT Plus/Pro の Custom Connector に登録
- [ ] spec-004: ChatGPT で「〇〇について Claude にも聞いて比較して」と送り、tool call + UI 描画を視覚検証
- [ ] spec-004: ChatGPT で動かない制約があれば記録、Claude.ai で代替検証
- [ ] spec-004: スクショを `docs/references/MCP Apps/screenshots/article-3/` に保存
- [ ] spec-005: Article 3 の Zenn 記事ドラフトを執筆 (`article-writer` スキル、Article 1 と同じ文体ルール)
- [ ] spec-005: コードスニペットをリポジトリから逐語コピー、画像を `images/mcp-apps-claude-second-opinion/` に配置
- [ ] spec-005: `/code-review` / `docs-review` でドラフトレビュー
- [ ] spec-005: Zenn 公開、公開 URL を `knowledge.md` に記録
