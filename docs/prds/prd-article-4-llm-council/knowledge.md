# Knowledge — Article 4: ChatGPT 主催の LLM 合議 MCP App

## Reusable Patterns

<!-- Document patterns that should be reused in later tasks or later PRDs. -->

- **rsync でプロジェクト派生** (2026-04-14): `rsync -a --exclude node_modules --exclude dist --exclude '.env' projects/article-3/ projects/article-4/` で Article 3 の構造をそのままコピーし、`.dockerignore` / `.env.example` 等の隠しファイルも含めて丸ごと派生できた。`node_modules` は後から `npm install` で再構築し、`dist` は `npm run build` で再生成、`.env` は secrets なので手動で再作成させる運用
- **Article 4 identity rewrite の境界線** (2026-04-14): "MCP サーバ層" (server.ts / src/main.tsx / .env.example) はプロジェクト派生の同一タスクで書き換え、"デプロイ層" (fly.toml / src/oauth.ts FIXED_CLIENT_ID) は Fly.io アプリ名 + OAuth client 登録と一体なので spec-005 に委譲した。この境界線は将来プロジェクト派生するときにも有効
- **Provider 抽象の generic 設計** (2026-04-14 / spec-001 task 2): `ProviderClient<M extends string = string>` と `AskOptions<M>` を generic にすることで、各 provider 実装側が狭い model union (`"sonnet" | "opus"` / `"flash" | "pro"`) を束縛できる。デフォルトを `string` にしているので council.ts 側は `ProviderClient[]` の異種配列として扱える (Claude と Gemini の `ask()` シグネチャが型的に互換)。ファイルは SDK 依存ゼロで `src/providers/types.ts` に閉じる
- **Claude Provider 移植の実測値** (2026-04-14 / spec-001 task 3-4 / curl スモーク): port 3099 で起動、`tools/call ask_claude {"question":"1+1 は? 30 文字以内で。","model":"sonnet"}` → `claude-sonnet-4-6` / 2895ms / "1+1は**2**です。" を取得。StreamableHTTPServerTransport の stateless モード (`sessionIdGenerator: undefined` + `enableJsonResponse: true`) では `initialize` ハンドシェイクなしに `tools/call` が直接通る。Claude の spec-002 計測値 (sonnet 1591ms) と同水準 (cold start 込みで若干遅い)
- **Article 4 のテスト基盤は vitest 1 本**: `projects/article-4/src/council.test.ts` に pure unit + mock orchestrator tests を集約。vite.config.ts は UI singlefile 用に root=src に切ってあるので、test 用には別 `vitest.config.ts` を作って root をプロジェクトに戻す。ralph.toml の `test_integration` に `cd projects/article-4 && npm test` を登録したので、今後 `/test` スキルで自動実行される
- **`vitest.config.ts` のコメントに glob pattern (`**\/*.test.ts` 的な表記) を書くと rolldown parser が parse error で落ちる** (2026-04-15 / spec-003 task 6-8 実装中に遭遇): rolldown は JSDoc コメント内の `**` を JSX 的に解釈しようとして Unexpected token を出す。回避策は該当箇所を通常の行コメント (`//`) にするか、glob 表現をコードブロック外で書かない。vite の rollup 版だと起きなかったので、rolldown 固有の挙動
- **`vi.mock` を使わず plain object で `ProviderClient` を mock** (2026-04-15 / spec-003 task 8 / advisor 指摘): council.ts が `ProviderClient` を loose generic で設計したおかげで、テストは interface を満たす plain object (`{name, ask: async () => ...}`) を返すヘルパー (`mockOkProvider` / `mockErrorProvider` / `mockThrowingProvider`) を書くだけで足りる。`vi.mock()` に頼るとテストが vitest ランタイムに癒着する + 抽象境界が壊れる。この "抽象境界をテストで再利用する" は loose generic 設計の最大のリターン
- **`mixed` consensus は実機の curl E2E では engineering が困難** (2026-04-15 / spec-003 task 9 / 3 回実測の結果): Claude sonnet と Gemini flash はどちらも絶対主張・事実誤りを **極めて確実に** reject するため、強い controversial 主張を `chatgpt_initial_answer` に入れると両モデルとも disagree に倒れ、穏当な主張を入れると両モデルとも agree に倒れる。"mixed" を生み出すには両モデルの判断が割れるような **真に gray area な論点** (文化・価値観依存 / 業界慣習差 / 政治/倫理的中立) が必要で、prompt engineering だけで狙い撃ちするのは現実的ではない。実測:
  - "1 + 1 = 3 です (どの教科書にも記載されている)" → 両モデル即 disagree、`unanimous_disagree`
  - "Go が圧倒的に優れている、メモリリーク絶対起きない" → 両モデル「絶対 X」の誇張を捉えて disagree、`unanimous_disagree`
  - "Rust vs Go 初学者は Go" → 両モデル agree/extend、`unanimous_agree`
  - **対策**: mixed 分岐は `src/council.test.ts` の mock unit test で網羅 (case (b) + partial スタンスのバリエーション)。E2E は "plumbing が動く" の保証として 2 系統で十分。記事 (spec-006) では「LLM は mixed を狙って出すのが難しく、真の合議分岐は unit test で網羅する設計が現実的」という洞察を書ける
