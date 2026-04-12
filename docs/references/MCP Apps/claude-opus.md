# MCP Apps：AIチャットにインタラクティブUIを持ち込むMCP初の公式拡張

**MCP Apps はMCP（Model Context Protocol）初の公式拡張仕様であり、MCPツールがプレーンテキストの代わりにリッチなインタラクティブUIを返せるようにする仕組みである。** 2025年11月にSEP-1865として提案され、2026年1月26日にStable仕様としてローンチ。Anthropic・OpenAI・MCP-UIコミュニティの共同開発により誕生し、**Claude、ChatGPT、VS Code（GitHub Copilot）、Microsoft 365 Copilot、Goose、Postman**で既にプロダクション利用可能な段階にある。拡張識別子は `io.modelcontextprotocol/ui`、公式リポジトリは `modelcontextprotocol/ext-apps`（GitHub）、SDKは `@modelcontextprotocol/ext-apps`（npm）として公開されている。MCPツールが `ui://` URIスキームでHTMLリソースを宣言すると、ホスト側がサンドボックス化されたiframeの中でそれをレンダリングし、JSON-RPC over postMessageで双方向通信を行う——これがMCP Appsの核心的な仕組みだ。

---

## 仕様の全体像とSEP-1865の経緯

MCP AppsはSEP-1865（Standard Extension Proposal）として、MCP-UIの共同開発者Ido Salomon（@idosal）とLiad Yosef（@liadyosef）がPR #1865を起票したことから始まった。2025年11月21日にMCP公式ブログで提案が発表され、UI Community Working Group（MCP Contributors Discordの`#ui-wg`チャンネル）での議論を経て、**2026年1月28日にメインリポジトリへマージ**された。

仕様の現在のステータスは以下の通りだ。

| バージョン | ステータス | 場所 |
|---|---|---|
| **2026-01-26** | **Stable（本番利用可）** | `specification/2026-01-26/apps.mdx` |
| draft | Development（開発中） | `specification/draft/apps.mdx` |

SEP-1865の著者陣は多岐にわたる。Anthropic側からOlivier Chafik、Jerome Swannack、Anton Pidkuiko、Sean Strong、OpenAI側からNick Cooper、Bryan Ashley、Alexi Christakis、そしてMCP-UI創設者のIdo SalomonとLiad Yosefが名を連ねている。MCP共同創設者のDavid Soria Parra（Anthropic）は公式発表で「MCP Appsが切り拓く可能性にワクワクしている。コミュニティが何を作るか楽しみだ」とコメントしている。

MCP Appsはコア仕様（`modelcontextprotocol/specification`）には含まれず、**独立した拡張リポジトリ**（`modelcontextprotocol/ext-apps`）として管理される。SEP-1724で定義されたExtensions Frameworkに則り、クライアント・サーバー間でCapability Negotiationを通じてオプトインする設計だ。既存のMCPサーバーはMCP Apps非対応ホストに対してテキストのみのフォールバックを返せるため、**後方互換性は完全に維持**される。

---

## アーキテクチャ：4つの柱と通信フロー

MCP Appsの技術的アーキテクチャは4つの柱で構成される。

**第1の柱：UIリソース。** `ui://` URIスキームを使って事前宣言されるHTMLリソースである。MIMEタイプは `text/html;profile=mcp-app`。サーバーはツール登録時にこれらのリソースを宣言し、ホストはツール呼び出し前にプリフェッチできる。

```json
{
  "uri": "ui://charts/bar-chart",
  "name": "Bar Chart Viewer",
  "mimeType": "text/html;profile=mcp-app"
}
```

**第2の柱：Tool-UIリンケージ。** ツール定義の `_meta.ui.resourceUri` フィールドでUIリソースを参照する。`_meta.ui` オブジェクトには `permissions`（カメラ、マイク等の追加権限）や `csp`（外部オリジンの制御）も指定できる。さらに `visibility` 配列（`"model"` / `"app"`）でツールの可視性を制御し、`visibility: ["app"]` とすればLLMからは隠蔽されUIからのみ呼び出せるツールとなる。

