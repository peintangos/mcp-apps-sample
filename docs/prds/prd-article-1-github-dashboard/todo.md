# TODO — Article 1: GitHub Dashboard MCP App

<!--
Keep tasks in priority order.
Each unchecked task should be small enough to complete in one `/implement` run or one Ralph iteration.
Mark completed tasks with `- [x]` instead of removing them.
-->

- [x] spec-001: `package.json` の初期化と最小依存 (`@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, `express`, `cors`, `typescript`, `tsx`, `vite`, `vite-plugin-singlefile`, `@vitejs/plugin-react`, `react`, `react-dom`, `@types/*`) の追加 — `projects/article-1/` に配置、2026-04-12 完了
- [x] spec-001: `server.ts` で MCP サーバーを初期化し、`hello_time` ツールと UI リソースを `registerAppTool` / `registerAppResource` で登録 — `projects/article-1/server.ts` 完成、curl で initialize / tools/list / tools/call / resources/read を確認 (2026-04-12)
- [x] spec-001: `src/mcp-app.html` と `src/main.tsx` で最小 UI を作成し `useApp()` でホスト接続 — `tsconfig.json` も合わせて作成、`tsc --noEmit` で型チェック通過 (2026-04-12)
- [x] spec-001: `vite.config.ts` を `vite-plugin-singlefile` 構成にして `dist/mcp-app.html` を生成 — `npm run build` で 312KB の単一 HTML、サーバー経由 `resources/read` で React UI が返ることを確認 (2026-04-12)
- [ ] spec-001: `basic-host` からサーバーを参照して `hello_time` の呼び出しと UI 表示を確認
- [ ] spec-002: GitHub REST/GraphQL クライアントを実装 (未認証アクセス、rate-limit ハンドリング含む)
- [ ] spec-002: `analyze_repo` ツールを定義 (入力 `{ owner, repo }`、出力: 言語比率 / Star 数 / Contributor トップ 5)
- [ ] spec-002: エラー応答 (404, rate-limit, network error) を UI で扱える形で構造化して返す
- [ ] spec-003: Recharts を導入し、言語比率ドーナツ・Star 数カード・Contributor リストのコンポーネントを作成
- [ ] spec-003: `ontoolresult` で受け取ったデータからダッシュボードを描画
- [ ] spec-003: エラー / ローディング / 空状態の UI を追加
- [ ] spec-003: Light/Dark テーマ追従を `useDocumentTheme` または `useHostStyles` で確認
- [ ] spec-004: `_meta.ui.csp.connectDomains` に `https://api.github.com` を追加し、`basic-host` で接続エラーが出ないことを確認
- [ ] spec-004: `cloudflared tunnel --url http://localhost:3001` で HTTPS 公開
- [ ] spec-004: Claude Desktop の Connectors 設定に URL を追加し、"facebook/react を分析して" で動作確認
- [ ] spec-004: 動作確認のスクリーンショット (basic-host / Claude Desktop 両方) を `docs/references/MCP Apps/screenshots/` に保存
- [ ] spec-005: Zenn 記事ドラフトを執筆 (骨子 9 章構成、`article-writer` スキル活用)
- [ ] spec-005: 記事内のコードブロックを実際のリポジトリからの抜粋に差し替え、動作検証
- [ ] spec-005: `/code-review` / `docs-review` スキルで記事ドラフトをレビュー
- [ ] spec-005: Zenn CLI または Web から公開し、公開 URL を `knowledge.md` に記録
