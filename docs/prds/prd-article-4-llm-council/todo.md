# TODO — Article 4: ChatGPT 主催の LLM 合議 MCP App

<!--
Keep tasks in priority order.
Each unchecked task should be small enough to complete in one `/implement` run or one Ralph iteration.
Mark completed tasks with `- [x]` instead of removing them.
-->

- [x] spec-001: `projects/article-4/` を Article 3 からコピー派生し、`package.json` / `tsconfig.json` / `vite.config.ts` を Article 4 用に書き換える (+ Article 4 identity 整合性のため `server.ts` / `src/main.tsx` / `.env.example` の識別子も書き換え、`fly.toml` と `src/oauth.ts` は spec-005 に委譲、2026-04-14)
- [x] spec-001: `src/providers/types.ts` に `ProviderClient` インターフェースと `Result<T>` / `ProviderError` 型を定義する (generic M パラメータで model union を束縛可能、SDK 依存ゼロ、2026-04-14)
- [x] spec-001: `src/providers/claude.ts` に Article 3 の `src/claude.ts` 相当を `ProviderClient<ClaudeModel>` 実装として移植した (旧 `src/claude.ts` は git rm、`Result<T>` シャドーイングなし、2026-04-14)
- [x] spec-001: `server.ts` の `ask_claude` tool を `claudeProvider.ask()` 経由に書き換え、curl で port 3099 の article-4 サーバ → 実 Claude API 往復を確認 (model_used="claude-sonnet-4-6", latency_ms=2895、2026-04-14)
- [x] spec-001: Review (build check ✅ + tsc ✅ + lint N/A + advisor 2 パス、2026-04-14)
- [x] spec-002: `@google/genai` を依存に追加し、`src/providers/gemini.ts` に `ProviderClient` 実装を書く (`@google/genai@^1.50.0`、`ApiError.status` ベースのエラー 4 分類、`response.text` 空チェック + `modelVersion` フォールバック、tsc ✅ + vite build ✅、2026-04-14)
- [x] spec-002: `GOOGLE_API_KEY` を `.env.example` に追加し dotenv 経由で読み込む経路を整える (`.env.example` に ANTHROPIC_API_KEY の直後に追加、`import "dotenv/config"` は spec-001 で server.ts:1 に既設なので追加コード変更なし、2026-04-14)
- [ ] spec-002: Gemini flash / pro の実 API スモークテストを実施し、model ID とレイテンシを `knowledge.md` に記録する
- [ ] spec-002: `server.ts` に `ask_gemini` tool を本番公開ツールとして登録し、curl で実 Gemini 応答が取れることを確認する
- [ ] spec-002: Review (build check + lint + `/code-review`)
- [ ] spec-003: `src/council.ts` に Round 1-2 構成の Synthesizer 型合議オーケストレータを実装する (Round 3 はサーバーで生成しない)
- [ ] spec-003: `Stance` / `Consensus` 型と `computeConsensus()` ヘルパーを実装する (2 人以上の成功を unanimous 判定の必須条件にする)
- [ ] spec-003: Round 2 のプロンプトを "批判" ではなく "独立評価 + stance 表明" で設計し、構造化出力 `{ stance, reason }` を取得する
- [ ] spec-003: `buildRevisionPrompt(transcript, consensus)` を実装し、consensus 3 分岐 (unanimous_agree / mixed / unanimous_disagree) で 3 系統の改訂指示文を生成する
- [ ] spec-003: `start_council` ツールの zod schema と handler を登録し、`CouncilTranscript` (stance / consensus / revision_prompt を含む) を `structuredContent` に、改訂指示文を `content` に入れる
- [ ] spec-003: Round 2 を `Promise.allSettled` で並列化し、部分失敗でも合議が継続することをテストする
- [ ] spec-003: Round 2 が両方失敗したケースは `isError: true` で返すことをテストする
- [ ] spec-003: mock テストで consensus 3 分岐 + 部分失敗 + stance parse 失敗の 5 ケースを網羅する
- [ ] spec-003: curl 経由の E2E スモークで Round 1-2 / stance / consensus / 改訂指示文 3 系統が `content` に埋まることを確認する
- [ ] spec-003: `ask_claude` / `ask_gemini` は既存のまま残し、`start_council` を 3 本目として追加する (削除しない)
- [ ] spec-003: Review (build check + lint + `/code-review`)
- [ ] spec-004: `src/main.tsx` でツール種別 (`ask_claude` / `ask_gemini` / `start_council`) を判定し描画コンポーネントを分岐する
- [ ] spec-004: Article 3 の `AnswerColumn` を `SingleAnswerView.tsx` として流用し、`ask_claude` / `ask_gemini` 両方で使えるようにプロバイダをパラメータ化する
- [ ] spec-004: `src/components/ConsensusBadge.tsx` / `RoundTimeline.tsx` / `SpeakerCard.tsx` (stance タグ付き) / `RevisionFooter.tsx` (consensus 連動文言) を実装する
- [ ] spec-004: mock data で consensus 3 バリエーション (unanimous_agree / mixed / unanimous_disagree) × 3 ツールのプレビューを手元確認する
- [ ] spec-004: basic-host で 3 ツールすべての実応答が正しく描画されることを確認する
- [ ] spec-004: Review (build check + lint + `/code-review`)
- [ ] spec-005: Article 3 の OAuth 2.1 設定を Article 4 用に複製し、`fly.toml` を Article 4 アプリ名に書き換える
- [ ] spec-005: Fly.io にデプロイし、`ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` / OAuth secrets を設定する
- [ ] spec-005: ChatGPT Plus の Custom Connector に登録し、3 ツール全てが呼び出せることを実機確認する
- [ ] spec-005: `start_council` で iframe 描画 + ChatGPT が改訂案をチャットに出すところまで実機確認し、スクショを保存する
- [ ] spec-005: Review (build check + lint + `/code-review`)
- [ ] spec-006: Zenn 記事のドラフトを執筆する (Article 3 からの連続ナラティブ + 3 ツール導線 + 設計判断の言語化 + OpenRouter Appendix を含める)
- [ ] spec-006: Round 1 (初案) と Round 3 (ChatGPT 改訂チャット応答) の手動差分比較を定量 + 定性で書く
- [ ] spec-006: `/docs-review` 相当で記事の事実確認とコード再現性を検証する
- [ ] spec-006: 記事を公開し、リンクを `knowledge.md` と `roadmap.md` に記録する
- [ ] spec-006: Review (`/code-review` + 最終読み合わせ)
