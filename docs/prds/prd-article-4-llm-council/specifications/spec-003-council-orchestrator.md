# spec-003: Synthesizer 型 Round 1-2 合議オーケストレータ + stance-based 独立評価 + consensus 分岐

## Overview

`src/council.ts` に、**Round 1 (ChatGPT 初案の記録) + Round 2 (Claude / Gemini 並列独立評価 + stance 表明)** の 2 ラウンド構成の Synthesizer 型合議を実装する。Round 2 の各モデルには「批判ではなく独立評価」を求め、`agree` / `extend` / `partial` / `disagree` の 4 値 stance と理由本文を構造化フォーマットで返させる。サーバーは Round 2 の stance 集計から `consensus` (`unanimous_agree` / `mixed` / `unanimous_disagree`) を導出し、その結果に応じて **3 系統の改訂指示** を `content` フィールドに埋め込む。Round 3 (改訂案) はサーバーで生成せず ChatGPT 本人に書かせる。`start_council` ツールを server.ts に登録し、`CouncilTranscript` を `structuredContent` に返す。Round 2 は `Promise.allSettled` で並列化し、部分失敗でも合議を継続する。

## Acceptance Criteria

```gherkin
Feature: stance-based 独立評価合議オーケストレータ (Round 1-2 + consensus 分岐)

  Background:
    spec-001 / spec-002 が完了し、Claude / Gemini Provider が `ProviderClient` として利用可能
    `ANTHROPIC_API_KEY` と `GOOGLE_API_KEY` が設定済み

  Scenario: 正常系 — Round 1-2 成功 + stance 集計 + 改訂指示の埋め込み
    Given `start_council({ question: "Rust と Go どちらを学ぶべきか", chatgpt_initial_answer: "..." })` を呼ぶ
    When オーケストレータが Round 1-2 を順に実行する
    Then `CouncilTranscript.rounds` の配列長が 2 になる
    And Round 1 の speakers は ChatGPT 1 人のみで、`content` は `chatgpt_initial_answer` がそのまま入り `stance` は持たない
    And Round 2 の speakers は Claude と Gemini の 2 人で、両方 `content` と `stance` が入る
    And `stance` は `"agree" | "extend" | "partial" | "disagree"` のいずれか
    And `CouncilTranscript.consensus` に `"unanimous_agree" | "mixed" | "unanimous_disagree"` のいずれかが入る
    And `CouncilTranscript.revision_prompt` に consensus に応じた改訂指示テンプレートが入る
    And tool 応答の `content` フィールド (ChatGPT が読むプレーンテキスト) に Round 1-2 サマリ + 明示的な改訂指示 (consensus 分岐済) が埋まっている
    And `total_latency_ms` は Round 2 の並列実行を反映する
    And `final_answer` フィールドは `CouncilTranscript` に存在しない

  Scenario: Unanimous agree — 改訂不要を誘導する
    Given Round 2 で Claude と Gemini の両方が `stance: "agree"` (または `"extend"`) を返す
    When オーケストレータが consensus を計算する
    Then `consensus` が `"unanimous_agree"` になる
    And `revision_prompt` に「他 2 モデルも初案に同意しました。改訂は原則不要です。補足視点があれば 1-2 行だけ追記してください」相当の文言が入る
    And tool 応答の `content` にその文言がそのまま埋まる

  Scenario: Mixed — 標準の改訂誘導
    Given Round 2 で Claude が `stance: "agree"`、Gemini が `stance: "partial"` を返す
    When オーケストレータが consensus を計算する
    Then `consensus` が `"mixed"` になる
    And `revision_prompt` に「Round 2 の論点を踏まえ、初案を改訂してください」相当の文言が入る
    And Round 2 の各 speaker の stance と理由が改訂指示の中に引用される

  Scenario: Unanimous disagree — 根本書き直しを誘導する
    Given Round 2 で Claude と Gemini の両方が `stance: "disagree"` を返す
    When オーケストレータが consensus を計算する
    Then `consensus` が `"unanimous_disagree"` になる
    And `revision_prompt` に「他 2 モデルとも初案に重大な問題を指摘しています。根本から書き直してください」相当の文言が入る

  Scenario: Round 2 の構造化出力が壊れていた場合
    Given Claude が stance フィールドを欠いたレスポンスを返した
    When オーケストレータが parse する
    Then その speaker の `stance` は `undefined` になり、`error.code` に `"invalid_response"` が入る
    And consensus 計算では欠損した speaker は除外される (利用可能な speaker のみで判定)
    And 利用可能な speaker が 0 人の場合は `consensus` を `"mixed"` (デフォルト) に倒し、`content` には注意書きを添える

  Scenario: Round 2 の部分失敗でも合議は継続する
    Given Gemini API が 401 を返す
    And Claude API は正常応答し `stance: "agree"` を返す
    When `start_council(...)` を呼ぶ
    Then Round 2 の Gemini speaker は `error.code: "unauthenticated"` が入り stance は未設定
    And Round 2 の Claude speaker は通常通り content と stance が入る
    And consensus は Claude の stance のみから導出され、単独の `"unanimous_agree"` とはせず `"mixed"` に倒す (1 モデルだけでは unanimous を名乗れない)
    And tool 応答の `content` に埋められる改訂指示は、利用可能な speaker (Claude) の発言のみを引用する
    And `isError` は `false`

  Scenario: Round 2 が両方失敗した場合
    Given Claude API も Gemini API も失敗する (401 / 500)
    When `start_council(...)` を呼ぶ
    Then `isError: true` が返る
    And `structuredContent.error` に両 Speaker の失敗内容がまとめて入る

  Scenario: `chatgpt_initial_answer` が空文字
    Given `start_council({ question: "X", chatgpt_initial_answer: "" })` を呼ぶ
    When handler が入力検証する
    Then `isError: true` が返る
    And `error.code` が `"invalid_input"` で `message` に理由が入る

  Scenario: API キー両方欠落
    Given `ANTHROPIC_API_KEY` も `GOOGLE_API_KEY` も未設定
    When `start_council(...)` を呼ぶ
    Then `isError: true` が返る
    And どちらのキーが欠落しているか `message` に明示される

  Scenario: 改訂指示テンプレートが ChatGPT に届く
    Given 正常系の合議結果 (consensus = mixed)
    When ChatGPT が tool 応答を受け取る
    Then `content` フィールドに consensus に応じた改訂指示が含まれる
    And 指示文には Round 1 (初案) と Round 2 (Claude / Gemini の stance + 理由) の要点が引用されている
    And 指示文は iframe の `structuredContent` とは別に、ChatGPT のプロンプトとして直接機能する
```

