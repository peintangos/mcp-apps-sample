---
title: "MCP Apps で Claude の中に自作 GitHub ダッシュボードを生やしてみた"
emoji: "🧩"
type: "tech"
topics: ["mcp", "claude", "react", "typescript", "vite"]
published: false
---

チャットの中にグラフが、地図が、3D が生える時代になりました。

![Claude.ai の会話内で描画される自作 GitHub ダッシュボード](/images/mcp-apps-github-dashboard/01-hero-claude.png)

このスクショは、Claude.ai で「facebook/react を分析して」と送った結果です。Claude が MCP ツールを呼び出し、返ってきた結果と一緒に **React で自作したダッシュボード**が iframe で会話内にそのまま生えています。Star 数、言語比率のドーナツチャート、Top Contributor のアバターまで、ぜんぶ自作の React コンポーネントです。

これを可能にしているのが **MCP Apps** という仕組みで、2026 年 1 月に MCP (Model Context Protocol) の公式拡張として Stable 化されました。この記事では MCP Apps の仕組みをさらっと説明したあと、`hello_time` を返す最小サーバーから始めて、上のダッシュボードが Claude の中で動くまでを実際に手を動かして作っていきます。

ハマったポイントもかなり具体的に書くので、同じ罠を踏まずに済むはずです。

## MCP Apps ってなに

一言で説明すると、**MCP サーバーがプレーンテキストの代わりに HTML の UI を返せるようになる**拡張です。仕様名は SEP-1865、拡張 ID は `io.modelcontextprotocol/ui`、2026 年 1 月 26 日に Stable 化されました。

MCP 自体を知らない人向けに補足すると、MCP は LLM ホスト (Claude や ChatGPT) と外部ツール・データを JSON-RPC で繋ぐ標準プロトコルです。MCP サーバーは「ツール」を公開し、LLM がそれを呼びます。従来のツールはテキスト (`"今日の気温は 18 度です"`) しか返せませんでしたが、MCP Apps が加わったことでツールが **HTML + JavaScript のリッチな UI** を返せるようになりました。

## なにがうれしいのか

これまで LLM の出力は基本テキスト 1 本でした。凝った UI を見せたければ自前のフロントエンドを作るしかなく、しかもそのフロントは Claude や ChatGPT ごとに別実装が必要でした。OpenAI Apps SDK も 2025 年末までは ChatGPT 専用で、移植性がありませんでした。

MCP Apps の価値提案は **「Write Once, Run Anywhere」** です。1 本の MCP サーバーを書くだけで、Claude / ChatGPT / VS Code Copilot / M365 Copilot / Goose のどこでも**同じ UI が動きます**。

| 従来 | MCP Apps |
|---|---|
| ツールはテキスト/JSON を返す | ツールはテキスト + HTML UI を返す |
| ホストごとに UI を別実装 | 1 本の実装で全ホストに対応 |
| OpenAI Apps SDK は ChatGPT 専用 | MCP 公式拡張として標準化 |

## 技術的な仕組み

MCP Apps の核は 2 つの要素だけです。

1. **UI リソース**: `ui://` スキームで配信される HTML (MIME は `text/html;profile=mcp-app`)
2. **Tool-UI リンク**: ツール定義の `_meta.ui.resourceUri` がその UI リソースを指す

呼び出しフローは以下の通りです。

```
1. LLM がツールを呼ぶ
2. ホストが _meta.ui.resourceUri を読んで ui:// リソースを取得
3. ホストがサンドボックス化された iframe に HTML をロード
4. iframe 内の UI が postMessage 上の JSON-RPC でホストと接続
5. ホストがツール結果を ui/notifications/tool-result で iframe に配信
6. UI が結果を描画
```

iframe 内の UI からホストへの通信も同じ `postMessage + JSON-RPC` で、ここだけ押さえておけば大体わかります。

## まず公式サンプルを触る

手を動かす前に公式サンプルを眺めると全体像が掴めます。`modelcontextprotocol/ext-apps` リポを clone して、`basic-host` (公式リファレンスホスト) を起動しましょう。