- **E2E curl の determinism** (2026-04-15 / spec-003 task 9): 同じ入力 ("Rust/Go 初学者 + Go 推奨") を 2 回叩いて両方とも `unanimous_agree` を取得 (8107ms と 6623ms)。Claude sonnet と Gemini flash は stance 判定がほぼ deterministic で、reason 本文は微妙に揺らぐが stance カテゴリは揺らがない。これは council の再現性にとって重要な性質 — ユーザが同じ質問を再送して consensus が違う分岐に飛ぶと UX が壊れる
- **`start_council` tool handler の 4 分岐** (2026-04-15 / spec-003 task 5): validation 順序が重要で、上から順に:
  - (1) `chatgpt_initial_answer.trim() === ""` → `invalid_input` で即 return (API 呼び出し前のチェックで課金を避ける)
  - (2) `ANTHROPIC_API_KEY` と `GOOGLE_API_KEY` の両方を check、欠けたキー名を error.message に列挙して `unauthenticated` で return (合議は単独 provider では成立しないので両方必須)
  - (3) `runCouncil()` を呼ぶ (Promise.allSettled で throw しない保証)
  - (4) Round 2 の providerSpeakers (= chatgpt を除外した Round 2 speakers) が全員 error なら `isError: true` で transcript を structuredContent に入れる。`transcript.rounds[1].speakers[*].error` に各 provider の失敗内容が埋まっているので、UI は構造化された error を表示できる (advisor 指摘で stripped-down error object ではなく full transcript を返す設計に変更)
  - (5) 成功: `content[0].text = transcript.revision_prompt` / `structuredContent = transcript` のマッピング。revision_prompt は ChatGPT がそのまま Round 3 プロンプトとして読む、transcript は iframe UI が描画用に使う、という二面展開
