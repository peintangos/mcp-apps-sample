# MCP Apps 完全技術調査レポート

## エグゼクティブサマリー

MCP Apps（SEP-1865）は、2026年1月26日に正式リリースされたMCPの最初の公式拡張仕様である。通常のMCPツールがプレーンテキストや構造化データを返すのに対し、MCP Appsはインタラクティブなゲームからダッシュボード、フォーム、PDFビューアまで、あらゆるHTML UIをAIチャット内に直接レンダリングできる。MCP-UIとOpenAIのApps SDKが先行して同様のパターンを実証し、その標準化として誕生した。[^1][^2][^3]

***

## アーキテクチャ概観

### コアコンセプト：Tool + Resource の組み合わせ

MCP Appsは、MCP本来の2つのプリミティブを組み合わせた設計になっている。[^2]

1. **ツール（Tool）**：`_meta.ui.resourceUri` フィールドを持つ通常のMCPツール。ここに `ui://` スキームのURIを設定することでUIリソースへのリンクを宣言する
2. **UIリソース（UI Resource）**：`ui://` スキームで提供されるHTMLページ（JS/CSSを含む）。ホストがこれをsandboxed iframeとしてレンダリングする

### 処理フロー

```
1. LLMがツールを呼び出す
2. ホストがツール定義の _meta.ui.resourceUri を検出
3. ホストが ui:// リソースをサーバーからフェッチ（UIプリロードも可能）
4. ホストがsandboxed iframe内にHTMLをレンダリング
5. AppクラスがpostMessageでホストと接続（ui/initialize）
6. ツール実行結果がUIに通知される（ui/notifications/tool-result）
7. ユーザーがUI操作 → app.callServerTool() でサーバーツールを呼び出せる
8. app.updateModelContext() でAIのコンテキストを更新できる
```

この一連のフローにより、AIとUI、サーバーが三者で協調動作する。[^4]

***

## 通信プロトコルの技術詳細

### JSON-RPC 2.0 over postMessage

MCP Appsは、ブラウザ標準の `postMessage` API上でJSON-RPC 2.0を使った独自のMCP方言を実装している。コアMCPと一部メッセージを共有しながら、`ui/` プレフィックスの独自メソッドを持つ。[^3][^5]

| メソッド | 方向 | 説明 |
|---|---|---|
| `ui/initialize` | Widget → Host | 初期化・ホストコンテキスト取得 |
| `tools/call` | Widget → Host | MCPツールを呼び出す |
| `resources/read` | Widget → Host | MCPリソースを読み取る |
| `ui/open-link` | Widget → Host | 外部URLをブラウザで開く |
| `ui/message` | Widget → Host | チャットにメッセージを送信 |
| `ui/size-change` | Widget → Host | iframeサイズ変更通知 |
| `ui/notifications/tool-result` | Host → Widget | ツール実行結果を受信 |
| `ui/host-context-change` | Host → Widget | テーマ・コンテキスト変更通知 |

[^5]

### ダブルiframeサンドボックスアーキテクチャ

多くの実装（MCPJamなど）が採用するダブルiframe方式では、ホストページ→サンドボックスプロキシ（外側iframe）→ゲストUI（内側iframe）という3層構造でオリジン分離を実現している。外側のiframeは別オリジンで動作し、内側のHTMLをsrcdoc経由でロードすることで、ホストページのDOMやcookieへのアクセスを完全に遮断する。[^5]

***

## セキュリティモデル

### 多層防御の設計

MCP Appsはサードパーティのコードを実行する性質上、複数層のセキュリティ機構を持つ。[^6][^2]

- **iframeサンドボックス**：親ページのDOM・cookie・localStorage・ナビゲーションを制限
- **CSP（コンテンツセキュリティポリシー）**：`_meta.ui.csp` で許可する外部オリジンを事前宣言。宣言されていないドメインへのリクエストはブラウザレベルでブロックされる[^7]
- **パーミッション宣言**：マイク・カメラ等の追加権限は `_meta.ui.permissions` で明示的に要求
- **事前審査可能なテンプレート**：HTMLコンテンツはレンダリング前にホストが確認できる
- **監査可能な通信**：すべてのUI↔ホスト間通信がJSON-RPCでログ可能
- **ユーザー同意**：ホストはUIからのツール呼び出しに明示的な承認を要求できる

### CSPの落とし穴

実際の開発でよく遭遇するのが「UIが空白になる」問題で、その多くはCSPの未宣言が原因である。Claudeではサーバーオリジンのハッシュから算出されたサブドメインをiframeのオリジンとして使用し、ChatGPTでは `yourapp.web-sandbox.oaiusercontent.com` というドメインを使う。CDN、Google Fonts、外部APIなどを使う場合は必ず `_meta.ui.csp` に列挙が必要になる。[^7]

