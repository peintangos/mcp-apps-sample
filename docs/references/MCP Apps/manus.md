# MCP Apps徹底調査レポート

**Author:** Manus AI  
**Date:** 2026-04-12

## エグゼクティブサマリー

**MCP Apps** は、Model Context Protocol における公式の拡張仕様であり、MCP サーバーがツール結果に紐づく**リッチでインタラクティブな UI** をホストへ配信できるようにする仕組みです。安定版の仕様では、拡張識別子を `io.modelcontextprotocol/ui` と定義し、`ui://` スキームの UI リソース、`_meta.ui.resourceUri` によるツールとの関連付け、`text/html;profile=mcp-app` による HTML 配信、そして `postMessage` 上の `ui/*` JSON-RPC ブリッジを中核に据えています。[1] [2]

この仕様の重要なポイントは、MCP Apps が**単なる埋め込み WebView ではなく、セキュリティと可搬性を意識した標準化レイヤー**であることです。ホストはサンドボックス化された iframe 内で UI を描画し、CSP、権限宣言、ツール可視性、監査可能なリソース配布という仕組みを通じて、任意 HTML の実行を安全に取り扱おうとします。[2] [3]

実装の実態はかなり明快で、**基盤技術はほぼ Web フロントエンドそのもの**です。HTML、CSS、JavaScript/TypeScript、iframe、CSP、Permission Policy、`postMessage`、ResizeObserver、Vite ベースのビルドなどが主役であり、React、Vue、Svelte、Solid、Preact、Vanilla JS といった複数の UI 技術を公式サンプルが横断的にサポートしています。[4] [5]

あなたの目的が「自分で何か作って記事にする」であれば、MCP Apps は非常に良い題材です。なぜなら、仕様そのものが新しく、かつ**“MCP に UI を持ち込む”** という構造的な変化を扱えるためです。さらに、実際に作り始めると、CSP、CORS、ホスト差分、バンドル戦略、OpenAI Apps SDK との関係といった、記事として価値の高い論点が自然に出てきます。[3] [6] [7]

## 1. MCP Apps とは何か

MCP Apps は、MCP ツールの出力をプレーンテキストから**対話可能な UI**へ拡張するための仕様です。公式概要では、ツールが UI リソースを宣言し、ホストがそれを会話内に描画できるようにすることが主眼とされています。[1]

仕様レベルで見ると、その構成要素は次のように整理できます。

| 層 | 主要要素 | 役割 |
| --- | --- | --- |
| 識別 | `io.modelcontextprotocol/ui` | MCP Apps 拡張そのものを識別する |
| 発見 | `ui://...` | UI リソースを通常の MCP リソースから区別する |
| 関連付け | `_meta.ui.resourceUri` | ツールと UI リソースを結びつける |
| 配信 | `resources/read` | UI HTML をホストへ返す |
| MIME | `text/html;profile=mcp-app` | 現時点の標準 UI コンテンツ型 |
| 通信 | `ui/*` JSON-RPC over `postMessage` | View と Host 間の双方向通信 |
| 分離 | sandboxed iframe | UI を安全に実行する |

この整理から分かる通り、MCP Apps は **UI フレームワークではなく、UI 実行契約の標準化**です。React 専用でも Vue 専用でもなく、HTML を返せるなら成立する、というのが本質です。[2] [4]

> “MCP Apps extends the Model Context Protocol to enable servers to deliver interactive user interfaces to hosts.” [2]

## 2. どのような技術で成り立っているのか

### 2.1 プロトコル技術

MCP Apps の最下層は **MCP + JSON-RPC 2.0** です。UI は iframe 内で動作しますが、概念的には「軽量な MCP クライアント」に近く、ホストに対して `initialize` 相当の握手を行い、その後 `tools/call` や `resources/read`、さらに UI 固有の `ui/*` メソッドを扱います。[2]

仕様で重要なのは、MCP Apps が既存の MCP を捨てず、**MCP の上に UI 向けの拡張名前空間を乗せている**点です。そのため、通常の MCP ツール呼び出しと UI 操作がきれいに接続されます。[2]

### 2.2 ブラウザ技術

MCP Apps の実装に必要な技術は、かなり素直に Web フロントエンドの知識へ還元できます。

