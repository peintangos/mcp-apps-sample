# Knowledge — Article 4: ChatGPT 主催の LLM 合議 MCP App

## Reusable Patterns

<!-- Document patterns that should be reused in later tasks or later PRDs. -->

- **rsync でプロジェクト派生** (2026-04-14): `rsync -a --exclude node_modules --exclude dist --exclude '.env' projects/article-3/ projects/article-4/` で Article 3 の構造をそのままコピーし、`.dockerignore` / `.env.example` 等の隠しファイルも含めて丸ごと派生できた。`node_modules` は後から `npm install` で再構築し、`dist` は `npm run build` で再生成、`.env` は secrets なので手動で再作成させる運用
- **Article 4 identity rewrite の境界線** (2026-04-14): "MCP サーバ層" (server.ts / src/main.tsx / .env.example) はプロジェクト派生の同一タスクで書き換え、"デプロイ層" (fly.toml / src/oauth.ts FIXED_CLIENT_ID) は Fly.io アプリ名 + OAuth client 登録と一体なので spec-005 に委譲した。この境界線は将来プロジェクト派生するときにも有効
- **Provider 抽象の generic 設計** (2026-04-14 / spec-001 task 2): `ProviderClient<M extends string = string>` と `AskOptions<M>` を generic にすることで、各 provider 実装側が狭い model union (`"sonnet" | "opus"` / `"flash" | "pro"`) を束縛できる。デフォルトを `string` にしているので council.ts 側は `ProviderClient[]` の異種配列として扱える (Claude と Gemini の `ask()` シグネチャが型的に互換)。ファイルは SDK 依存ゼロで `src/providers/types.ts` に閉じる
- **Claude Provider 移植の実測値** (2026-04-14 / spec-001 task 3-4 / curl スモーク): port 3099 で起動、`tools/call ask_claude {"question":"1+1 は? 30 文字以内で。","model":"sonnet"}` → `claude-sonnet-4-6` / 2895ms / "1+1は**2**です。" を取得。StreamableHTTPServerTransport の stateless モード (`sessionIdGenerator: undefined` + `enableJsonResponse: true`) では `initialize` ハンドシェイクなしに `tools/call` が直接通る。Claude の spec-002 計測値 (sonnet 1591ms) と同水準 (cold start 込みで若干遅い)
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

- `@google/genai` は Google AI Studio の `GOOGLE_API_KEY` で動く。Vertex AI (Google Cloud 課金) は本 PRD では扱わない
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
- ChatGPT の tool call で `chatgpt_initial_answer` を取りこぼすケースがあると合議が成立しない → input schema で `required` にし、handler で空文字チェック
- `ask_claude` / `ask_gemini` には改訂誘導ロジックは一切持たせない (合議専用機能の漏れ込みを防ぐ)

## Testing Notes

<!-- Record durable testing patterns, not one-off execution logs. -->

- Provider 単体: `ProviderClient.ask()` の往復を実 API でスモークし、model ID / レイテンシ / Result 型を記録する
- Council 単体: Round 2 の並列失敗ケース (Gemini 401、Claude rate limit)、両方失敗ケース、stance parse 失敗ケース、consensus 3 分岐 (unanimous_agree / mixed / unanimous_disagree) を mock で再現するテストを持つ
- E2E: curl で `ask_claude` / `ask_gemini` / `start_council` の 3 ツールをそれぞれ叩き、`start_council` では `CouncilTranscript` の Round 1-2 構造と `content` に埋まる改訂指示文を確認する
- 実機: ChatGPT で `start_council` → ChatGPT が実際にチャットに改訂応答を書くところまで確認する (この "ChatGPT が従ったかどうか" は人間が実機で観察する以外に検証手段がない)