***

## SDK・フレームワーク全体マップ

### @modelcontextprotocol/ext-apps（公式SDK）

公式SDKは、アプリ開発者とホスト開発者の双方向けにパッケージを提供している。[^8][^9]

**サーバーサイド（`@modelcontextprotocol/ext-apps/server`）**
- `registerAppTool()` — ツールをUIメタデータ付きで登録
- `registerAppResource()` — UIリソースハンドラーを登録
- `RESOURCE_MIME_TYPE` — MIMEタイプ定数 (`text/html;profile=mcp-app`)

**クライアントサイド（`@modelcontextprotocol/ext-apps`）**
- `App` クラス — ホストとの通信を抽象化するメインクラス
  - `app.connect()` — ホストとの接続確立
  - `app.ontoolresult` — ツール実行結果のコールバック
  - `app.callServerTool()` — サーバーツールの呼び出し
  - `app.updateModelContext()` — AIのコンテキスト更新
  - `app.sendMessage()` — チャットへのメッセージ送信

**Reactサポート（`@modelcontextprotocol/ext-apps/react`）**
- `useApp()` — 接続状態・App インスタンスを返すフック[^10]
- `useHostStyles()` — ホストのスタイル変数取得[^11]
- `useDocumentTheme()` — ライト/ダークテーマ同期[^11]

```typescript
import { useApp } from "@modelcontextprotocol/ext-apps/react";

function MyWidget() {
  const { app, isConnected, error } = useApp({
    appInfo: { name: "MyWidget", version: "1.0.0" },
    onAppCreated: (app) => {
      app.ontoolresult = (result) => renderData(result.data);
    },
  });
  if (!isConnected) return <div>Connecting...</div>;
  return <div>Connected</div>;
}
```


### MCP-UI（@mcp-ui/client・@mcp-ui/server）

MCP-UIはMCP Appsの前身であり、公式標準化後もコミュニティフレームワークとして継続開発されている。ホスト実装には `AppRenderer` コンポーネントが推奨される。[^12]

**主な追加機能**
- `AppRenderer` — React コンポーネントでiframe管理を自動化
- OpenAI Apps SDK アダプター — ChatGPT向けにtext/html+skybridge MIMEタイプを処理
- Ruby/Go向けサーバーサイドSDK（mcpui-go等）[^13]
- `rawHtml`・URLコンテンツ・Remote DOM（Shopify remote-dom）の3種コンテンツタイプ[^14]

### OpenAI Apps SDK（ChatGPT専用）

OpenAIが独自に開発した実装で、`_meta["openai/outputTemplate"]` というメタデータキーを使用する。`text/html+skybridge` というMIMEタイプを用い、ChatGPTがiframe内にブリッジスクリプトを注入する仕組みになっている。MCP Apps標準との二重対応も可能だが、両者のリソースを別々に用意する必要がある。[^15]

### 主要SDKの比較

| 項目 | MCP Apps (SEP-1865) | OpenAI Apps SDK | MCP-UI |
|---|---|---|---|
| プロトコル | JSON-RPC 2.0 | カスタムpostMessage | JSON-RPC (独自) |
| サンドボックス | ダブルiframe推奨 | シングルiframe | iframe |
| メタデータキー | `_meta.ui.resourceUri` | `openai/outputTemplate` | `ui://` inline |
| 状態永続化 | 未対応 | localStorage | - |
| 対応クライアント | Claude, ChatGPT, VSCode, Goose等 | ChatGPTのみ | Claude, Goose等 |
| オープン性 | ✅ オープン標準 | ❌ 独自仕様 | ✅ オープン |

[^5]

***

## フロントエンドフレームワーク対応

公式リポジトリには以下のフレームワークのスターターテンプレートが含まれている。[^16][^6]

| フレームワーク | スターター | SDKサポート | 特記事項 |
|---|---|---|---|
| React | `basic-server-react` | `useApp` フック付属 | Reactチームに最適 |
| Vanilla JS | `basic-server-vanillajs` | 手動ライフサイクル | ビルド不要で最もシンプル |
| Vue | `basic-server-vue` | 手動ライフサイクル | Vueエコシステムと親和性高い |
| Svelte | `basic-server-svelte` | 手動ライフサイクル | バンドルサイズ最小 |
| Preact | `basic-server-preact` | 手動ライフサイクル | Reactと互換、軽量 |
| Solid | `basic-server-solid` | 手動ライフサイクル | リアクティビティが優秀 |

