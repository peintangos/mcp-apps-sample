# TODO — Article 2: LangGraph × MCP Apps × Human-in-the-loop SQL

<!--
Keep tasks in priority order.
Each unchecked task should be small enough to complete in one `/implement` run or one Ralph iteration.
Mark completed tasks with `- [x]` instead of removing them.
NOTE: Article 2 の実装は Article 1 (prd-article-1-github-dashboard) 完了後に開始する。
-->

- [ ] spec-001: Python 3.11 環境と `pyproject.toml` (or `requirements.txt`) を初期化し `langgraph`, `langchain-openai`, `langchain-mcp-adapters`, `langsmith`, `sqlite3` を導入
- [ ] spec-001: サンプル SQLite スキーマ (customers, orders, products) と `seed.py` を作成
- [ ] spec-001: OpenRouter エンドポイントを `langchain-openai` で構成し、最小の LangGraph エージェントで自然言語 → SELECT 生成を検証
- [ ] spec-001: スキーマを system prompt に流し込む helper と pytest スモークテストを追加
- [ ] spec-002: `modelcontextprotocol/ext-apps` の `basic-host` をフォーク / 参考に React SPA を作成
- [ ] spec-002: 自作ホストで `hello_tool` を描画できることを確認 (spec-001 の SELECT と繋ぎ込む前段階)
- [ ] spec-002: `postMessage` JSON-RPC ブリッジと iframe ロードの最小ロジックを実装
- [ ] spec-003: SQL シンタックスハイライト (`react-syntax-highlighter` 等) を導入
- [ ] spec-003: `SELECT` プレビュー結果を表形式で表示するコンポーネントを作成
- [ ] spec-003: [承認] / [キャンセル] / [編集] ボタンと 2 段階クリックの誤操作防止を実装
- [ ] spec-003: 破壊的 SQL と安全 SQL の色分け表示を追加
- [ ] spec-004: LangGraph エージェントに `interrupt()` を追加し、破壊的 SQL 検出時に停止
- [ ] spec-004: UI から承認シグナルを送るチャネルを決定 (MCP tool call / REST endpoint / WebSocket のいずれか) し実装
- [ ] spec-004: `Command(resume=...)` で graph を再開し、実行結果を UI に返す
- [ ] spec-004: キャンセル時は "中止" をチャットに応答する分岐を追加
- [ ] spec-005: LangSmith API キーを環境変数で受け取り、tracing を有効化
- [ ] spec-005: interrupt → 停止 → resume の trace を実行し、スクショを `docs/references/MCP Apps/screenshots/article-2/` に保存
- [ ] spec-005: trace から OpenRouter モデル呼び出しのレイテンシとトークンコストを記事向けに抜粋
- [ ] spec-006: Article 2 用の Zenn 記事ドラフトを執筆 (`article-writer` スキル活用)
- [ ] spec-006: 記事に Article 1 の導線を入れ、独自用語は glossary に追記
- [ ] spec-006: `/code-review` と `docs-review` でドラフトをレビュー
- [ ] spec-006: Zenn に公開し、公開 URL を `knowledge.md` に記録