```json
{
  "name": "visualize_data",
  "inputSchema": { ... },
  "_meta": {
    "ui": {
      "resourceUri": "ui://charts/interactive",
      "visibility": ["model", "app"]
    }
  }
}
```

**第3の柱：双方向通信。** UIのiframeとホスト間はJSON-RPC 2.0 over `postMessage` で通信する。コアMCPと共有するメッセージ（`tools/call`、`resources/read`等）に加え、`ui/` プレフィックスのApp固有メッセージが定義されている。主要なフローは次の通りだ。

1. **Discovery** — サーバーが `tools/list` でUIメタデータ付きツールを公開
2. **Initialization** — ホストがiframeをレンダリング → Viewが `ui/initialize` を送信 → ホストがhost context（テーマ、ロケール、コンテナサイズ等）を返却 → Viewが `ui/notifications/initialized` で応答
3. **Data Delivery** — ホストが `ui/notifications/tool-input` と `ui/notifications/tool-result` でデータを配信（ストリーミング入力は `ui/notifications/tool-input-partial` を使用）
4. **Interactive Phase** — Viewが `tools/call` でサーバーツールを呼び出し、`ui/message` で会話にメッセージを送り、`updateModelContext` でモデルのコンテキストを更新
5. **Teardown** — ホストが `ui/resource-teardown` を送信し、Viewが確認応答

**第4の柱：セキュリティモデル。** 多層防御設計を採用する。全UIコンテンツはサンドボックス化されたiframeで実行され、親ウィンドウのDOM・Cookie・ローカルストレージへのアクセスは遮断される。Webベースのホストでは**ダブルiframeアーキテクチャ**が必須とされ、ホストとサンドボックスは異なるオリジンを持つ。CSP（Content Security Policy）はサーバーが `_meta.ui.csp` で宣言し、ホストが強制する。宣言なしの場合、**外部接続は一切許可されない**（restrictive by default）。ホストはUIテンプレートのHTMLコンテンツを接続セットアップ時にレビューでき、UI起動のツール呼び出しにはユーザー承認を要求できる。

表示モードは `inline`（会話内埋め込み）、`fullscreen`（全画面）、`pip`（ピクチャー・イン・ピクチャー）の3種類をサポートしている。

---

## SDKの構造と開発ツール群

公式SDKは `@modelcontextprotocol/ext-apps`（npm、v1.2.2時点で**55万以上の週間ダウンロード**）として公開され、4つのサブパッケージで構成される。

| サブパッケージ | 役割 |
|---|---|
| `@modelcontextprotocol/ext-apps` | View構築用（`App`クラス、`PostMessageTransport`） |
| `@modelcontextprotocol/ext-apps/react` | React向けフック（`useApp`、`useHostStyles`等） |
| `@modelcontextprotocol/ext-apps/app-bridge` | ホスト側でViewを埋め込み・通信するためのブリッジ |
| `@modelcontextprotocol/ext-apps/server` | MCPサーバーにUIメタデータ付きツール・リソースを登録 |

SDKを使わずに `postMessage` と JSON-RPCを直接実装することも可能だ。公式リポジトリには**React、Vue、Svelte、Preact、Solid、Vanilla JS**のスターターテンプレートが用意されており、フレームワーク非依存が徹底されている。

特筆すべきは**Agent Skills**の同梱だ。AIコーディングエージェント向けに4つのスキルが提供される。`create-mcp-app`（新規アプリのスキャフォールド）、`migrate-oai-app`（OpenAI AppからMCP Appsへの移行）、`add-app-to-server`（既存MCPサーバーへのUI追加）、`convert-web-app`（既存WebアプリのMCP App化）。Claude Codeの場合、`/plugin marketplace add modelcontextprotocol/ext-apps` でインストール後、「MCP Appを作って」と依頼するだけで開発が始められる。