```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps
npm install -w examples/basic-host --ignore-scripts
cd examples/basic-host
npx cross-env INPUT=index.html npx vite build
npx cross-env INPUT=sandbox.html npx vite build
SERVERS='["http://localhost:3001/mcp"]' npx tsx serve.ts
```

`--ignore-scripts` を付けているのは、ext-apps の `prepare` スクリプトが `ts-to-zod` を要求してコケるのを避けるためです。このリポは Bun ベースの workspace なので、素の npm で部分インストールするにはコツが要ります。**正直ここで結構ハマりました**。serve.ts 自体は `#!/usr/bin/env npx tsx` の shebang が付いていて Bun 非依存だったので、公式の `npm start` を無視して `npx tsx serve.ts` を直接叩けば動きます。

basic-host で自作サーバー (次の章で作る) に接続できれば、こんな感じで最小 UI が描画されます。

![basic-host で hello_time が描画されている様子](/images/mcp-apps-github-dashboard/02-basic-host-hello.png)

## 自分で作る: GitHub リポジトリダッシュボード

題材は **「`analyze_repo` ツールを呼ぶと、Star 数・言語比率・Top Contributor が React ダッシュボードとして会話内に生える」** です。

プロジェクト構成はシンプルにこんな感じ:

```
projects/article-1/
├── server.ts           # MCP サーバー (Streamable HTTP)
├── src/
│   ├── mcp-app.html    # Vite エントリ
│   ├── main.tsx        # React エントリ (useApp 経由)
│   ├── github.ts       # GitHub API クライアント
│   └── components/     # LanguageDonut / StarCard / ContributorList
├── vite.config.ts      # vite-plugin-singlefile
├── package.json
└── tsconfig.json
```

技術選定はこう決めました。

| パッケージ | バージョン | 役割 |
|---|---|---|
| `@modelcontextprotocol/sdk` | `^1.29.0` | MCP サーバー基盤 |
| **`@modelcontextprotocol/ext-apps`** | **`^1.5.0`** | **MCP Apps SDK (サーバー + React)** |
| `express` | `^5.2.1` | HTTP トランスポート |
| **`react` + `recharts`** | **`^19.2.5` + `^3.8.1`** | **UI + ドーナツチャート** |
| **`vite` + `vite-plugin-singlefile`** | **`^8.0.8` + `^2.3.2`** | **単一 HTML バンドル** |
| `tsx` | `^4.21.0` | TypeScript サーバー直接起動 |

2026 年 4 月時点の最新メジャーが揃った構成になっていて、React 19 + Vite 8 + Express 5 + TypeScript 6 という、少し前の記事だと全部違うバージョンだったはずのものが軒並み上がっています。書いてる側としても「こんなに上がってたのか」とちょっと驚きました。

### サーバー側 (server.ts の核)

`server.ts` では **stateless Streamable HTTP のリクエストごとに `McpServer` + `StreamableHTTPServerTransport` を生成** します。シングルトンで共有するとステート汚染で 500 が返るので注意してください。ここで半日溶かしました…。

```typescript
// server.ts (抜粋)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "article-1-github-dashboard",
    version: "0.0.1",
  });

  registerAppTool(
    server,
    "analyze_repo",
    {
      title: "Analyze GitHub Repository",
      description: "Fetches a GitHub repository's star count, languages, and top contributors.",
      inputSchema: {
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
      },
      _meta: { ui: { resourceUri: "ui://github-dashboard/mcp-app.html" } },
    },
    async ({ owner, repo }) => {
      const [repoRes, langsRes, contribsRes] = await Promise.all([
        fetchRepo(owner, repo),
        fetchLanguages(owner, repo),
        fetchContributors(owner, repo),
      ]);
      // ...エラーハンドリングと整形省略...
      return {
        content: [{ type: "text", text: `${owner}/${repo}: ${stars} stars, ...` }],
        structuredContent: result, // ← UI が読む構造化データ
      };
    },
  );

  registerAppResource(
    server,
    "Article 1 UI",
    "ui://github-dashboard/mcp-app.html",
    { description: "GitHub dashboard UI" },
    async () => ({
      contents: [{
        uri: "ui://github-dashboard/mcp-app.html",
        mimeType: RESOURCE_MIME_TYPE,
        text: await readFile("dist/mcp-app.html", "utf-8"),
        _meta: {
          ui: {
            csp: {
              connectDomains: ["https://api.github.com"],
              resourceDomains: ["https://avatars.githubusercontent.com"],
            },
          },
        },
      }],
    }),
  );

  return server;
}
```