## Implementation Steps

- [x] `src/council.ts` を新規作成し、`runCouncil(input, providers): Promise<CouncilTranscript>` を実装する (スケルトン: Round 1 passthrough + Round 2 `Promise.allSettled` 並列呼び出し + `settledToSpeaker` ヘルパーで rejected/Result.ok 両枝を吸収、`total_latency_ms` は `Date.now()` ベース、tsc ✅ + vite build ✅、2026-04-15)
- [ ] `CouncilTranscript` / `Round` / `Speaker` / `Stance` / `Consensus` の型定義を `src/council.ts` に置き、server.ts から import する (`final_answer` は持たない、`Speaker.stance?` と `CouncilTranscript.consensus` を持つ) (**進捗**: task 1 で orchestrator 骨格型、task 2 で `Stance` / `Consensus` と `Speaker.stance?` / `CouncilTranscript.consensus` を追加。残: server.ts 側の import は task 5 で実施、2026-04-15)
- [x] `Stance = "agree" | "extend" | "partial" | "disagree"` と `Consensus = "unanimous_agree" | "mixed" | "unanimous_disagree"` を enum として定義する (string literal union として定義、`Speaker.stance?: Stance` / `CouncilTranscript.consensus: Consensus` を既存型に追加、`computeConsensus(speakers)` ヘルパーを実装 (2 人以上の成功を unanimous 判定の必須条件、stance を持つ speaker を型ガードで narrowing)、`runCouncil()` 内で Round 2 の speakers を渡して計算、tsc ✅ + vite build ✅、2026-04-15)
- [x] Round 1 は `chatgpt_initial_answer` をそのまま 1 speaker として記録する (新規 API 呼び出しなし、`stance` は undefined) (`runCouncil()` 内の round1 生成箇所で実装、`{ name: "chatgpt", content: input.chatgpt_initial_answer }` のみ、API 呼び出しゼロ、2026-04-15)
- [x] Round 2 のプロンプトを「批判」ではなく「独立評価」指向で設計する。必ず「同意も正当な出力であり、欠点を無理に捻り出す必要はない」と明示する (`buildRound2Prompt()` に独立評価指示 + 4 値 stance 説明 + 「批判を求めていない、同意も正当」を明記、2026-04-15)
- [x] Round 2 の構造化出力フォーマットを指定する (JSON モード または強い「以下の形式で答えよ」プロンプト): `{ "stance": "agree|extend|partial|disagree", "reason": "..." }` (strict JSON prompt に literal example `{"stance": "agree", "reason": "..."}` を含め、SDK native structured output は `ProviderClient` loose abstraction を壊すので不採用、2026-04-15)
- [x] Round 2 は Claude / Gemini に `{ question, chatgpt_initial_answer }` をコンテキスト付きで渡し、`Promise.allSettled` で並列実行する (task 1 で並列化済み、task 3 で prompt に `chatgpt_initial_answer` を渡す経路を実装、E2E で 5985ms の並列実行を実測、2026-04-15)
- [x] 各 speaker のレスポンスを parse し、stance を抽出する。parse 失敗時は `error.code = "invalid_response"` にする (`parseStanceResponse()` 実装 = JSON.parse → markdown fence 剥がし → 4 値 stance + 非空 reason の runtime 検証、`applyStanceParsing()` で speakers に `.map()` 適用、parse 失敗時は `content` に原文を残し `error: invalid_response` を追加、unit smoke 8/8 pass + 実 API で claude/gemini 両方から parseable JSON を取得確認、2026-04-15)
- [x] 各 speaker の失敗時 (`Result.ok === false`) は `error` を speaker に入れ、round 自体は続行する (task 1 の `settledToSpeaker()` で実装済み、`Promise.allSettled` で Round 自体は継続、2026-04-15)
- [ ] Round 2 の両方が失敗した場合は `CouncilTranscript` を完成させつつ tool 応答を `isError: true` で返す
- [x] `computeConsensus(speakers): Consensus` ヘルパーを実装する。ロジック:
  - 利用可能な speaker が 2 人以上 かつ 全員 `agree` / `extend` のみ → `unanimous_agree`
  - 利用可能な speaker が 2 人以上 かつ 全員 `disagree` → `unanimous_disagree`
  - それ以外 (mixed / 部分失敗 / parse 失敗) → `mixed`
  (型ガード `(s): s is Speaker & { stance: Stance } => s.stance !== undefined` で `withStance` を narrow してから `.every()` で判定、`runCouncil()` の return 部分で `computeConsensus(round2.speakers)` を呼ぶ、task 3 で stance parse が実装されるまで実行時は常に `"mixed"` を返す、2026-04-15)