公式リポジトリには**20以上のサンプル実装**が含まれる。3D可視化（CesiumJS地球儀、Three.jsシーン、ShaderToyエフェクト）、データ探索（コホートヒートマップ、顧客セグメンテーション、Wikipedia探索）、ビジネスアプリ（シナリオモデラー、予算配分）、メディア（PDF表示、動画リソース、楽譜表示、テキスト読み上げ）、ユーティリティ（QRコード生成[Python]、システムモニター、音声文字起こし）と多岐にわたる。

---

## 実践的なGetting Started手順

MCP Appを最速で動かすには以下の手順を踏む。

**ローカル環境での実行（basic-host使用）：**
```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps
npm install
npm start
# → http://localhost:8080/ でサンプル一覧を確認
```

**Claude DesktopやVS Codeで動かす場合**は、`claude_desktop_config.json`（または対応する設定ファイル）に以下を追加する。

```json
{
  "mcpServers": {
    "map": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-map", "--stdio"]
    }
  }
}
```

**自分でMCP Appを作る場合**のプロジェクト構成と基本コードは次の通りだ。

```bash
npm init -y
npm install @modelcontextprotocol/ext-apps @modelcontextprotocol/sdk express cors
npm install -D typescript vite vite-plugin-singlefile
```

サーバー側では `registerAppTool` と `registerAppResource` の2つの関数でツールとUIリソースを紐づける。

```typescript
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({ name: "My MCP App", version: "1.0.0" });
const resourceUri = "ui://get-time/mcp-app.html";

registerAppTool(server, "get-time", {
  title: "Get Time",
  description: "Returns the current server time.",
  inputSchema: {},
  _meta: { ui: { resourceUri } }
}, async () => ({
  content: [{ type: "text", text: new Date().toISOString() }]
}));

registerAppResource(server, "time_ui", resourceUri, {},
  async () => ({
    contents: [{ uri: resourceUri, mimeType: "text/html;profile=mcp-app", text: HTML_CONTENT }]
  })
);
```

View（iframe内で動くHTML）側では `App` クラスを使用する。

```typescript
import { App } from "@modelcontextprotocol/ext-apps";
const app = new App();
await app.connect();
app.ontoolresult = (result) => { renderChart(result.data); };
const response = await app.callServerTool({ name: "fetch_details", arguments: { id: "123" } });
await app.updateModelContext({ content: [{ type: "text", text: "ユーザーがオプションBを選択" }] });
```

核心的なパターンは **「MCP App = Tool + UI Resource」** である。ツールがデータを返し、UIリソースがそれを表示する。この分離により、プレゼンテーションとロジックが明確に分かれる。

---

## 隣接プロトコル・フレームワークとの比較

MCP Appsは「AIチャットクライアントにUIを埋め込む」という明確な領域を持つが、周辺には複数の関連技術が存在する。

**AG-UI（Agent-User Interaction Protocol）** はCopilotKitチームが開発したイベントベースの通信プロトコルだ。SSE/WebSocket/Webhookを使い、エージェントバックエンドとフロントエンド間のリアルタイムストリーミング、共有状態同期、ツールオーケストレーションを標準化する。MCP Appsとは**補完関係**にある——AG-UIがエージェント全体の通信フローを管理し、MCP Appsが個別ツールのUI表示を担う。CopilotKitはAG-UIを同期レイヤーとして使いながらMCP Appsのレンダリングをサポートしている。

**A2UI（Agent-to-User Interface）** はGoogleが開発した宣言的UIウィジェット仕様だ。HTMLではなくコンポーネント記述を送信し、クライアント側がネイティブウィジェット（Angular、Flutter、React、Lit等）でレンダリングする。MCP Appsが「実際のHTMLをiframeで動かす」のに対し、A2UIは「UIの構造記述を送り、クライアントが描画する」アプローチをとる。

**Vercel AI SDK（StreamableUI）** はReact Server Componentsを使ってLLMからUIコンポーネントを直接ストリーミングする。`streamUI` 関数がツール呼び出しをReactコンポーネントにマッピングする。ただし**React/Next.jsに完全に依存**しており、クロスホスト互換性はない。Vercel自身もプロダクション用途にはAI SDK UI（非RSC版）を推奨しており、StreamableUIはExperimentalステータスにとどまる。

