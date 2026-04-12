# Knowledge — Article 1: GitHub Dashboard MCP App

## Reusable Patterns

- **サンプル実装のディレクトリ位置**: `projects/article-1/` をリポジトリルート直下に置き、PRD ごとに完全に独立した package.json / node_modules を持つ構成を採用。Article 2 (予定) も同じパターン (`projects/article-2/`) で追加する。これによりリポジトリルートの Ralph Matsuo テンプレ検証 (`npm test` 等) と衝突しない
- **TypeScript サーバーの直接起動**: `tsx` を devDependency に入れて、`"start": "tsx server.ts"` で TypeScript ソースを直接実行する。`ts-node` より軽く ESM とも相性が良い
- **Stateless MCP Streamable HTTP の canonical パターン**: `McpServer` と `StreamableHTTPServerTransport` を**リクエストごとに新規生成**する。シングルトン共有はステート汚染で 500 になる。`@modelcontextprotocol/sdk/dist/esm/examples/server/simpleStatelessStreamableHttp.js` がリファレンス実装
- **`createMcpExpressApp()` でローカルホスト保護**: SDK 提供の `createMcpExpressApp` を使うと、127.0.0.1 / localhost 向けに DNS rebinding 保護ミドルウェアが自動で適用される。素の `express()` の代わりに使うのが MCP spec 準拠
- **UI リソースのフォールバック HTML**: Vite ビルド (`dist/mcp-app.html`) が無くても server.ts が起動できるよう、`fs.readFile` を try/catch でラップしてフォールバック HTML を返す。spec を独立に実装しやすくするための安全弁
- **`enableJsonResponse: true`**: `StreamableHTTPServerTransport` のオプション。SSE ストリームではなく単純な JSON レスポンスを返すモード。curl での smoke test や `enableJsonResponse` 非対応クライアントで便利
- **`useApp()` フックの基本パターン**: `appInfo` + `capabilities` + `onAppCreated` の 3 つだけで成立。`onAppCreated` 内で `app.ontoolresult = (params) => {...}` を設定し、`params.content` (CallToolResult shape) からテキストブロックを取り出して React state にセットする
- **`useApp()` の "意図的な再実行抑止"**: フックは options 変更時に**意図的に再実行されない** (再接続ループを避けるため)。また App インスタンスは unmount 時に**自動 close されない** (React StrictMode の double-mount 対応)。これは普通の React フックの挙動と異なるので、説明文に明示的に書く価値がある
- **`vite.config.ts` で `root: src` + 絶対パス指定**: Vite の `root` を `src` に切り替えると、build 出力が `dist/mcp-app.html` (root 直下) に出る。`outDir` と `rollupOptions.input` は **`path.resolve(__dirname, ...)` の絶対パス**にすると相対解決の混乱を避けられる
- **`vite-plugin-singlefile` のビルド結果サイズ感**: hello_time UI (React 19 + ext-apps SDK + ステータスバッジ) で **312KB / gzipped 92KB**。React 一式と MCP Apps SDK が全部 inline されているにしては小さい。Recharts を入れる spec-003 で再評価 (上限 500KB gzipped 目標)
- **basic-host は Bun を必要としないが、workspace install がハマる**: `ext-apps` リポの `package.json` にある `prepare` スクリプトが `generate-schemas.ts` を実行してコケる。`npm install -w examples/basic-host --ignore-scripts` で回避可能。`serve.ts` 自体は shebang が `#!/usr/bin/env npx tsx` で、Bun 非依存。`basic-host/package.json` の `serve: "bun --watch serve.ts"` を無視して `npx tsx serve.ts` を直接実行できる
- **`basic-host` の build は `tsc --noEmit` で失敗する (`@types/cors` 不足)**: `npm run build` を直接実行すると TypeScript エラーになる。`npx cross-env INPUT=index.html npx vite build` + `INPUT=sandbox.html` 版を直接実行すれば vite ビルドだけ通せる。upstream の basic-host package.json のバグ扱い
- **ダブル iframe サンドボックスの実装パターン**: basic-host は外側 iframe (`ui://` リソースのラッパー) と内側 iframe (我々の React UI) の両方を**同じオリジン (`localhost:8081`)** で動かしつつ、ホストページ (`localhost:8080`) とはオリジンを分けている。accessibility tree 上では "MCP-UI Proxy" (外) → "hello_time" (内) のネストとして見える
- **`useApp()` の `Connected` 状態は postMessage ハンドシェイク完了のサイン**: basic-host 経由でロードすると、React 初期描画時は "Connecting…" でそのまま "Connected" に切り替わる。切り替わらなかった場合はホスト側の `ui/initialize` が来ていない証拠 (例: 親ページが MCP Apps プロトコルを話せない、iframe の origin 設定ミス)
- **API クライアントは `Result<T>` 型 + ユニオンで返す**: `throw` ではなく `{ ok: true; data } | { ok: false; error }` を返すと、呼び出し側で try/catch を書かずに `if (result.ok)` で型が絞り込まれて分岐できる。MCP のツールハンドラから返す構造化エラーとも相性が良く、**UI → 構造化エラーカード描画** の流れが try/catch より自然
- **MCP tool のエラー応答は `isError: true` + `structuredContent.error`**: `content` は human-readable なテキスト (LLM が読める形)、`structuredContent` は UI が直接読む構造化データ。両方セットすると LLM と UI の両方が同じ結果を理解できる。`isError: true` を付けると MCP SDK が "エラー状態" としてホストに通知する
- **zod `inputSchema` は自動的に JSON Schema に変換される**: `inputSchema: { owner: z.string().describe("..."), repo: z.string() }` と書くと、MCP SDK が `tools/list` レスポンスで Draft-07 JSON Schema に変換する。`z.string().describe()` の description も保持される。クライアント側の型検証はホストに任せられる
- **MCP Apps の UI リソースはツール名を受け取れない**: `McpUiToolInputNotification.params` は `{ arguments?: Record<string, unknown> }` のみで、tool name フィールドがない。これは **1 UI リソース = 1 ツール専用** という設計想定のため。複数ツールで同じ UI を共有する場合は **`CallToolResult.structuredContent` の shape で判定** する (例: `"stars" in structuredContent` なら analyze_repo) のが正解
- **Recharts `ResponsiveContainer` は親 div でサイズを渡してはいけない**: `<div style={{ width: "100%", height: 260 }}><ResponsiveContainer>...` は初期レンダリング時に `width(-1) height(-1)` 警告を出してチャートが空で描画される。正解は `<ResponsiveContainer width="100%" height={260}>...` のように **ResponsiveContainer 自体に明示的なサイズを渡す** こと
- **`_meta.ui.csp` は `registerAppResource` の content item に載せる**: `_meta.ui.csp: { connectDomains, resourceDomains, frameDomains, baseUriDomains }` は resource の `contents[0]._meta.ui.csp` に配置する。basic-host はこれを `sandbox.html?csp=<url-encoded-json>` の query param に変換して iframe の CSP ヘッダを動的に構築する
- **CSP `connectDomains` は fetch/XHR/WebSocket の許可ドメイン、`resourceDomains` は `<img>`/`<script>`/`<link>` の許可ドメイン**: 外部 API アクセスには `connectDomains`、外部画像/スクリプト/CSS 読み込みには `resourceDomains` を使う。GitHub API (`api.github.com`) は connect、GitHub avatar (`avatars.githubusercontent.com`) は resource
- **`isError: true` + tool 側が検証エラーで止まった場合の UI**: zod 検証失敗は SDK レベルで拒否され、tool handler は呼ばれない。そのため `structuredContent.error` は空で、`content[0].text` に `"MCP error -32602: Input validation error: ..."` が入る。UI 側の ErrorCard はこの fallback パスもハンドリングする必要がある