| 技術領域 | MCP Apps での役割 |
| --- | --- |
| HTML5 | UI 本体の配信形式 |
| CSS | 見た目、テーマ追従、ホスト変数の適用 |
| JavaScript / TypeScript | UI ロジックとホスト通信 |
| `window.postMessage` | ホストとのブリッジ |
| iframe sandbox | 分離実行 |
| CSP | 外部通信・外部リソース読み込みの制御 |
| Permission Policy | camera / microphone / geolocation / clipboard などの権限制御 |
| ResizeObserver | View サイズ変化の通知 |

ここは記事化しやすいポイントです。読者に対して「MCP Apps は新しい名前だが、やっていることの大部分は Web 技術で理解できる」と整理すると、参入障壁を大きく下げられます。[2] [3]

### 2.3 ビルド技術

公式サンプルは、UI を**単一の HTML ファイルにバンドル**して MCP リソースとして返すパターンを強く採っています。React サンプルでも、Vite と `vite-plugin-singlefile` を使い、1 ファイル化した UI を `ui://...` リソースとして返す設計が説明されています。[5]

これは通常の SPA 配信とは違う発想です。MCP Apps では、ホストが `resources/read` を通じて UI を取得するため、相対パスで多数の静的ファイルをばらまくより、**自己完結した単一 HTML** のほうが扱いやすい場面が多いわけです。[2] [5]

## 3. アーキテクチャの全体像

MCP Apps の典型的なライフサイクルは次のように理解できます。

| ステップ | 何が起こるか |
| --- | --- |
| 1 | サーバーが UI 対応ツールを登録する |
| 2 | ツール定義の `_meta.ui.resourceUri` が UI リソースを指す |
| 3 | ホストがその `ui://` リソースを `resources/read` で取得する |
| 4 | ホストが HTML を sandboxed iframe にロードする |
| 5 | View が `ui/initialize` を送り、ホストがコンテキストを返す |
| 6 | ホストが `ui/notifications/tool-input` / `tool-result` を送る |
| 7 | View が必要に応じて `tools/call`、`ui/message`、`ui/update-model-context` などを使う |

このフローの美点は、**テンプレートとしての UI リソース**と、**実行時のツール入力・結果**が分かれていることです。これにより、ホスト側でのプリフェッチ、キャッシュ、監査、再利用がしやすくなります。[2]

## 4. ホストと UI の通信面

仕様では、UI 側は `postMessage` 上で JSON-RPC 2.0 を話し、ホストはそれを受けて MCP サーバー側へ橋渡しする設計です。[2]

特に重要な通信は次の通りです。

| メッセージ | 方向 | 意味 |
| --- | --- | --- |
| `ui/initialize` | View → Host | UI の初期化と能力宣言 |
| `ui/notifications/initialized` | Host/bridge 文脈 | 初期化完了通知 |
| `ui/notifications/tool-input` | Host → View | 最終的なツール引数 |
| `ui/notifications/tool-input-partial` | Host → View | ストリーミング途中の部分引数 |
| `ui/notifications/tool-result` | Host → View | ツール結果 |
| `tools/call` | View → Host → Server | UI からサーバーツールを実行 |
| `resources/read` | View → Host → Server | 追加リソース取得 |
| `ui/message` | View → Host | 会話へフォローアップメッセージを送る |
| `ui/update-model-context` | View → Host | 以後の推論に使う文脈を更新する |
| `ui/request-display-mode` | View → Host | inline / fullscreen / pip の変更を要求 |
| `ui/open-link` | View → Host | 外部 URL を開く要求 |

この通信面は、MCP Apps を単なる「表示用 iframe」ではなく、**会話参加者としての UI** にしている部分です。特に `ui/message` と `ui/update-model-context` は、UI の状態を次のターンのモデル推論に接続できるため、記事にするとかなり面白いテーマになります。[2]

## 5. セキュリティ設計はどこが肝か

MCP Apps を理解する上で、最も重要なのはセキュリティです。実装上の複雑さの多くは、機能ではなく**安全性のため**に存在します。[2] [3]

### 5.1 CSP と sandbox

仕様では、`_meta.ui.csp` に `connectDomains`、`resourceDomains`、`frameDomains`、`baseUriDomains` を宣言でき、ホストはこれを元に CSP を構築します。宣言がなければ、接続を原則拒否するかなり厳しいデフォルト CSP を適用しなければなりません。[2]

`connectDomains` は fetch/XHR/WebSocket の許可先、`resourceDomains` は script/style/image/font などの読み込み元、`frameDomains` はネストされた iframe の許可先に対応します。[2] [3]

### 5.2 CORS は別問題