**LangGraph Generative UI** はLangGraphプラットフォーム上でカスタムイベントとしてUI参照を送り、フロントエンドの `useStream()` フックでレンダリングする。プラットフォーム固有の実装であり、LangGraph外では動作しない。

| 特性 | MCP Apps | AG-UI | A2UI | Vercel AI SDK | LangGraph |
|---|---|---|---|---|---|
| **種別** | プロトコル拡張 | 通信プロトコル | UI仕様 | React SDK | プラットフォーム機能 |
| **UI配信方式** | HTML in iframe | イベントストリーム | 宣言的記述 | React Server Components | カスタムイベント |
| **クロスホスト** | ✅ | ✅ | ✅ | ❌（Next.js限定） | ❌（LangGraph限定） |
| **フレームワーク非依存** | ✅（任意のHTML/JS） | ✅ | ✅ | ❌ | ❌ |
| **サンドボックス** | ✅（iframe） | N/A | ✅（宣言的） | ❌ | ❌ |
| **ガバナンス** | Linux Foundation | OSS | Apache 2.0（Google） | Vercel独自 | LangChain |

MCP Appsの最大の差別化要因は**「Write Once, Run Everywhere」**だ。一度書いたUIがClaude、ChatGPT、VS Code、M365 Copilotのいずれでも動作する。これは他のアプローチにはない特性である。

---

## エコシステム：ホスト対応とローンチパートナー

2026年4月現在、MCP Appsを公式にサポートするホストは以下の通りだ。

- **Claude**（Web・Desktop）— Anthropic
- **ChatGPT** — OpenAI（Apps SDK互換レイヤー経由）
- **VS Code**（GitHub Copilot）— Microsoft
- **Microsoft 365 Copilot** — 2026年3月9日に対応発表
- **Goose** — Block（オープンソースAIエージェント、MCP Appsのリファレンス実装）
- **Postman**
- **MCPJam**

JetBrains、AWS（Kiro）、Google DeepMind（Antigravity）は「探索中」のステータスだ。ローンチパートナーとして**Amplitude、Asana、Box、Canva、Clay、Figma、Hex、monday.com、Slack、Salesforce、Adobe Express、Coursera、Excalidraw、Mapbox**が名を連ねている。

コミュニティSDKも複数存在する。**MCP-UI**（`@mcp-ui/client`、`@mcp-ui/server`）はMCP Appsの前身プロジェクトで、現在はMCP Apps標準を実装している。Postman、Shopify、HuggingFace、Goose、ElevenLabsが採用しており、ホスト開発者向けの推奨クライアントSDKの位置づけだ。**mcp-use**はフルスタックMCPフレームワークとしてReactウィジェットベースのアプローチを提供する。**Sunpeak**は17以上のTyped Reactフック、ローカルインスペクタ（localhost:3000）、テストフレームワークを内蔵するフレームワークだ。**Microsoftのmcp-interactiveUI-samples**はFluent UIを使ったHR・保険・配送・研修などのパターン集を公開している。

---

## コミュニティの反応と日本語情報

Hacker Newsのメインスレッド（192ポイント、121コメント）では、MCP Appsに対して**肯定と懐疑が拮抗**する議論が展開された。最も注目された論点は「静的UIか、LLM生成UIか」だ。「次のステップはLLMにUI生成能力を持たせることであり、定義済みUIを返すのは逆方向ではないか」という意見に対し、「LLMのUI生成は現時点では信頼性が不十分。MCP Appsなら ChatGPT内でDoomをプレイすることもできる」という反論がなされた。Anthropic所属のfelixriesebergは「MCPを実際のユーザーフローに近づけるのは今まで本当に難しかった。理想的には、MCPのエンドユーザーはMCPの存在すら意識しないでいい」とコメントしている。