ポイントは 2 つあります。

1 つ目は、ツール結果に **`content` と `structuredContent` を両方返している** こと。`content` には人間可読なテキスト (`"facebook/react: 244,424 stars, top language JavaScript (68.4%)..."`) を、`structuredContent` にはデータ構造をそのまま詰めています。**LLM は content を読んで会話を続け、UI は structuredContent を読んでチャートを描画する**という二刀流の設計で、これが MCP Apps の本質的な面白さです。

2 つ目は `_meta.ui.csp` の CSP 宣言です。これがないと iframe が GitHub API を叩こうとした瞬間にブラウザが止めます。`connectDomains` は fetch/XHR 先の許可、`resourceDomains` は `<img>` / `<script>` / `<link>` の許可先で、**使い分けを知らないとアバター画像が壊れて泣きます**。これは後述のハマりどころ 2 で触れます。

### UI 側 (main.tsx の核)

UI は React + `useApp()` フックで書きます。このフックが iframe ↔ ホスト間の postMessage ハンドシェイクを全部吸収してくれます。

```tsx
// src/main.tsx (抜粋)
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { createContext, useContext, useEffect, useState } from "react";

function AppRouter() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);

  const { app, isConnected, error } = useApp({
    appInfo: { name: "article-1-github-dashboard", version: "0.0.1" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (params) => setToolResult(params);
      app.onhostcontextchanged = (ctx) => {
        if (ctx.theme === "light" || ctx.theme === "dark") setTheme(ctx.theme);
      };
    },
  });

  useEffect(() => {
    if (app && isConnected) {
      const ctx = app.getHostContext();
      if (ctx?.theme === "light" || ctx?.theme === "dark") setTheme(ctx.theme);
    }
  }, [app, isConnected]);

  // 以下、toolResult.structuredContent の shape で分岐してダッシュボード描画
}
```

`useApp()` の挙動で一つ面白いのがあって、**このフックは options 変更時に意図的に再実行されない** し、**App インスタンスは unmount 時に自動 close されない**。普通の React フックの慣例を破っていて、初見だと「バグ？」と思うんですが、理由を読むとなるほどってなります。

- **再実行しない**のは、iframe ↔ ホストの再ハンドシェイクが無限ループになるのを防ぐため
- **close しない**のは、React StrictMode の double-mount 対応のため

**React の慣例より MCP プロトコルの整合性を優先**した設計で、これは普通のフックを書くときに意識する制約とは別物です。この設計判断を読んだ時に「MCP Apps は React 用に作られたライブラリじゃなくて、プロトコルの制約が先にある」と腑に落ちました。

basic-host で接続するとこんな感じで描画されます。

![basic-host で描画される GitHub ダッシュボード](/images/mcp-apps-github-dashboard/03-dashboard-closeup.png)

## ハマりどころ 3 連発

ここからが本題です。MCP Apps の仕組み自体はシンプルなんですが、セキュリティ関連で詰まるポイントがいくつかありました。

### 1. Recharts の `ResponsiveContainer` でチャートが消える

最初、Languages のドーナツチャートがどうしても描画されませんでした。親 div に height を付けているのに、空の枠だけ表示される。