公式の CSP/CORS ガイドが強調しているのは、**CSP と CORS は別物**という点です。CSP は「ブラウザが接続してよいか」を決め、CORS は「API サーバーがその Origin を許可するか」を決めます。つまり、`connectDomains` を正しく書いても、API 側が Origin を許可しなければ通信は失敗します。[3]

ここは実装記事の価値が出やすいところです。実際のデバッグでは、「CSP を開けたのにまだ呼べない」「CORS で落ちていた」という流れが非常に起きやすいはずです。[3]

### 5.3 stable origin と `domain`

一部ホストでは、`_meta.ui.domain` を通じて UI に**安定したサンドボックス origin** を与えられます。これは OAuth コールバックや API allowlist で有効です。ただし、仕様上このフィールドのフォーマットはホスト依存であり、Claude 系ではハッシュ由来のサブドメイン例が示されています。[2] [3]

### 5.4 権限宣言

`_meta.ui.permissions` では camera、microphone、geolocation、clipboardWrite を要求できます。ただし、ホストがそれをそのまま与えるとは限らず、UI 側は**権限がない場合のフォールバック**を考えるべきです。[2]

## 6. どんなフレームワークがあるのか

MCP Apps そのものはフレームワーク非依存ですが、公式リポジトリを見ると、少なくとも次の UI 実装パターンが実例として存在します。[4]

| フレームワーク / 実装方式 | 公式例の有無 | 向いているケース |
| --- | --- | --- |
| Vanilla JavaScript | あり | プロトコル理解を最優先するとき |
| React | あり | 最も一般的な選択肢。状態管理やコンポーネント資産を活かしやすい |
| Preact | あり | React ライクだがバンドルを軽くしたいとき |
| Vue | あり | Vue エコシステムに慣れているとき |
| Svelte | あり | 軽量で書き味の良いリアクティブ UI を作りたいとき |
| Solid | あり | 低オーバーヘッドかつ細粒度リアクティビティを重視するとき |

さらに React 版サンプルでは `useApp()` フックが案内されており、サーバーツール呼び出し、メッセージ送信、ログ送信、リンクオープンといった操作をフロントエンドから扱えるようになっています。[5]

つまりフレームワーク選定では、「MCP Apps にどれが対応しているか」よりも、**自分がどの程度バンドルサイズ、開発速度、状態管理、学習コストを重視するか**で考えるほうが自然です。[4] [5]

### 6.1 フレームワーク選定の判断軸

| 目的 | おすすめ |
| --- | --- |
| 仕様とブリッジを深く理解したい | Vanilla JS |
| まず 1 本作って記事にしたい | React |
| 軽量さを重視したい | Preact / Svelte / Solid |
| チーム資産を流用したい | 既存採用フレームワーク |
| UI よりプロトコル検証が主目的 | Vanilla JS or Preact |

あなたが「何かを作って記事にする」前提なら、**最初の 1 本は React か Vanilla JS** が書きやすいと思います。React は読者に馴染みがあり、Vanilla JS は MCP Apps の中身を説明しやすいからです。

## 7. SDK と実装補助の構造

公式リポジトリのサーバーヘルパーを見ると、DX 上の重要な API はかなり整理されています。[4]

| API / 仕組み | 役割 |
| --- | --- |
| `registerAppTool()` | UI と結びついたツールを登録する |
| `registerAppResource()` | UI リソースを登録する |
| `RESOURCE_MIME_TYPE` | `text/html;profile=mcp-app` を定数化 |
| `getUiCapability()` | クライアントが MCP Apps をサポートするか判定する |
| `App` クラス | UI 側の接続と通信を扱う |
| `useApp()` | React での利用を簡単にする |

特に面白いのは、`registerAppTool()` が新旧メタデータの互換性を吸収し、`getUiCapability()` が**プログレッシブエンハンスメント**を実現する点です。つまり、MCP Apps に対応したホストでは UI 付きツールを見せ、非対応ホストではテキスト版ツールだけを見せる、という分岐が取りやすいわけです。[4]

これは記事で強調すると良い点です。MCP Apps は「対応ホストでしか動かない特殊機能」というより、**対応ホストで UI が生え、そうでない環境でも最低限は動く**ように設計しやすいからです。[4]

## 8. OpenAI Apps SDK との関係