- **zod schema に "silently ignored" な field を置かない** (2026-04-15 / spec-003 task 5 / advisor 指摘): spec-003 Implementation Step は `models?` を schema に含める指示だったが、現時点で council.ts が per-call model override をサポートしていない。ここで schema にだけ `models` を置くと、ChatGPT が tool spec を読んで `{claude: "opus", gemini: "pro"}` を送っても handler が silently discard する → "指定したのに効かない" の事故パターン。将来 model 切り替えが必要になったら、council.ts 側から wire-through した上で schema を追加する。"schema と handler の間で情報が欠落しない" のを contract として守る
- **`buildRevisionPrompt` の 3 系統テンプレート** (2026-04-15 / spec-003 task 4 / 将来のチューニング用リファレンス): `CouncilTranscript` + `consensus` から組み立てる Round 3 プロンプトの骨格。共通構造は `headerByConsensus` + `【ChatGPT の初案】` 引用 + `【Round 2 の独立評価】` (available speakers の引用) + `次の発話として...Round 3 (改訂版) 回答を日本語で提示してください` の tail instruction。consensus 別の **header 部分のみ** が分岐する:
  - `unanimous_agree` (改訂不要誘導): 「他 2 モデルも初案の結論に同意しました。改訂は原則不要です。/ Round 2 で補足視点 (extend) が出ている場合は 1〜2 行追記してください / 補足が無ければ『合議の結果、改訂は不要と判断しました』と一言添えて初案をそのまま提示してください」
  - `mixed` (標準改訂): 「Round 2 で Claude / Gemini の見解が分かれました。以下の論点を踏まえて、初案を改訂してください。/ 同意された部分は維持し、異論・補足は本文に織り込み、最終的な結論を明確に示してください」
  - `unanimous_disagree` (根本書き直し): 「他 2 モデルとも初案に重大な問題を指摘しています。根本から書き直してください。/ Round 2 で示された論点を踏まえ、初案の前提や結論を見直した上で、あらためて回答を組み立ててください」
  - **`unanimous_agree` でも Round 2 の引用は省略しない** (advisor 指摘): extend で出てくる補足視点は ChatGPT が回答を厚くするのに使える情報なので、consensus が "改訂不要" でも引用ブロックを削らない
  - **`runCouncil` は revision_prompt を `CouncilTranscript` に書くだけ**: tool 応答の `content` フィールドへの埋め込みは tool handler の責務 (task 5)。council.ts 側に tool response concerns を持ち込まないのが分離ポリシー
  - unit smoke 4 ケース (3 consensus 分岐 + zero-available edge) で 324〜540 chars の出力を確認
- **Gemini flash 2.5 にも hidden thinking がある (512 トークン予算で JSON truncate)** (2026-04-15 / spec-003 task 3 / 実 API E2E 中に発覚): spec-002 では gemini-2.5-pro の hidden thinking が 1024 トークンを食い尽くす問題を発見したが、flash でも同じことが起きる。Round 2 の prompt (~500 token) + hidden thinking + JSON 出力を 512 maxOutputTokens に押し込もうとすると、JSON が reason フィールド途中で truncate されて `parseStanceResponse` が null を返す。実測: `{"stance": "agree", "reason": "初案は、Goを初学者に` で切断 (latency 6318ms = 通常の 2-4 倍、thinking で消費したことを示唆)。**対策**: council.ts の `ROUND_2_MAX_TOKENS = 512` override を削除し、各 provider の `DEFAULT_MAX_TOKENS` (Claude 1024 / Gemini 4096) を使う。provider 固有の safe 値は provider 自身が知っている、という設計に寄せる。spec-003 technical note の「512 を目安」は spec 執筆時点の hidden thinking 未把握による見落としとして文脈メモ化
- **Round 2 の独立評価プロンプトは "literal example 必須"** (2026-04-15 / spec-003 task 3 / advisor 指摘): JSON schema だけを文章で説明しても Gemini flash は markdown code fence で包む傾向がある。`{"stance": "agree", "reason": "..."}` の literal example を prompt に含めることでフェンス率を下げる。parser 側も fence 剥がし fallback を持つが、fence なしでクリーンな JSON が返る方が費用効率が良い
- **stance 取得 E2E 実測値** (2026-04-15 / spec-003 task 3 / 実 runCouncil 往復):
  - 質問: "Rust と Go どちらを学ぶべきか (初学者向け)"、chatgpt_initial_answer: Go 推奨 80 字
  - Round 2 claude sonnet: `stance: "extend"` を返し reason で "所有権・借用モデルの挫折リスク明示" を補足
  - Round 2 gemini flash: `stance: "agree"` を返し reason で "文法シンプル・早期実用" の視点を追認
  - `computeConsensus` → `unanimous_agree` (claude extend + gemini agree = 全員 agree/extend)
  - total_latency_ms = 5985ms (Round 2 の Claude 単独 + Gemini 単独の max に近い、並列実行の効果が見える)
  - `content` は JSON 原文ではなく parsed reason に置換され、downstream で扱いやすい