- [x] `buildRevisionPrompt(transcript, consensus)` ヘルパーを実装し、consensus に応じて 3 種類の改訂指示文を生成する (pure function として実装、`CouncilTranscript.revision_prompt: string` を必須フィールドに追加、`headerByConsensus` で 3 分岐 (unanimous_agree=改訂不要誘導 / mixed=論点踏まえ改訂 / unanimous_disagree=根本書き直し)、Round 1 初案 + Round 2 available speakers の引用 (`stance !== undefined && content !== undefined` で filter) + 「次の発話として改訂案を日本語で」の tail instruction、`formatSpeakerQuote` helper で `【Claude / stance: 同意 + 補足】content` 形式に整形、unit smoke 4/4 pass (3 分岐 + zero-available edge case)、2026-04-15)
- [x] tool 応答の `content` フィールドに `buildRevisionPrompt` の出力を埋め込む。`structuredContent` には `CouncilTranscript` (`stance` / `consensus` / `revision_prompt` も含む) をそのまま入れる (start_council handler で成功時は `content[0].text = transcript.revision_prompt` / `structuredContent = transcript` にマップ、E2E curl で consensus=unanimous_agree の revision_prompt が content に埋まり full transcript が structuredContent に入ることを実測、2026-04-15)
- [x] `start_council` ツールの zod schema (`question` / `chatgpt_initial_answer` 必須、`models` 任意) を定義して server.ts に登録する (zod schema に `question: string` と `chatgpt_initial_answer: string` を必須で登録、**`models` は advisor 指摘で今 commit から除外** (silently ignored な field を schema に置くと ChatGPT がそれを使おうとして値が無視される事故になる、将来 model 切り替えが必要になったら wire-through で追加)、`registerAppTool` は ask_claude / ask_gemini と同じ構造で統一、2026-04-15)
- [x] tool handler 側で API キー存在確認・`chatgpt_initial_answer` 空文字チェックを行い、問題があれば `isError: true` で `structuredContent.error` を返す (validation 順序: (1) `chatgpt_initial_answer.trim() === ""` → `invalid_input` / (2) `ANTHROPIC_API_KEY` と `GOOGLE_API_KEY` の両方必須、欠けたら `unauthenticated` で欠落 key 名を message に列挙 / (3) `runCouncil()` 実行後に Round 2 の両 speakers が error なら `isError: true` で transcript を structuredContent に入れる、invalid_input パスは E2E curl で実測確認、2026-04-15)
- [x] `ask_claude` / `ask_gemini` は spec-001 / spec-002 で登録済みの本番公開ツールとしてそのまま残す。`start_council` は 3 本目のツールとして追加する (`tools/list` で 3 ツール (`ask_claude` / `ask_gemini` / `start_council`) 公開を curl 実測、既存 tool に一切触れずに start_council を追加、2026-04-15)
- [x] curl で `start_council` を叩き、Round 1-2 の JSON 構造、`stance` / `consensus` フィールド、`content` に埋まる consensus 分岐済み改訂指示文が FR-3 / FR-6 の形で返ることを確認する (port 3098 stateless curl で 3 回実測: (1) "Rust/Go 初学者" → unanimous_agree / 8107ms / 6623ms の 2 回 deterministic、(2) "1+1=3" → unanimous_disagree / 3986ms、(3) "メモリリーク絶対起きない" も unanimous_disagree / 7899ms (mixed を狙ったが 2 モデルとも絶対主張を確実に reject してしまい mixed は E2E 実機再現困難)。mixed 分岐は `src/council.test.ts` の 25 unit tests に網羅されているので E2E 不足の補完ができている、revision_prompt header は consensus 分岐ごとに正しく切り替わることを 2 系統 (agree/disagree) で確認、`structuredContent.rounds[1].speakers[*].stance` / `consensus` / `total_latency_ms` の full transcript 形を確認、2026-04-15)
- [x] mock テストを追加: (a) unanimous_agree ケース、(b) mixed ケース、(c) unanimous_disagree ケース、(d) 部分失敗ケース、(e) 両方失敗ケース、(f) stance parse 失敗ケース (`projects/article-4/src/council.test.ts` を新規作成し 6 ケース全て網羅、追加で network throw ケースと total_latency_ms のアサートを同梱、`vi.mock` を使わず `ProviderClient` interface を満たす plain object mock (`mockOkProvider` / `mockErrorProvider` / `mockThrowingProvider`) で検証、`parseStanceResponse` 7 ケース + `computeConsensus` 7 ケース + `buildRevisionPrompt` 3 ケース も同じファイルに集約、合計 25 test cases、vitest を devDep に追加 + `vitest.config.ts` 作成 + `package.json` test script 追加、ralph.toml の `test_integration` を `cd projects/article-4 && npm test` に設定、2026-04-15)
- [x] `revision_prompt` の 3 系統の例を `knowledge.md` に記録する (将来のチューニング用) (unanimous_agree / mixed / unanimous_disagree の header 部分 3 系統 + 共通構造 (header + 初案引用 + Round 2 引用 + tail instruction) を `knowledge.md` のリファレンスセクションに追記、unit smoke 4 ケースで 324〜540 chars の出力を確認済み、2026-04-15)
- [ ] Review (build check + lint + `/code-review`)