MCP Apps を理解するには、OpenAI Apps SDK との関係整理が非常に有効です。公式の移行ドキュメントと OpenAI Developers の説明を合わせると、**MCP Apps は OpenAI の埋め込みアプリ体験を、より標準化・可搬化したもの**として読むのが妥当です。[6] [7]

OpenAI は ChatGPT が MCP Apps をサポートすると明言しており、新規開発では標準キーと標準ブリッジを優先し、ChatGPT 固有の機能が必要なときだけ `window.openai` を使うよう推奨しています。[7]

比較すると次のようになります。

| 観点 | OpenAI Apps SDK の歴史的パターン | MCP Apps 標準 |
| --- | --- | --- |
| メタデータ | `_meta["openai/..."]` | `_meta.ui.*` |
| UI MIME | `text/html+skybridge` | `text/html;profile=mcp-app` |
| UI 呼び出し | `window.openai` 中心 | `ui/*` + MCP 中心 |
| 目標 | ChatGPT での実装最適化 | 複数ホスト間の可搬性 |

一方で、OpenAI は checkout、file upload、modal などのホスト固有拡張も残しています。したがって設計思想としては、**標準を土台にし、差別化機能だけ host-specific extension で足す**のがよい、という理解になります。[7]

## 9. Claude・その他ホストとの関係

Claude のドキュメントは、MCP Apps を実際に Claude Desktop などへ接続して試す流れを示しており、サンプルサーバーやクイックスタート、SDK ドキュメント、複数フレームワークの実装例へ導線を用意しています。また、UI 表示時にユーザー許可が求められる場合があることも明示されています。[8]

さらに ext-apps リポジトリのテストガイドでは、実運用ホストとして **Claude.ai、VS Code Insiders、Goose** などが挙げられています。つまり、MCP Apps の価値はすでに「特定ベンダー専用の UI」ではなく、**複数ホストにまたがる UI レイヤー**へ向かっています。[9]

ただし、ここで大事なのは**ホスト対応は能力交渉ベースの opt-in**であり、どのホストでも必ず同じように動くわけではないことです。表示モード、サンドボックス origin、権限付与、追加拡張はホスト差分になりえます。[2] [9]

## 10. 実際に作るなら、どういう開発フローがよいか

手を動かす観点では、公式の testing guide とサンプル構成が非常に参考になります。まずは reference host でローカル検証し、その後、実ホストへ持っていく二段構えが堅いです。[5] [9]

### 推奨フロー

| フェーズ | やること | 意図 |
| --- | --- | --- |
| 1 | 公式 basic サンプルを fork する | 仕様理解コストを下げる |
| 2 | UI を単一 HTML としてビルドする | MCP resource 配信に合わせる |
| 3 | `registerAppTool()` と `registerAppResource()` を実装する | ツールと UI を正しく紐づける |
| 4 | `basic-host` でローカル検証する | まずホスト差分を減らす |
| 5 | CSP/CORS を詰める | 外部 API や CDN を使う準備 |
| 6 | Claude など実ホストで試す | 現実のホスト挙動を確認する |
| 7 | host-specific extension の有無を試す | 記事ネタとして差分を取る |

`basic-host` は、ツール入力、ツール結果、メッセージ、モデルコンテキストを確認できるため、**学習用・デバッグ用として非常に価値が高い**です。[9]

## 11. 記事にしやすいテーマと企画案

あなたの背景を踏まえると、単なる仕様紹介よりも、**試作と失敗を含む実装記**のほうが読み応えが出るはずです。特に次の切り口が有望です。

| 企画案 | 強み |
| --- | --- |
| 「MCP に UI を持ち込む MCP Apps とは何か」 | 概念整理に強い |
| 「React で最初の MCP App を作る」 | 再現性が高い |
| 「OpenAI Apps SDK から MCP Apps へ移行してみた」 | 比較記事として読まれやすい |
| 「CSP/CORS で詰まりながら学ぶ MCP Apps」 | 実戦的で差別化しやすい |
| 「複数ホストで同じ MCP App を試す」 | 標準化の価値を示しやすい |
| 「Vanilla JS でブリッジを理解する」 | 学習コンテンツとして強い |

### 記事向きのデモ案

| デモ案 | ねらい | 技術的な見どころ |
| --- | --- | --- |
| インタラクティブ天気ダッシュボード | 最も説明しやすい | `tool-input` と `tool-result` の流れ |
| 地図付きスポット検索 | UI らしさが強い | `resourceDomains` / `connectDomains` / map SDK |
| PDF / 論文ビューア | 会話との親和性が高い | リソース読み込み、状態保持 |
| システムモニタ | リアルタイム感が出る | polling / resize / display mode |
| 予算アロケータ | UI の双方向性を見せやすい | `ui/update-model-context` の活用 |
| QR / ShaderToy 系 | 見栄えが良い | sandbox 内キャンバスや外部アセット |