Reactのみ公式の `useApp` フックが提供されており、他フレームワークは `App` クラスを直接利用する。[^17]

### ビルドシステム

`vite + vite-plugin-singlefile` を使ってHTMLにJS/CSSをインライン化し、単一HTMLファイルとしてMCPサーバーから配信するのが推奨パターンである。CSPを設定してCDN等から外部リソースを読み込む構成も可能で、この場合はバンドルは必須ではない。[^18]

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: "dist", rollupOptions: { input: "mcp-app.html" } },
});
```


***

## 公式スキャフォールディングツール

### AIコーディングエージェント向けスキル

`ext-apps` リポジトリには、AIエージェントがプロジェクトを自動生成するための「スキル」が同梱されている。[^18]

| スキル名 | 用途 |
|---|---|
| `create-mcp-app` | ゼロから新規MCP Appを作成 |
| `convert-web-app` | 既存WebアプリをMCP App対応に変換（デュアルビルド） |
| `add-app-to-server` | 既存MCPサーバーにUI機能を追加 |
| `migrate-oai-app` | OpenAI Apps SDK実装からの移行 |

[^19]

**対応エージェント**：Claude Code（`~/.claude/skills/`）, VS Code GitHub Copilot, Gemini CLI, Cline, Goose, Codex, Cursor。インストールは以下のコマンドで行う。[^18]

```bash
/plugin marketplace add modelcontextprotocol/ext-apps
/plugin install mcp-apps@modelcontextprotocol-ext-apps
```

***

## 公式サンプル一覧と活用可能な技術

`ext-apps` リポジトリには実用的なサンプルが多数用意されている。[^6][^16]

| カテゴリ | サンプル名 | 使用技術・特徴 |
|---|---|---|
| 3D・ビジュアライゼーション | `map-server` | CesiumJS（3D地球儀）, updateModelContext連携 |
| 3D | `threejs-server` | Three.js 3Dシーン |
| シェーダー | `shadertoy-server` | WebGL シェーダーエフェクト |
| データ探索 | `cohort-heatmap-server` | コホート分析ヒートマップ |
| データ探索 | `customer-segmentation-server` | 顧客セグメンテーション |
| データ探索 | `wiki-explorer-server` | Wikipedia探索UI |
| ビジネス | `scenario-modeler-server` | シナリオモデリング |
| ビジネス | `budget-allocator-server` | 予算配分フォーム |
| メディア | `pdf-server` | PDFビューア（インライン表示） |
| メディア | `video-resource-server` | 動画プレイヤー |
| メディア | `sheet-music-server` | 楽譜表示 |
| 音声 | `say-server` | テキスト読み上げ（Python実装） |
| ユーティリティ | `qr-server` | QRコード生成（Python実装） |
| 監視 | `system-monitor-server` | リアルタイムシステム監視 |
| 音声認識 | `transcript-server` | 音声→テキスト変換 |

[^8][^16]

***

## 対応クライアント一覧

MCP Appsは2026年1月26日の発表時点で複数のクライアントが同時リリースに参加している。[^20][^1]

| クライアント | 対応状況 | 備考 |
|---|---|---|
| Claude (web・desktop) | ✅ 対応済み | ドメイン署名（サーバーURLのハッシュ）が必要 |
| ChatGPT | ✅ 対応済み | 一部機能未対応（UIからのツール呼び出し等） |
| VS Code GitHub Copilot | ✅ 対応済み（Insiders） | フルスクリーン・PiPモード未対応 |
| Goose（Block） | ✅ 対応済み | Block社の参照実装 |
| Postman | ✅ 対応済み | デバッグに有用 |
| MCPJam Inspector | ✅ 対応済み | ダブルiframe実装 |
| JetBrains IDEs | 🔄 検討中 | Denis Shiryaev氏コメント |
| AWS Kiro | 🔄 検討中 | Clare Liguori氏コメント |
| Google DeepMind Antigravity | 🔄 検討中 | Anshul Ramachandran氏コメント |

[^1][^20]

***

## ローカル開発・テスト環境

### basic-hostによるローカルテスト

Claudeアカウントや有料プランがなくてもローカルでUIの動作確認が可能である。[^18]

```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps/examples/basic-host
npm install
SERVERS='["http://localhost:3001/mcp"]' npm start
# → http://localhost:8080 でUI確認可能
```

### Claudeでのテスト（有料プラン必要）

ローカルサーバーをcloudflaredでトンネリングして、Claude ProのカスタムコネクタとしてURLを登録する。[^18]

```bash
npx cloudflared tunnel --url http://localhost:3001
# → 生成されたURLをClaude設定 > Connectors > Add custom connectorに追加
```

***

## 既存WebアプリのMCP App化

`convert-web-app` スキルを使うと、既存Reactアプリを最小限の変更でMCP App対応にできる。主な変更点は以下の通りで、スタンドアロンWebアプリとMCP Appのデュアルビルドが可能になる。[^19]

```
my-app/
├── src/
│   ├── main.tsx          ← スタンドアロン用エントリー（既存）
│   ├── App.tsx           ← 共通UIコンポーネント（小修正）
+│   └── mcp-main.tsx     ← MCP App用エントリー（新規追加）
+├── mcp-app.html         ← MCP App用HTMLシェル（新規追加）
+├── server.ts            ← MCPサーバー（新規追加）
└── vite.config.ts        ← デュアルビルド設定に修正
```



***

## 日本語コミュニティでの実装事例

### Classmethod DEV.IO の記事シリーズ
- MCP Apps概要・仕組み解説、`create-mcp-app` スキルによるゼロ開発、`convert-web-app` スキルによる既存WebアプリのMCP App化の3記事が公開されている[^21][^19]

### JSプレイグラウンド（Monaco Editor + Next.js）
- Monaco Editorを内蔵したコード実行プレイグラウンドをMCP App化した実装が報告されており、Next.jsとiframe対応レイアウトを組み合わせた構成になっている[^22]

```
study-programming-mcp-apps/
├── app/
│   ├── mcp/route.ts          ← MCPサーバー + ツール定義
│   ├── components/
│   │   ├── PlaygroundWidget.tsx
│   │   └── MonacoEditor.tsx  ← dynamic import
│   └── hooks/
│       └── use-mcp-app.ts    ← MCP接続ブリッジ
```


***

## 記事化にあたっての観点・アイデア

### 差別化されやすい切り口

1. **既存Webアプリの移植**：Viteで作ったSPAをMCP App化する `convert-web-app` スキルの実践は、日本語記事がまだ少ない分野
2. **Pythonサーバー + TypeScript UI**：`qr-server` のようにバックエンドをPythonで書き、UIをTypeScriptにする構成の解説
3. **updateModelContext の活用**：ユーザーのUI操作をAIに伝えるコンテキスト更新の仕組みは独立した記事になりうる
4. **CSPトラブルシューティング**：外部ライブラリ（Chart.js, Three.js, D3.js等）を使う際のCSP設定は実践的でよく詰まる箇所[^7]
5. **basic-hostを使った開発フロー**：有料アカウント不要でローカル完結する開発環境の紹介

### ミニマルな出発点

公式チュートリアルの「現在時刻表示アプリ」が最小構成として理想的である。必要なファイルは `server.ts`・`mcp-app.html`・`src/mcp-app.ts`・`vite.config.ts` の4ファイルのみで、`registerAppTool` + `registerAppResource` + `App.connect()` の3ステップで動く。[^18]

***

## 今後の動向と制約

### 既知の制約・注意点

- Claudeでのテストにはドメイン署名（サーバーURLハッシュ）が必要[^20]
- VS CodeはフルスクリーンとPiP表示モードを未サポート[^20]
- ChatGPTはUIからのツール呼び出し（`callServerTool`）を一部未サポート[^20]
- 各クライアントのCSP実装に細かい差異がある[^7]
- 状態永続化（セッション間でのUI状態の保持）は現仕様では未対応

### ロードマップ

MCP公式ロードマップではトランスポートの進化（ステートレスな水平スケーリング対応）が示されており、MCP Apps自体もGitHub Discussionsで活発に仕様議論が続いている。MCP-UIコミュニティではRemote DOM（Shopify remote-dom ライブラリを使った仮想DOM型コンテンツ）の発展も続いている。[^23][^14]

---

## References

1. [MCP Apps - Bringing UI Capabilities To MCP Clients](http://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) - MCP Apps is now live as the first official MCP extension — tools can return interactive UI component...

2. [UI implementation](https://modelcontextprotocol.io/docs/extensions/apps) - Build interactive UI applications that render inside MCP hosts like Claude Desktop

3. [ext-apps/specification/2026-01-26/apps.mdx at main - GitHub](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) - MCP Apps uses JSON-RPC 2.0 over postMessage for iframe-host communication. UI capabilities (e.g., to...

4. [【入門】MCP Appsとは？公式サンプルを試して概要と内部的な ...](https://dev.classmethod.jp/articles/mcp-apps-introduction-overview/) - 今回は、MCPの基本から始めて、MCP Apps の概要と仕組みを解説し、公式サンプルの map-server を実際にClaude Desktopで動かして内部構造を見ていきます。

5. [MCP Apps Architecture - MCPJam Inspector](https://docs.mcpjam.com/contributing/mcp-apps-architecture) - Understanding MCPJam Inspector's MCP Apps (SEP-1865) implementation for custom UI widgets

6. [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) - Interactive UI applications that render inside MCP hosts like Claude Desktop

7. [MCP App CSP Explained: Why Your Widget Won't Render in ...](https://dev.to/cptrodgers/mcp-app-csp-explained-why-your-widget-wont-render-9n1) - You built an MCP App. The tool works. The server returns data. But the widget renders as a blank...

8. [@modelcontextprotocol/ext-apps - v1.1.0 - GitHub Pages](https://modelcontextprotocol.github.io/ext-apps/api/) - Documentation for @modelcontextprotocol/ext-apps

9. [https://huggingface.co/AbdulElahGwaith/ext-appss/r...](https://huggingface.co/api/resolve-cache/models/AbdulElahGwaith/ext-appss/319cd024df0f4338fc8fdf56eb9da9c9257f43f7/README.md?download=true&etag=%224e0872757dfa56e82b66263dd27b8957ec6d967b%22)

10. [MCP Apps useApp - React Connection Hook - Sunpeak.ai](https://sunpeak.ai/docs/mcp-apps/react/use-app) - Connect to an MCP App host with useApp. Creates App, PostMessageTransport, handles initialization ha...

11. [Agentic Commerce の顔になるか！？ MCP Apps を試してみる](https://zenn.dev/aws_japan/articles/5709c0fab21676) - React Hooks（オプション） ; useHostStyles(), Hostのスタイル変数を取得, @modelcontextprotocol/ext-apps/react ; useDocu...

12. [MCP-UI](https://mcpui.dev) - Interactive UI for MCP - Build rich, dynamic interfaces with MCP-UI

13. [mcpui](https://pkg.go.dev/github.com/ironystock/mcpui-go@v0.1.0) - Package mcpui provides a Go SDK for the MCP-UI protocol (SEP-1865).

14. [MCP-UI MCP Server: The Definitive Guide for AI Engineers](https://skywork.ai/skypage/en/MCP-UI-MCP-Server-The-Definitive-Guide-for-AI-Engineers/1972134266675625984) - It is ideal for self-contained UI snippets, embedding existing web applications, or when a custom lo...

15. [OpenAI Apps SDK Integration - MCP-UI](https://mcpui.dev/guide/apps-sdk) - Interactive UI for MCP - Build rich, dynamic interfaces with MCP-UI

16. [modelcontextprotocol/ext-apps | MCP...](https://lobehub.com/zh-TW/mcp/modelcontextprotocol-ext-apps)

17. [skills - create-mcp-app - GitHub](https://github.com/modelcontextprotocol/ext-apps/blob/main/plugins/mcp-apps/skills/create-mcp-app/SKILL.md) - Provides comprehensive guidance for building MCP Apps with interactive UIs. ... Configure build syst...

18. [Build an MCP App - Model Context Protocol](https://modelcontextprotocol.io/extensions/apps/build) - Getting started guide for building interactive UI applications with MCP Apps

19. [公式の`convert-web-app` スキルを使って既存のWebアプリをMCP ...](https://dev.classmethod.jp/articles/convert-web-app-to-mcp-app-with-official-skill/) - これまでMCP Appsについて、概要と仕組みの解説、 create-mcp-app スキルを使ったゼロからの開発と2本の記事を書いてきました。

20. [MCP Apps Goes Official: Claude (and more!) support interactive ...](https://alpic.ai/blog/mcp-apps-goes-official-claude-chatgpt-support) - Interactive MCP Apps land in Claude, with ChatGPT, Goose and VS Code, unlocking rich, cross-platform...

21. [公式の`create-mcp-app` スキルを使ってMCP AppをClaude Codeで ...](https://dev.classmethod.jp/articles/create-mcp-app-skill-pomodoro-timer/) - MCP Apps は、通常のMCPツール定義に _meta.ui フィールドを追加するだけで、テキストを返す関数をインタラクティブなWebアプリに変える 仕組みです。

22. [MCP Appsでチャット内で実行確認ができる勉強のアプリを作って ...](https://dev.classmethod.jp/articles/js-playground-mcp-apps/)

23. [Roadmap](https://modelcontextprotocol.io/development/roadmap) - MCP Server Cards: a standard for exposing structured server metadata via a .well-known URL, so brows...