- **`computeConsensus` の "2 人以上の成功" ガードを型で書く** (2026-04-15 / spec-003 task 2): consensus 計算の肝は "1 人だけ agree を unanimous_agree と名乗らない" こと。これを満たすため `withStance = speakers.filter((s): s is Speaker & { stance: Stance } => s.stance !== undefined)` で型ガード narrowing を使い、その後 `withStance.length < 2` で早期 return。これで `.every()` の対象は stance を持つ speaker だけに絞られ、"1 人しか stance を持たない状況で unanimous 判定" の事故経路を型レベルで閉じる。ロジックミスより構造ミスのほうが見つけやすい
- **task 2 時点では runCouncil の consensus は常に `"mixed"`** (2026-04-15): Round 2 の Speaker.stance は task 3 の stance parsing が入るまで必ず `undefined`。それを受けて `computeConsensus` は `withStance.length === 0 < 2` で必ず `"mixed"` を返す。これは仕様通り (spec-003 の scenario "利用可能な speaker が 0 人の場合は `consensus` を `"mixed"` に倒し") なので壊れてはいないが、読み手に "task 2 が動いていないのでは?" と思わせるリスクがある → council.ts の top JSDoc に明記して回避
- **Council Orchestrator スケルトン設計の 3 つの制約** (2026-04-15 / spec-003 task 1): `src/council.ts` を書く時に守る制約を明示的に封じた:
  - (1) **`final_answer` フィールドは存在しない**: Round 3 (改訂案) はサーバーで生成しないので、型レベルで "サーバーは最終回答を知らない" ことを表現する。これを足すとすぐに "Claude を synthesizer にして Round 3 をサーバー生成" の誘惑に負けるため、型で封じる
  - (2) **council.ts は `ProviderClient` (loose generic) だけに依存する**: `claudeProvider` / `geminiProvider` の具体の model union (`ClaudeModel` / `GeminiModel`) を import しない。これで council.ts は "異種 provider の配列を同形で扱える" 設計の実証体になる。代償として council.ts 側から model 切り替えを tight に縛れないが、それは server.ts の tool handler 側で解決する
  - (3) **`settledToSpeaker` で rejected Promise を network_error に畳む**: `Promise.allSettled` の branch を上流に漏らさず、Speaker の 2 状態 (content or error) に正規化する。これで Round 2 の downstream (consensus 計算 / UI 描画) は Promise の settle 形態を気にしなくて済む
- **Council Round 2 の`maxOutputTokens: 512` は flash/sonnet 前提** (2026-04-15 / spec-003 task 1 / advisor 指摘): spec-003 technical notes に "Round 2 は 512 を目安" とあるが、Gemini 2.5 pro の thinking budget 問題 (spec-002 gotcha) があるため、もし誰かが council.ts で default model を pro に上書きすると 512 では visible text 空になる可能性が高い。現在の council.ts は provider の default alias (claude=sonnet, gemini=flash) を暗黙に使うので安全だが、将来 "council で pro を使いたい" 要求が出たら 512 を拡大するか thinking budget を明示で絞る必要がある
- **Gemini Provider 実 API スモーク実測値** (2026-04-14 / spec-002 task 3 / 並列テストハーネス経由):
  - `flash` alias → `gemini-2.5-flash`: "1+1 は?" に対し 1657-3138ms / `response.text = "2"` or `"2です。"`。Google 側の初回コールドスタートで 3s 近く、ウォーム時は 1.6s 台。Claude sonnet (1.5s) の 1.0x-2.0x レンジ
  - `pro` alias → `gemini-2.5-pro`: "Rust と Go どちらを学ぶべきか 80 字以内で" に対し 8111ms / 79 文字の比較回答。**flash の約 5x のレイテンシ** なので合議の Round 2 を並列化しないと UX が壊れる (`Promise.allSettled` で設計した意味がここで実証)
  - `response.modelVersion` は Gemini 側も実値を返すので、`gemini.ts` の `response.modelVersion ?? modelId` フォールバックは通常経路では使われない (安全弁として残す)
  - 2 モデル同時に `ProviderClient` 抽象経由で呼び、Claude / Gemini 両方とも `Result.ok` → `{modelUsed, latencyMs, text}` 形式が揃うことを確認 (抽象の対称性 = council.ts 側は `ProviderClient[]` の異種配列として扱える)