```tsx
// ❌ これだとチャートが width(-1) height(-1) で消える
<div style={{ width: "100%", height: 260 }}>
  <ResponsiveContainer>
    <PieChart>...</PieChart>
  </ResponsiveContainer>
</div>
```

正解は **`ResponsiveContainer` 自身にサイズを渡す** ことでした。親 div で囲むと、初期測定のタイミングでサイズが 0 とみなされて警告が出ます。

```tsx
// ✅
<ResponsiveContainer width="100%" height={260}>
  <PieChart>...</PieChart>
</ResponsiveContainer>
```

Recharts 初心者が 100% 踏む罠っぽいです。

### 2. CSP の `img-src` で contributor アバターがブロックされる

basic-host でダッシュボードを開いたら、チャートは描画されたのに contributor のアバターが全部壊れ画像になっていました。DevTools Console 見たらこれ:

```
Loading the image 'https://avatars.githubusercontent.com/u/63648?v=4'
violates the following Content Security Policy directive:
"img-src 'self' data: blob:". The action has been blocked.
```

MCP Apps のホストは、**デフォルトで外部画像をブロック**します。これを通すには `_meta.ui.csp.resourceDomains` で明示的に許可が必要です。

```typescript
_meta: {
  ui: {
    csp: {
      connectDomains: ["https://api.github.com"],           // fetch/XHR の許可先
      resourceDomains: ["https://avatars.githubusercontent.com"], // img/script/style の許可先
    },
  },
}
```

`connectDomains` と `resourceDomains` の使い分けを理解していないと、「API は通るのに画像が来ない」という謎現象が起きます。**connectDomains は fetch 系、resourceDomains は `<img>` や `<script>` 系** と覚えておけば迷いません。

### 3. `createMcpExpressApp` の DNS rebinding 保護が cloudflared で詰まる

**これが一番ハマりました**。ローカル (`localhost:3001`) では動くのに、cloudflared トンネル経由で Claude に繋いだ瞬間にこれが返ってきます:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Invalid Host: mechanisms-birds-terminal-blues.trycloudflare.com"
  },
  "id": null
}
```

MCP SDK の `createMcpExpressApp()` はデフォルトで **localhost バインド時に DNS rebinding 保護**を自動で有効化します。これはブラウザからローカルサーバーを不正に叩かれるのを防ぐためのセキュリティ機能ですが、**cloudflared 経由で外部公開すると Host ヘッダが `*.trycloudflare.com` になるため正当なリクエストまで弾かれる**わけです。

対策は `allowedHosts` オプションで許可ドメインを明示することです。私は環境変数から受けるようにしました。

```typescript
// server.ts
const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(",").map((h) => h.trim()).filter(Boolean)
  : undefined;

const app = createMcpExpressApp({
  host: process.env.MCP_HOST ?? "127.0.0.1",
  ...(allowedHosts ? { allowedHosts } : {}),
});
```

起動時に `ALLOWED_HOSTS="mechanisms-birds-terminal-blues.trycloudflare.com" npx tsx server.ts` のように渡せば解決。**セキュリティのための中間層が開発体験を削る典型例**で、知らないと 1 時間は確実にコケます。記事のハマりどころとしてはこれが一番価値あると思っています。

## Claude.ai で動かす

ここまで来たら後は接続するだけです。サーバーを立てて、cloudflared でトンネルを開き、Claude.ai に Custom Connector として登録します。

```bash
# Terminal 1: MCP サーバー
cd projects/article-1
npx tsx server.ts  # 最初はこれで起動、トンネル URL が出たら環境変数を付けて再起動

# Terminal 2: cloudflared トンネル
cloudflared tunnel --url http://localhost:3001
# → https://{random}.trycloudflare.com が発行される
```

トンネル URL を控えて、`ALLOWED_HOSTS` を付けてサーバーを再起動します。それから Claude.ai の **Settings → Connectors → Add custom connector** から以下を登録します。

- **Name**: `article-1-github-dashboard`
- **Remote MCP server URL**: `https://{random}.trycloudflare.com/mcp` (末尾の `/mcp` 忘れずに)