## Integration Notes

- **パッケージマネージャ**: 各 `projects/article-*/` が独自の package.json と node_modules を持つ。root (`mcp-apps-sample/`) の package.json は Ralph Matsuo テンプレ検証専用
- **`.gitignore` の扱い**: root の `.gitignore` に `node_modules/` が入っているため `projects/article-1/node_modules/` も自動で除外される
- **root `npm test` は bash シンタックスチェックのみ**: `bash -n scripts/*.sh scripts/ralph/*.sh .github/scripts/*.sh .claude/hooks/*.sh` を実行している。projects 配下の変更では回帰しない

## Gotchas

- **Express 5 系を初期化時に採用**: 2026-04-12 の `npm install express` で `^5.2.1` が入った。Express 4 系とは middleware API に差分があるため、記事やサンプルコードは "Express 5 前提" で統一する
- **React 19 系を初期化時に採用**: `^19.2.5` が入る。一部のサードパーティ React ライブラリが 19 対応していない可能性があるため、spec-003 で Recharts を導入する際に互換性確認が必要
- **TypeScript 6 系を初期化時に採用**: `^6.0.2` が入る。`tsconfig.json` の `module` / `moduleResolution` 設定は TS 6 のデフォルトに従う
- **Vite 8 系を初期化時に採用**: `^8.0.8` が入る。`vite.config.ts` は spec-001 task 4 で作成する (Vite 8 の config 形式に準拠)
- **`@modelcontextprotocol/ext-apps` / `sdk` は strict ESM**: `require('pkg/package.json')` は `ERR_PACKAGE_PATH_NOT_EXPORTED` で失敗する。バージョン確認は `npm list --depth=0` を使う
- **stateless モードでシングルトン transport は使えない**: SDK の `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` を 1 つだけ作って使い回すと、2 回目以降の `tools/list` などで Express デフォルトの 500 (text/plain) が返る。エラーは `transport.onerror` にも try/catch にも乗らない (SDK の内部 state corruption)。**毎リクエスト新規生成 + `res.on("close")` で cleanup** が正解
- **`registerAppTool` は `_meta.ui/resourceUri` 旧キーも自動で付ける**: `_meta.ui.resourceUri` を渡すと、SDK 内部で legacy key の `_meta["ui/resourceUri"]` も同時に populate される。古いホストとの後方互換のため。tools/list レスポンスを目視確認すると両方見える
- **macOS には `timeout` コマンドがない**: スモークテストの Bash で `timeout N npx tsx server.ts` は失敗する (`command not found: timeout`)。`gtimeout` (coreutils) または `&` でバックグラウンド + `pkill` でクリーンアップが正解
- **GitHub API の rate limit 判定は `x-ratelimit-remaining` ヘッダ + 403/429 両方見る**: 403 は `abuse detection` 時、429 は `too many requests` 時に発生する。`status === 403 || status === 429` かつ `remaining === "0"` なら rate_limited と判定。`x-ratelimit-reset` は UNIX epoch 秒なので `new Date(n * 1000).toISOString()` で ISO に変換する
- **GitHub API 未認証は 60 req/h、token 付けると 5000 req/h**: 認証ヘッダは `Authorization: Bearer ${GITHUB_TOKEN}` (classic PAT の `token XXX` 形式も動くが `Bearer` が推奨)。`@modelcontextprotocol/sdk` と同じく **User-Agent ヘッダも設定が推奨**される (GitHub は UA なしリクエストに厳しい時がある)
- **`facebook/react` を代表リポとしてスモークテスト**: 2026-04-12 時点で stars ~244k、言語 JavaScript 68.4% / TypeScript 28.7% / HTML 1.4%、トップ contributor は `sebmarkbage / zpao / gaearon`。記事の例として使える具体データ
- **`tsconfig.json` の `moduleResolution: "Bundler"` で server + client を 1 ファイルに統合可能**: `server.ts` (Node ESM) と `src/main.tsx` (Vite クライアント) を同一 tsconfig で扱えた。`lib: ["ES2022", "DOM", "DOM.Iterable"]` で両方の型が解決される (server.ts で DOM 型が見えてしまう副作用はあるが、サンプルプロジェクトでは許容)
- **`CallToolResult.content` 内のブロック判定は type narrowing が必要**: `params.content?.find((block): block is { type: "text"; text: string } => block.type === "text")` のように type predicate を使わないと、その後の `block.text` が型エラーになる。React 19 + TypeScript 6 の strict モードで顕在化

## Testing Notes

<!-- Record durable testing patterns, not one-off execution logs. -->

## Article Publication Record

<!-- Record the Zenn article URL once published, plus any post-publication feedback. -->