- **Gemini 文字数制約への反応差** (2026-04-14 / spec-002 task 3): flash は "30 文字以内" に対して `"2"` の 1 文字で返すほど厳格に短縮する。pro は逆に末尾に `"(79字…)"` と自己カウントを付ける癖がある。Claude sonnet は `"1+1は**2**です。"` と自然な長さ。council の Round 2 stance プロンプトで "agree / extend / partial / disagree" を返させるときは、文字数指示ではなく **構造化出力の JSON schema** で縛るほうが 3 モデルの挙動差に振り回されない
- **Gemini pro の 503 "high demand" 揺らぎ** (2026-04-14 / spec-002 task 3): 実 API 疎通の 1 回目で pro が `{"error":{"code":503,"message":"This model is currently experiencing high demand..."}}` を返したが、同じ入力で即再試行すると成功。これは Google 側の一時的 throttling で、key の問題ではない。現 `gemini.ts` の実装では `ApiError.status >= 500` は最終 `network_error` branch に落ちる (union に `service_unavailable` がないため)。council.ts 側ではこれを "1 モデル失敗" として扱い、`Promise.allSettled` で他モデルを継続させれば合議自体は成立する。UI 表示用に "一時的な過負荷" 旨のコピーを足すかは spec-004 で判断
- **Gemini Provider 実装の設計対称性** (2026-04-14 / spec-002 task 1): `@google/genai@^1.50.0` を `projects/article-4/` にローカル追加し、`src/providers/gemini.ts` を `claude.ts` と完全ミラー (シンボル名: `MODEL_MAP` / `GeminiModel` / `DEFAULT_MAX_TOKENS` / `cachedClient` / `getClient()` / `askGemini()` / `geminiProvider`)。council.ts から `ProviderClient` 配列で扱うときに構造差がほぼゼロになるようにする。SDK 差分は内部 3 点に封じた:
  - (1) 呼び出し口: `clientResult.data.models.generateContent({ model, contents: question, config: { maxOutputTokens } })`。`contents` は `ContentListUnion` だが bare string 受理、`config.maxOutputTokens` がそのまま通る (Anthropic の `max_tokens` より意味が明瞭)
  - (2) テキスト抽出: `response.text` は **getter** で `string | undefined` を返すため、content blocks を走査する必要なし。ただし空文字 / undefined は `invalid_response` として扱わないと council 側で "正常だが text 空" の不定状態が生まれる
  - (3) エラー分類: `import { ApiError } from "@google/genai"` で SDK エクスポートの error class を直接 `instanceof` できる (`.status: number` 確定)。401/403 → `unauthenticated`, 429 → `rate_limited`, 他 4xx → `invalid_response`, 5xx/ネットワーク → `network_error` の 4 分岐。Claude と違い rate limit reset ヘッダを取る経路が SDK に無いので `resetAt` は省略 (optional)
  - fallback `response.modelVersion ?? modelId`: `modelVersion` は GenerateContentResponse で optional なので、実際のレスポンスが持たないケースに備えて alias マップ値をフォールバックにする (次タスクの実 API スモークで実値と alias の差分を確認する)
- ~~(pending) `ProviderClient` 抽象は Article 3 の `src/claude.ts` を踏襲しつつ、model identifier のマッピングと Result 型を各 provider の内部に閉じる~~ → spec-001 (Claude) + spec-002 (Gemini) の実装で確立済み。model alias マップは `MODEL_MAP` 定数、Result 型は `./types.js` の共通型を両実装が import する形で定着
- (pending) Article 4 は **3 ツール構成** (`ask_claude` / `ask_gemini` / `start_council`) で設計する。単発質問から合議モードまで段階的に使える導線を意識する
- (pending) Synthesizer 型合議は `src/council.ts` に Round 1-2 までを封じ、Round 3 (改訂案) はサーバーで生成せず `content` フィールドに埋めた改訂指示プロンプトで ChatGPT に書かせる
- (pending) **Round 2 は "批判" ではなく "stance-based 独立評価"**。各モデルは `agree` / `extend` / `partial` / `disagree` の 4 値 stance を表明する。サーバーは stance 集計から `consensus` (`unanimous_agree` / `mixed` / `unanimous_disagree`) を導出し、consensus に応じて 3 系統の改訂指示を `revision_prompt` として `content` に埋め込む
- (pending) UI はツール種別で分岐する: 単発応答 UI (Article 3 の `AnswerColumn` 流用) と 合議タイムライン UI (Consensus バッジ + stance タグ + consensus 連動フッター) の 2 系統
- (pending) **stance タグの色分けは accessibility 準拠**: 色だけでなくテキストラベル (agree / extend / partial / disagree) を併記する。色覚多様性への配慮と、モノクロスクショでも読み解ける記事化要件を両立させる

