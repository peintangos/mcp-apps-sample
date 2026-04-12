# Article 1 Outline — MCP Apps で、Claude の中に自作ダッシュボードを生やす

- **Status**: Planning locked 2026-04-12
- **PRD**: [`docs/prds/prd-article-1-github-dashboard/`](../../prds/prd-article-1-github-dashboard/prd.md)
- **Target platform**: Zenn
- **Target reader**: MCP Apps 未体験者 (JS/TS, React 初級)
- **Tone**: 実装記、実際に動かしたコードとスクショで話す
- **目的**: 読者が自分の手元で MCP Apps を動かせるようになり、CSP の落とし穴を踏まずに済む

## タイトル案

- メイン: **「MCP Apps で、Claude の中に "自作ダッシュボード" を生やす — 2026 年の MCP 拡張を動かしてみる」**
- 予備: 「Claude に GitHub ダッシュボードを生やしてみた — MCP Apps 入門」

## 0. 冒頭の掴み (スクショ 1 枚)

Claude の会話内で GitHub リポ分析ダッシュボードが動いているスクショを貼る。

> リード文: 「チャット内にグラフが、地図が、3D が生える時代になりました。」

## 1. MCP Apps とはなにか

- 2026-01-26 に Stable になった MCP の**初の公式拡張** (SEP-1865)
- 拡張 ID は `io.modelcontextprotocol/ui`、公式リポは `modelcontextprotocol/ext-apps`
- 一言でいうと「**MCP ツールが、プレーンテキストの代わりにインタラクティブな HTML UI を返せるようになる**」
- ここで MCP 自体を知らない読者向けに 3 行だけ補足 (tools / resources の概念)

## 2. なぜこれが面白いのか

- 今まで LLM の出力は "テキスト 1 本" だった。凝った UI が欲しければ自前フロントを作るしかなかった
- OpenAI Apps SDK は ChatGPT 専用、MCP-UI はコミュニティ実装だった。**それが MCP の公式拡張として統一された**のが大きい
- **Write Once, Run Everywhere**: Claude / ChatGPT / VS Code Copilot / M365 Copilot / Goose / Postman のどこでも同じ実装が動く

## 3. 技術的な仕組み (図解パート)

- **Tool + UI Resource の 2 点セット**
  - ツール定義の `_meta.ui.resourceUri` が `ui://` リソースを指す
  - リソースは `text/html;profile=mcp-app` の HTML を返す
- **iframe でレンダリング + postMessage 上の JSON-RPC 2.0**
- **ライフサイクル**: LLM がツール呼び出し → ホストが UI を取得 → iframe にロード → `ui/initialize` → `ui/notifications/tool-result` で結果配信
- 図 1 枚: サーバー / ホスト / iframe の三角関係

## 4. まず公式サンプルを動かす (5 分)

```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps && npm install && npm start
# http://localhost:8080 で basic-host が立ち上がる
```

- `map-server` (CesiumJS 3D 地球儀) と `threejs-server` を触って「何ができるのか」の感覚を掴んでもらう
- ここは読者の離脱を防ぐ "完成品に触れる" フェーズ

## 5. 自分で作る: GitHub リポジトリ分析ダッシュボード

題材: ユーザーが "facebook/react を分析して" と言うと、Claude がツールを呼び、iframe に **言語比率ドーナツ + Star 数 + Contributor トップ 5** が表示される。

- **5.1 プロジェクト構成**
- **5.2 サーバー側**: `registerAppTool("analyze_repo", ...)` でツール定義、`_meta.ui.resourceUri` に `ui://github-dashboard/mcp-app.html`
- **5.3 UI 側**: `useApp()` フックで接続、`ontoolresult` でデータ受信、Recharts でドーナツ描画
- **5.4 ビルド**: `vite build` で単一 HTML が出る
- **5.5 ローカル確認**: `basic-host` から自分のサーバーに接続

## 6. ハマりどころ: CSP と GitHub API

- GitHub API (`api.github.com`) を叩こうとすると**白画面**になる → CSP 未宣言
- `_meta.ui.csp.connectDomains: ["https://api.github.com"]` を追加
- **CSP と CORS は別物**の落とし穴を 3 行で解説
- 結論: 「単一 HTML + 最小限の外部ドメイン宣言」が一番ハマらない

## 7. 実際の Claude Desktop で動かす

- `cloudflared tunnel --url http://localhost:3001` でトンネル
- Claude の Connectors 設定に URL を追加
- スクショ: 自作ダッシュボードが Claude のチャット内で動いている絵
- **ここが記事のクライマックス**

## 8. 今できないこと・知っておくべき制約

- 状態永続化なし (セッション間で UI 状態は消える)
- ホスト差分: VS Code はフルスクリーン・PiP 未対応、ChatGPT はツール呼び出しに一部制限
- UI 起動のツール呼び出しはホスト側でユーザー承認を挟める

## 9. まとめ + 次の記事予告

- MCP Apps は "既存の Web 技術 + iframe + CSP" で構成された**可搬な UI 規約**
- 次回は **LangGraph で自作ホストを書き、副作用を UI で承認するエージェント**を作る、と予告
- Article 2 PRD: `docs/prds/prd-article-2-langgraph-sql/`

## 差別化ポイント (著者向けメモ)

- 日本語で MCP Apps の実装記事はほぼ空白 — 先行者優位がある
- CSP と CORS の切り分けを実際の失敗で見せると差別化になる
- Claude Desktop で動いたスクショが冒頭に来るかどうかで SNS シェア率が変わる

## 想定読了時間

15〜20 分 (読者がコードを書きながら追う想定)

## 参照資料

`docs/references/MCP Apps/` 配下の 6 本の調査レポートを参照する。特に:

- `gemini.md` — 具体的な API とホスト対応表
- `claude-opus.md` — 隣接プロトコル比較 (AG-UI, A2UI, Vercel AI SDK)
- `manus.md` — 実装フロー と 記事テーマ案