新しい会話で「facebook/react を分析して」と送るだけ。Claude が承認を求めてくるので OK を押すと、

![Claude.ai のダークテーマで描画されるダッシュボード](/images/mcp-apps-github-dashboard/04-dashboard-dark.png)

**動いた瞬間、ちょっと感動します**。Claude の返答が「スター数は約 24.4 万と、GitHub 全体でもトップクラスのリポジトリですね」と自然言語で要約していて、同時に iframe には自作ダッシュボードが描画されている。**LLM と UI が同じツール結果の違う側面を見ている**状態が成立しています。

Claude が iframe の origin として `77f710975aee5a81842747dfa064944a.claudemcpcontent.com` を割り当てていたのも発見でした。これは **MCP サーバーの URL から SHA-256 で計算された 32 文字ハッシュ**のサブドメインで、**セキュリティモデルが仕様レベルで定義されている**証拠です。公式仕様の `computeAppDomainForClaude()` そのままで、実装がブレていませんでした。

ちなみに Claude.ai のテーマ切替にも追従します。Light で立ち上げて、途中で Claude 側を Dark モードに切り替えると、iframe の中のダッシュボードもリアルタイムで dark に遷移します。`app.onhostcontextchanged` で受けた theme を React state に流しているだけですが、**ホスト ↔ iframe のテーマ同期が protocol レベルで定義されている**のは地味にすごいです。

## 今できないこと・知っておくべき制約

動くとはいえ現時点の制約もあります。

- **状態永続化なし**: 会話を閉じると UI の状態 (scroll 位置、入力中の値など) は消える
- **ホスト差分あり**: VS Code Copilot はフルスクリーン / PiP 未対応、ChatGPT は UI からのツール呼び出しが一部制限
- **CSP 宣言が厳しめ**: 外部リソースを使うなら全部宣言が必要で、**宣言漏れはサイレントに壊れる** (DevTools Console で初めて気づく)
- **cloudflared quick tunnel の URL は毎回変わる**: named tunnel を使えば固定できますが Cloudflare アカウントが要る

あと**画像を iframe 内で大きく描画すると、ホストがその分だけ縦の space を取る**ため、チャットのスクロールが長くなります。basic-host では 5000px 相当の iframe が確保されていて笑いました。

## おわり

MCP Apps は一言で言うと **「MCP ツールが HTML を返せるようになる」** という話ですが、実際に作ってみると、裏側にあるのは iframe と postMessage と CSP という **既存の Web 技術だけ**でした。新しいフレームワークを覚える必要は実はなくて、**Web フロントエンドの知識 + ちょっとしたプロトコル規約** で動きます。

学んだことをまとめると:

- **`content` と `structuredContent` の二本立てが本質**: LLM と UI が同じツール結果を別の側面で使う設計
- **CSP と DNS rebinding 保護が最大の罠**: 「ローカルで動いてたのに Claude で動かない」のギャップはほぼこの 2 つ
- **`useApp()` は React の慣例を意図的に破る**: プロトコル整合性のために再実行と unmount close をしない設計
- **Claude は stable origin を SHA-256 ハッシュで計算**: セキュリティモデルが仕様レベルで定義されている
- **Write Once, Run Anywhere は現実になりつつある**: Claude・ChatGPT・VS Code が同じ MCP サーバーを読む時代に入った

次回は **LangGraph のエージェントに MCP Apps の UI を組み込む** 話を書く予定です。`langchain-mcp-adapters` は MCP ツールを吸い上げますが **`_meta.ui.resourceUri` は扱わない**ので、自作ホストを書いて iframe を描画する必要が出てくる、という展開になります。LangGraph の `interrupt()` と MCP Apps の承認 UI をつなげて、**副作用 (DB UPDATE) を人間が UI で承認するエージェント** を作る予定です。

リポジトリはこちら: [`peintangos/mcp-apps-sample`](https://github.com/peintangos/mcp-apps-sample) (記事公開時に public 化予定)

おわり
