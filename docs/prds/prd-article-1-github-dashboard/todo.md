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
- [x] spec-001: `basic-host` からサーバーを参照して `hello_time` の呼び出しと UI 表示を確認 — ダブル iframe サンドボックスで React UI が描画され、`Connected` バッジと ISO timestamp 表示までを chrome-devtools MCP で視覚検証、スクショ 3 枚保存 (2026-04-12)
- [x] spec-002: GitHub REST/GraphQL クライアントを実装 (未認証アクセス、rate-limit ハンドリング含む) — `src/github.ts` に `fetchRepo` / `fetchLanguages` / `fetchContributors` + `Result<T>` 型を実装、`facebook/react` で実スモーク確認 (stars 244k, JS 68%, 5 contributors) + not_found エラーも検証済み (2026-04-12)
- [x] spec-002: `analyze_repo` ツールを定義 (入力 `{ owner, repo }`、出力: 言語比率 / Star 数 / Contributor トップ 5) — zod スキーマで登録、3 API を並列 fetch して `AnalyzeRepoResult` に変換、facebook/react で実動作確認 (2026-04-12)
- [x] spec-002: エラー応答 (404, rate-limit, network error) を UI で扱える形で構造化して返す — `isError: true` + `structuredContent.error: { code, message, resetAt? }` で UI に届く構造、404 系は実 API でも検証済み (2026-04-12)
- [x] spec-003: Recharts を導入し、言語比率ドーナツ・Star 数カード・Contributor リストのコンポーネントを作成 — `recharts@3.8.1`、3 コンポーネント作成、8 色パレット (2026-04-12)
- [x] spec-003: `ontoolresult` で受け取ったデータからダッシュボードを描画 — `structuredContent` の shape で分岐する `AppRouter`、facebook/react で実 API データ描画を視覚検証 (2026-04-12)
- [x] spec-003: エラー / ローディング / 空状態の UI を追加 — `InfoCard` / `ErrorCard` / `StatusBadge`、CSP 修正も含めて完成、途中で発見した zod 検証エラーも表示できることを確認 (2026-04-12)
- [x] spec-003: Light/Dark テーマ追従を `useDocumentTheme` または `useHostStyles` で確認 — React state + `onhostcontextchanged` + ThemeContext で実装 (`useDocumentTheme` は DOM 属性監視で host context を拾えないため不採用)、basic-host で light/dark 視覚検証済み (2026-04-12)
- [x] spec-004: `_meta.ui.csp.connectDomains` に `https://api.github.com` を追加し、`basic-host` で接続エラーが出ないことを確認 — spec-003 で前倒し実施 (2026-04-12)
- [x] spec-004: `cloudflared tunnel --url http://localhost:3001` で HTTPS 公開 — `mechanisms-birds-terminal-blues.trycloudflare.com` 経由で `initialize` 通過を curl 確認、DNS rebinding 保護回避のため `ALLOWED_HOSTS` 環境変数を `server.ts` に追加 (2026-04-12)
- [x] spec-004: Claude.ai Connectors 設定に URL を追加し、"facebook/react を分析して" で動作確認 — Claude が analyze_repo を呼び、iframe ダッシュボードが正常描画、Claude は構造化データを自然言語に統合 (2026-04-12)
- [x] spec-004: 動作確認のスクリーンショット (basic-host / Claude.ai 両方) を `docs/references/MCP Apps/screenshots/` に保存 — spec-001/ + spec-003/ + spec-004/ の 3 ディレクトリ合計 15 枚 (2026-04-12)
- [x] spec-005: Zenn 記事ドラフトを執筆 (骨子 9 章構成、`article-writer` スキル活用) — `articles/mcp-apps-github-dashboard.md` に Zenn CLI 形式で 7000 字ドラフト完成、セルフレビュー 5 項目パス (2026-04-12)
- [x] spec-005: 記事内のコードブロックを実際のリポジトリからの抜粋に差し替え、動作検証 — 全コードスニペットを実装から直接コピー、バージョン番号は実インストール値 (TS 6 / React 19 / Vite 8 / Express 5) (2026-04-12)
- [ ] spec-005: `/code-review` / `docs-review` スキルで記事ドラフトをレビュー
- [ ] spec-005: Zenn CLI または Web から公開し、公開 URL を `knowledge.md` に記録