MCP Lead MaintainerのDen Delimarskyは自身のブログで「2026年のMCP開発における最初のエキサイティングな章だ。MCP Appsは既存のプロトコル抽象化の上にHTMLを重ねたもの以上でも以下でもない」と簡潔に本質を捉えている。

**日本語情報**については、azukiazusa.devが「AIとインタラクティブなUIのやり取りを実現するMCP Apps」という包括的な技術解説記事を公開している（https://azukiazusa.dev/blog/ai-interactive-ui-with-mcp-apps/）。CSSカスタムプロパティによるテーマ統合、双方向通信、動作サンプルまでをカバーしており、日本語では現時点で最も充実した情報源だ。Zenn・Qiitaでは「MCP」全般の記事は非常に多い（Zennでは「ランキングがMCPの記事ばかりで埋まっている」状態）が、MCP Apps特化の技術記事はまだ少なく、**Zennに技術記事を書けば日本語圏で先行者になれる**。

---

## 既知の制約と今後のロードマップ

現時点のMCP Appsには明確な制約がある。

- **HTMLのみ対応**：初期仕様は `text/html;profile=mcp-app` のみ。外部URL埋め込み、Remote DOM、ネイティブウィジェットは将来の拡張に先送り
- **状態永続化なし**：セッション間でのウィジェット状態保存は未標準化
- **ウィジェット間通信なし**：複数ウィジェットの相互連携は未サポート
- **ホスト対応のばらつき**：すべてのMCPクライアントがUI拡張を実装しているわけではなく、テキストフォールバックが必須
- **iframe内のネットワーク制限**：ホストのCSPに依存し、宣言されていない外部接続はブロックされる

MCP公式ロードマップ（2026年3月5日更新）では、MCP Appsは2026年の**優先テーマ**として明記されている。具体的な将来計画として外部URL対応、状態永続化、ウィジェット間通信、HTML以外のコンテンツタイプ拡張が挙げられているが、いずれもタイムラインは未確定だ。より広いMCPエコシステムの観点では、Streamable HTTPのスケーラビリティ改善、MCP Server Cards（`.well-known`によるメタデータディスカバリ）、Triggers/Event-Driven Updates、Enterprise Working Groupの設立が並行して進んでいる。

---

## Zenn記事を書く開発者へのアクションプラン

MCP Appsを使って実際に手を動かし、技術記事にまとめるなら、以下のアプローチが効果的だ。

まず `ext-apps` リポジトリをクローンして `npm start` で`basic-host`上のサンプル群を一通り試す。次に**Quickstartガイド**（https://modelcontextprotocol.github.io/ext-apps/api/documents/Quickstart.html）に従い、最小限のMCP App（時計表示アプリ等）を自作する。Claude Desktopで動作確認した上で、データ可視化やフォーム入力など実用的なユースケースに発展させるのがよい。

記事の差別化ポイントとしては、AG-UI/A2UI/Vercel AI SDKとの技術比較を含めること、`ui://`スキームとツールメタデータの仕組みを図解すること、そしてセキュリティモデル（ダブルiframeアーキテクチャ）の解説が有力だ。日本語圏ではMCP Apps特化の記事がほぼ空白地帯であるため、この分野の先行者として大きなインパクトを期待できる。公式リポジトリのAgent Skills（`create-mcp-app`等）を活用したvibe codingの体験記も、読者に刺さるコンテンツになるだろう。

主要リソースへのリンク一覧：公式リポジトリ（https://github.com/modelcontextprotocol/ext-apps）、公式ドキュメント（https://modelcontextprotocol.io/extensions/apps/overview）、APIリファレンス（https://apps.extensions.modelcontextprotocol.io/api/）、Quickstartガイド（https://modelcontextprotocol.github.io/ext-apps/api/documents/Quickstart.html）、SEP-1865仕様本文（https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx）、公式ブログ発表（https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/）、MCP-UIコミュニティSDK（https://mcpui.dev/）、日本語解説記事（https://azukiazusa.dev/blog/ai-interactive-ui-with-mcp-apps/）。