## Technical Notes

- **Round 2 を "批判" ではなく "独立評価" にする理由**: 批判を強制するプロンプトは LLM-as-critic の既知の 3 失敗モード (sycophancy flip / confabulated disagreement / confirmation signal の喪失) を引き起こす。同意も正当な出力として扱うことで、初案が正しいケースで Round 3 が正しい初案を劣化させる逆効果を防ぐ
- **Round 3 をサーバーで生成しない理由**: ユーザーとの合意 (案 B) により、Round 3 の話者は必ず ChatGPT 本人。サーバーが Claude / Gemini を synthesizer として再利用すると "ChatGPT の思考が磨かれる" というナラティブが "Claude が最終回答を書く" に変わってしまう
- **構造化出力の取り方**: Claude は `tool_use` 的な JSON モードが使える。Gemini は `responseSchema` (Google AI Studio) がある。両者で統一した形で `{ stance, reason }` を取れるよう、`src/council.ts` 側で吸収する。難しければ "以下の JSON 形式で答えよ" という strong prompt + `JSON.parse` の fallback 実装でも可
- **`revision_prompt` の設計指針**: ChatGPT が tool 応答を読んで "次の発話として自分の改訂案を書きたくなる" プロンプトを書く。`content` フィールドは ChatGPT のプロンプトの一部として解釈されるため、命令形 + Round 1-2 の要点引用 + 期待フォーマットの 3 要素を入れる。consensus に応じて命令部分を切り替えるのが本 spec の肝
- **単独 speaker の unanimous を名乗らない理由**: Round 2 で 1 モデルしか成功しなかった場合に「unanimous_agree」と判定すると実態を誤魔化すため、2 人以上の成功を必須条件とする
- `max_tokens` は Round 2 で 512 を目安にする (stance + reason で足りる)
- `total_latency_ms` は `Date.now()` ベースで計測し、並列効果を `knowledge.md` に記録する