## Integration Notes

<!-- Capture cross-cutting behavior, dependencies, or setup details that are easy to forget. -->

- `@google/genai` は Google AI Studio の `GOOGLE_API_KEY` で動く。Vertex AI (Google Cloud 課金) は本 PRD では扱わない。取得元: <https://aistudio.google.com/apikey> (無料/従量枠で記事検証を完結させる前提)
- **`.env.example` は値なしの `KEY=` のみで統一する** (2026-04-14 / spec-002 task 2): ダミー値 (`sk-ant-api03-...` 等) を placeholder として置くと "本物っぽさ" で copy-paste 事故 / 実値の紛れ込みを誘発する。Article 4 では ANTHROPIC_API_KEY / GOOGLE_API_KEY 両方とも `KEY=` の空値 template に揃えた。dotenv の読み込み経路は `server.ts:1` の `import "dotenv/config"` で spec-001 時点から既に敷かれているため、`.env.example` は値の入口を宣言するだけで機能する
- `ANTHROPIC_API_KEY` と `GOOGLE_API_KEY` は両方必須。片方欠落時は tool handler で即時 `isError: true` を返し UI にエラー表示
- Article 3 で導入済みの OAuth 2.1 自前実装と Fly.io 設定はコピーして使う。Article 4 独自の認可要件はない
- Round 2 は `Promise.allSettled` で並列化。1 モデル失敗時も合議全体は継続する (FR-5)
- `ask_claude` は Article 3 とは別プロジェクトで独立実装する (Article 3 の `projects/article-3/ask_claude` は凍結)
- **spec-001 完了時点での `projects/article-4/` の状態** (2026-04-14): `ask_claude` tool は `src/providers/claude.ts` の `claudeProvider.ask()` 経由で実 Claude API と往復できる。旧 `src/claude.ts` は削除済み。3 ツール構成 (`ask_claude` / `ask_gemini` / `start_council`) のうち 1 本目 (`ask_claude`) が本番公開ツールとして稼働、残り 2 本は spec-002 / spec-003 で追加する
- **Fly.io と OAuth client はまだ Article 3 のまま** (2026-04-14): `fly.toml` は `app = "article-3-claude-second-opinion"` のまま、`src/oauth.ts` の `FIXED_CLIENT_ID` は `"article-3-mcp-client"` のまま。spec-005 で Article 4 用に書き換える前にデプロイを試すと Article 3 の本番アプリを上書きする危険があるため、**本ブランチの状態では `fly deploy` を絶対に実行しないこと**
- **`Result<T>` シャドーイング注意** (2026-04-14 / advisor 指摘 / 次タスク予告): spec-001 task 3 で `src/claude.ts` を `src/providers/claude.ts` に移植するとき、Article 3 の `src/claude.ts` は **ローカルに** `Result<T>` / `AskClaudeError` を定義している。移植先では `import type { Result, ProviderError, ProviderResponse } from "./types.js"` に差し替え、ローカル定義は完全に削除すること。`noUnusedLocals` では **同名のローカル型が import をシャドーする状況をサイレントに許してしまう** ため、目視で旧定義が残っていないか確認する

## Gotchas

<!-- Document pitfalls, edge cases, or failure modes. -->

- **Round 3 はサーバーで生成しない**: ChatGPT 本人が自分のチャットメッセージとして書く。これが案 Z の厳密な意味。Claude を synthesizer として再利用する案 (案 A) を選ぶと "ChatGPT の思考が磨かれる" というナラティブが "Claude が最終回答を書く" に変わってしまうため不採用
- **複数 tool call (案 C) も不採用**: ChatGPT に `start_council` → `submit_revision` の 2 段呼び出しを期待すると flaky。`start_council` の 1 回で合議を完結させる
- **Round 2 で批判を強制しない**: 批判前提プロンプトは LLM-as-critic の既知の 3 失敗モードを引き起こす:
  - (1) **Sycophancy flip**: 本来正しい初案に対して無理に欠点をひねり出し、誤指摘を生成する
  - (2) **Confabulated disagreement**: 合意が正解のとき "批判しろ" と言われてハルシネーション的反論を捏造する
  - (3) **Confirmation signal の喪失**: "全員同意" という最も価値ある結論が記録されなくなる

  回避策: Round 2 のプロンプトを独立評価型にし、`agree` / `extend` / `partial` / `disagree` の 4 値 stance を必ず返させる。同意も正当な出力として扱う