個人的には、**「地図付き検索」か「予算アロケータ」** が記事向きです。単に見た目が良いだけでなく、UI を使う意味、会話と UI の役割分担、モデル文脈更新の面白さまで説明しやすいからです。

## 12. 何を学ぶと理解が深まるか

MCP Apps を深ぼる際、優先順位は次の順が良いと思います。

| 優先度 | 学ぶ対象 | 理由 |
| --- | --- | --- |
| 高 | `ui://`、`_meta.ui.resourceUri`、`resources/read` | まず配信モデルを理解する必要がある |
| 高 | `ui/initialize` と各種 `ui/notifications/*` | ランタイムの理解に直結する |
| 高 | CSP / CORS / sandbox / permissions | 実装の難所だから |
| 中 | display modes / host context / theming | UX を整えるのに必要 |
| 中 | host capability negotiation | 可搬性設計に必要 |
| 中 | OpenAI / Claude との差分 | 実運用で効く |
| 低〜中 | host-specific extensions | 最初の 1 本には必須ではない |

## 13. 結論

MCP Apps は、MCP エコシステムにおける **“UI の標準層”** と見なすのが最も正確です。重要なのは、これが独自 UI フレームワークではなく、**Web 技術をベースにした可搬な埋め込みアプリ規約**だということです。[1] [2] [7]

そのため、深ぼるべき論点は単純な API 一覧ではありません。むしろ、**ツールと UI をどう分離するか、ホスト差分をどう吸収するか、セキュリティをどう宣言的に扱うか、会話と UI をどう協調させるか**にあります。[2] [3] [4]

記事を書く前提なら、以下の方針がおすすめです。まずは React か Vanilla JS で小さな MCP App を 1 つ作る。次に `basic-host` で観測しながら動作を理解する。最後に Claude や ChatGPT 系ホストで試し、標準部分とホスト固有部分を切り分けて記事にする。この順序なら、単なる紹介で終わらず、**「標準仕様を実装してみて見えたこと」** という強いアウトプットにできます。[5] [7] [8] [9]

## 14. あなた向けの具体的な次アクション

もし今すぐ着手するなら、私は次の順番を勧めます。

| 順番 | 次アクション | 期待される成果 |
| --- | --- | --- |
| 1 | `basic-server-react` か `basic-server-vanillajs` を読む | 最短で全体像を掴める |
| 2 | 1 つだけ UI 付きツールを自作する | `resourceUri` と UI 配信を理解できる |
| 3 | 外部 API を 1 つつなぐ | CSP/CORS の現実を体験できる |
| 4 | `basic-host` で入力・結果・メッセージを観察する | ランタイム理解が深まる |
| 5 | 実ホストで試す | 記事に必要な比較軸が得られる |
| 6 | 「標準」「ホスト差分」「ハマりどころ」で記事を構成する | 良い技術記事になる |

必要なら次の段階として、あなた向けに以下も続けて作れます。

1. **記事の構成案（見出しレベルで完成形まで）**  
2. **作るデモのテーマ選定**  
3. **MCP App の最小実装コードひな形**  
4. **React 版 / Vanilla JS 版の比較表**  
5. **CSP/CORS でハマらないためのチェックリスト**

## References

[1]: https://modelcontextprotocol.io/extensions/apps/overview "MCP Apps Overview | Model Context Protocol"
[2]: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx "SEP-1865: MCP Apps: Interactive User Interfaces for MCP"
[3]: https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/csp-cors.md "CSP & CORS | ext-apps"
[4]: https://github.com/modelcontextprotocol/ext-apps "ext-apps repository | Model Context Protocol"
[5]: https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-server-react "basic-server-react example | ext-apps"
[6]: https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/migrate_from_openai_apps.md "Migrating from OpenAI Apps SDK to MCP Apps SDK"
[7]: https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt "MCP Apps compatibility in ChatGPT | OpenAI Developers"
[8]: https://claude.com/docs/connectors/building/mcp-apps/getting-started "Get started with MCP Apps | Claude.ai Documentation"
[9]: https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/testing-mcp-apps.md "Test Your MCP App | ext-apps"