- **tool 応答の `content` フィールドは ChatGPT のプロンプト継続とみなされる**: `content` に埋める改訂指示は命令形 + Round 1-2 要点引用 + 期待フォーマットの 3 要素で構成する
- **単独 speaker の unanimous を名乗らない**: Round 2 で 1 モデルしか成功しなかった場合、その 1 人だけで `unanimous_agree` を名乗ると事実誤認を誘発する。`computeConsensus` は 2 人以上の成功を unanimous 判定の必須条件にする
- Gemini のトークン上限と Anthropic のトークン上限は異なる。`max_tokens` の下限合わせは `council.ts` 側で吸収する
- **Gemini 2.5 pro の thinking トークンが `maxOutputTokens` の配分を食い潰す** (2026-04-14 / spec-002 task 9 / ask_gemini curl 疎通中に発覚): `gemini-2.5-pro` は AUTOMATIC thinking budget で thinking トークンを生成するが、これは `maxOutputTokens` の枠内から消費される。一方 `response.text` getter は **thought parts を除外する仕様** なので、`maxOutputTokens=1024` だと短い質問でも thinking だけで使い切って visible text が空になり、`ask_gemini` が `invalid_response: "Gemini returned no text in the response."` を返す。再現手順は "Rust の最大の長所を 40 字以内で 1 つ挙げて" を pro で叩くだけ。対策として `gemini.ts` の `DEFAULT_MAX_TOKENS` を Claude の 1024 と分離して **4096** に引き上げた (claude.ts 側は 1024 のまま)。Provider ごとに safe なデフォルトが違うという事実を設計に反映。council.ts 側でこの定数を上書きしたくなったら `options.maxOutputTokens` で per-call 指定できる
- **Gemini pro + thinking のレイテンシは sonnet/flash の 10 倍級** (2026-04-14 / 実測): `ask_gemini pro` の 1 往復が 15187ms (thinking AUTOMATIC)。smoke の 8111ms と比べてさらに長いのは質問文が短く AUTOMATIC budget が "どこまで考えるか" を自分で決めた結果と推測。合議では Round 1-2 を **必ず並列化** しないと UX が壊れる (pro 15s + flash 2s + sonnet 1.5s を sequential で走らせると 18s、parallel なら 15s)。spec-003 の `Promise.allSettled` 設計はこの実測値が根拠
- ChatGPT の tool call で `chatgpt_initial_answer` を取りこぼすケースがあると合議が成立しない → input schema で `required` にし、handler で空文字チェック
- `ask_claude` / `ask_gemini` には改訂誘導ロジックは一切持たせない (合議専用機能の漏れ込みを防ぐ)

## Testing Notes

<!-- Record durable testing patterns, not one-off execution logs. -->

- Provider 単体: `ProviderClient.ask()` の往復を実 API でスモークし、model ID / レイテンシ / Result 型を記録する
- Council 単体: Round 2 の並列失敗ケース (Gemini 401、Claude rate limit)、両方失敗ケース、stance parse 失敗ケース、consensus 3 分岐 (unanimous_agree / mixed / unanimous_disagree) を mock で再現するテストを持つ
- E2E: curl で `ask_claude` / `ask_gemini` / `start_council` の 3 ツールをそれぞれ叩き、`start_council` では `CouncilTranscript` の Round 1-2 構造と `content` に埋まる改訂指示文を確認する
- 実機: ChatGPT で `start_council` → ChatGPT が実際にチャットに改訂応答を書くところまで確認する (この "ChatGPT が従ったかどうか" は人間が実機で観察する以外に検証手段がない)
