# Product Requirements Document (PRD) — Article 4: ChatGPT 主催の LLM 合議 MCP App

## Branch

`ralph/article-4-llm-council`

## Overview

ChatGPT の会話内で `start_council` ツールを呼び出すと、MCP サーバーが **ChatGPT 初案 (Round 1) + Claude / Gemini による並列独立評価 (Round 2、stance 付き)** の 2 ラウンドをサーバー側で確定的に回し、その合議ログを iframe に描画する。その後 ChatGPT が tool の `content` に埋め込まれた consensus 連動の改訂指示を読み、**自分のチャットメッセージとして改訂案 (Round 3) を出力する** — これが Article 4 の核となる「Synthesizer 型合議」の最終形である。そしてそれを題材にした Zenn 記事を執筆・公開する。Article 3 の "1 対 1 越境" を発展させ、**複数 LLM を一つの意思決定プロセスに束ね、ChatGPT 自身の思考が他 LLM の独立評価でどう磨かれるか (あるいは全員同意で磨く必要がないと判明するか) を読者に見せる** "合議プロトコル" を実証する。

## Background

Article 3 (`prd-article-3-claude-second-opinion`) で「ChatGPT の中で Claude に聞ける」という **1 対 1 のクロスベンダー越境** を完成させた。しかし Article 3 はワンショットで回答を並べて終わりで、**LLM どうしを本気で協調させる** 話にはまだ踏み込めていない。

このギャップを埋めるのが Article 4 の役目である。読者と筆者が次に知りたいのは以下の 2 点:

1. **複数往復させたい** — 1 回の問い合わせで終わりではなく、モデル同士が互いの回答を読んで意見を更新できるか
2. **合議で最終決定したい** — 2 モデル比較ではなく、ChatGPT 自身の回答を含む 3 者合議で "磨かれた最終回答" を出せるか

これは Article 2 の LangGraph / state machine 知見、Article 3 のクロスベンダー越境パターンの両方を前提にしたメタ応用であり、**シリーズの自然な第 4 章** に相当する。記事のナラティブは「ChatGPT は単独の話者ではなく、他 LLM を呼び出す "議長" になれる」という新しいメンタルモデルを読者に渡すことを目指す。

## Product Principles

- **Article 3 を壊さない** — Article 3 は "1 対 1 越境" として完結させ、Article 4 はその成果物 (`projects/article-3/`) を **読み込み元のリファレンス** として扱う。Article 4 は `projects/article-4/` 配下で独立実装
- **サーバー側は Round 1-2 までを確定的に制御、Round 3 は ChatGPT に委ねる** — ChatGPT は議長兼 Round 3 の話者。サーバーは Round 1-2 の進行役で、合議ログと改訂指示を tool 応答として渡す。ChatGPT の tool call loop に依存しないので壊れにくく、かつ "ChatGPT 自身が改訂する" というナラティブも守れる
- **合議は Synthesizer 型の 2 ラウンド + ChatGPT 改訂の Round 3** — 合議プロトコルとしては 3 段階だが、サーバーが生成責任を持つのは Round 1-2 のみ。Round 3 の話者は必ず ChatGPT 本人。Debate / MoA / 自由討論は Out of Scope
- **Round 2 は "批判" ではなく "独立評価 (stance 表明)"** — Claude / Gemini に批判を強制すると sycophancy flip や confabulated disagreement という既知の失敗モードが起きる。Round 2 は各モデルに `agree` / `extend` / `partial` / `disagree` の 4 値 stance を表明させ、**同意も正当な出力として扱う**。全員同意なら Round 3 の改訂は不要という結論も許容する
- **ChatGPT 自身の回答は anchor ではなく "改訂候補"** — 初案 (Round 1) → 他 LLM の独立評価 (Round 2) → consensus に応じて ChatGPT 本人が改訂するか全員同意を受け入れるか (Round 3、チャット出力) という stance 駆動フロー (案 Z 改) を厳密に採用する
- **差分は記事で手動比較、iframe は合議ログに徹する** — iframe の責務は Round 1-2 のタイムライン表示と "改訂を促すフッター" まで。Round 1 と Round 3 の差分は Zenn 記事内で筆者が実機ログから手動比較する (iframe 内 diff UI は実装しない)
- **公式 SDK で直接つなぐ** — `@anthropic-ai/sdk` + `@google/genai` を併用し、Provider 抽象は最薄に抑える。OpenRouter は記事の Appendix コラムで「代替案」として言及のみ

## Scope

### In Scope

- 新プロジェクト `projects/article-4/` を Article 3 の構成 (`@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps/server` + React + Vite) から派生させて作成
- 薄い Provider 抽象 `src/providers/{types,claude,gemini}.ts` を導入し、Article 3 の `src/claude.ts` 相当をリファクタして取り込む
- Gemini クライアント `src/providers/gemini.ts` を `@google/genai` (Google AI Studio 版) で実装、`GOOGLE_API_KEY` から認証
- 合議オーケストレータ `src/council.ts` を実装。Round 1 (ChatGPT 初案の記録) + Round 2 (Claude / Gemini 並列 **独立評価 + stance 表明**) の 2 ラウンドを JSON で記録し、Round 2 の stance 集計から `consensus` を導出する
- **3 本のツール** を登録: `ask_claude` (Claude 単発質問), `ask_gemini` (Gemini 単発質問), `start_council` (合議モード)
- `ask_claude` / `ask_gemini` は Article 3 の `ask_claude` と同じ単発質問 UX を踏襲し、side-by-side UI の軽量版を iframe に描画 (Article 3 の `AnswerColumn` 相当を流用可能)
- 合議ログ `CouncilTranscript` を `start_council` の `structuredContent` に格納、UI に Round 1-2 の全発言を表示
- tool 応答の `content` フィールドに ChatGPT 向けの改訂指示プロンプトと Round 1-2 要約を格納し、ChatGPT がチャットメッセージとして改訂案 (Round 3) を書くよう誘導する (`start_council` 限定)
- React + `react-markdown` で 2 種類の UI を実装: (a) `start_council` 用の **タイムライン型 UI** (Round 1 = 1 カラム, Round 2 = 2 カラム) + 改訂案はチャット側に出ることを示すフッター、(b) `ask_claude` / `ask_gemini` 用の **単発応答 UI** (Article 3 の `AnswerColumn` 流用)
- ChatGPT (Plus/Pro) の Custom Connector に登録して End-to-End 検証
- Article 3 で既に導入済みの OAuth 2.1 自前実装と Fly.io デプロイ経路を再利用 (使い回せる範囲を spec で明示)
- 実機検証スクショ (ChatGPT 内での iframe 描画 + ChatGPT の改訂チャットメッセージ + basic-host フォールバック)
- Zenn 記事ドラフト執筆 → レビュー → 公開 (Round 1 と Round 3 の差分比較は記事内で筆者が手動整理)

### Out of Scope

- **Debate / MoA 2-layer / Round-Robin 自由討論** — 本 PRD は Synthesizer 型の Round 1-2 + ChatGPT 改訂のみを扱う
- **iframe 内の diff UI** — Round 1 と Round 3 の差分表示は記事側で筆者が手動比較する。diff ライブラリは本 PRD では導入しない
- **サーバー側での Round 3 生成** — Round 3 の話者は ChatGPT に固定。Claude / Gemini を synthesizer として再利用する案 (案 A) は採用しない
- **`submit_revision` 等の第 2 tool call** — ChatGPT に複数 tool 呼び出しを強要すると flaky になるため、`start_council` の 1 回呼び出しで合議を完結させる (案 C は不採用)
- **単発質問ツールでの改訂誘導** — `ask_claude` / `ask_gemini` は単発応答のみで、`revision_prompt` や合議フローは一切持たない。改訂誘導は `start_council` 限定の機能
- **ラウンド数の動的制御** — 収束判定や early stop は入れない。Round 1-2 の 2 段に固定
- **合議の途中介入 (Human-in-the-loop)** — それは Article 2 の LangGraph 領域。本 PRD では扱わない
- **ストリーミングレスポンス** — 各モデル呼び出しは `stream: false` に限定。UI はラウンド完了単位で更新
- **4 モデル以上の合議** — ChatGPT + Claude + Gemini の 3 者に固定。Llama / o1 / Mistral 追加は将来の派生記事で扱う
- **OpenRouter 経由の実装** — 記事の Appendix コラムで「代替案」として 1 段落紹介するのみ、実装コードには入れない
- **Prompt Caching / Extended Thinking / Vertex AI** — Anthropic / Google の高度機能は別記事で
- **双方向協調 (Claude / Gemini から ChatGPT を呼ぶ)** — ChatGPT → (Claude + Gemini) → ChatGPT の単方向フローに限定
- **Article 3 の実装を書き換えること** — Article 3 は既公開 PRD として凍結。Article 4 は独立プロジェクトで再実装

## Target Users

### 記事読者

- Article 3 を読み終えた読者 (連続ナラティブで読ませる)
- **ChatGPT Plus / Pro ユーザー** かつ **Anthropic API + Google AI Studio** の両方に加入している (または加入予定の) エンジニア
- プロンプトエンジニアリング / AI 活用業務で **複数 LLM を組み合わせて最終決定したい** 需要を持つ人
- Article 2 の LangGraph 経験者で、より軽量な合議パターンを探している人
- "MoA / LLM Council" 系の論文 (e.g. Wang et al. 2024 "Mixture-of-Agents") を手を動かして試したい人

### プロジェクトコントリビュータ

- 記事の著者本人 (実装 + 執筆)
- 将来の拡張者 (4 モデル以上への拡張 / Debate 型への分岐)

## Use Cases

1. **技術選定の合議**: ChatGPT に「Rust と Go どちらを学ぶべきか」と聞いた後、`start_council` で ChatGPT 初案 + Claude / Gemini の stance 付き独立評価 + (consensus に応じた) ChatGPT 改訂案を得る
2. **コードレビューの 3 者合議**: ChatGPT が書いたコードに対して Claude と Gemini が独立に評価 (stance 表明) し、partial / disagree が含まれる場合のみ ChatGPT が改訂案を出す
3. **アーキテクチャ決定の強化**: デザイン判断において 3 モデルの stance と理由を並べ、全員同意なら初案を確定、異論があれば改訂を誘導する
4. **回答の品質計測**: 同じ質問を 3 モデルに投げ、改訂が行われたケース・行われなかったケースの両方を記事で定量/定性評価
5. **プロンプトエンジニアリングの研究**: 他モデルの stance 付き評価をコンテキストに入れたとき ChatGPT の回答スタイルがどう変わるか (または変わらないか) を観察

## Functional Requirements

- FR-1: MCP サーバーは 3 つのツールを登録する:
  - **`ask_claude`**: Article 3 と同一パターンの Claude 単発質問ツール。`{ question, chatgpt_answer?, model? }` を受け取り、Claude の応答を単純に返す。Article 4 では Provider 抽象 (`src/providers/claude.ts`) 経由で実装する
  - **`ask_gemini`**: `ask_claude` と対称の Gemini 単発質問ツール。`{ question, chatgpt_answer?, model? }` を受け取り、Gemini の応答を返す
  - **`start_council`**: 合議モードのエントリポイント。下記 FR-2 の schema で Round 1-2 を実行し、ChatGPT に改訂を誘導する
- FR-2: `start_council` の input schema は `{ question: string, chatgpt_initial_answer: string, models?: { claude?: "sonnet" | "opus"; gemini?: "flash" | "pro" } }`。`chatgpt_initial_answer` は **必須** で、ChatGPT 自身の初案を明示的に受け取る
- FR-3: サーバーは以下 2 ラウンドを順に実行する (Round 3 はサーバー側では実行しない):
  - **Round 1 — 初案の記録**: `chatgpt_initial_answer` をそのまま Round 1 として記録。新規生成は行わない
  - **Round 2 — 並列独立評価**: Claude と Gemini に `{ question, chatgpt_initial_answer }` を渡し、**並列に** (`Promise.allSettled`) 独立評価を取得する。プロンプトは「批判せよ」ではなく「独立した評価者として率直に判定せよ。同意 / 補足 / 部分同意 / 不同意 のいずれでも構わない、無理に欠点を捻り出す必要はない」という方向で、応答は **必ず `stance` (`agree` / `extend` / `partial` / `disagree` の 4 値) と理由本文の 2 要素** を返す構造化フォーマットで受け取る
  - **Round 3 の扱い (consensus 分岐)**: サーバー側では Round 3 を生成しない。その代わり、Round 2 の stance 集計に応じて **3 系統の改訂指示** を `content` フィールドに埋め込む:
    - **Unanimous agree/extend**: 「他 2 モデルも初案に同意しました (理由: ...)。改訂は原則不要です。補足視点があれば 1-2 行だけ追記してください」
    - **Mixed (partial / disagree を含む)**: 「Round 2 の論点を踏まえ、初案を改訂してください」
    - **Unanimous disagree**: 「他 2 モデルとも初案に重大な問題を指摘しています。根本から書き直してください」
- FR-4: Provider 抽象 `ProviderClient` を定義し、`claude` / `gemini` の 2 実装を同一インターフェースで呼び出せること。将来の provider 追加はこの抽象の実装 1 ファイルで完結する
- FR-5: 各モデル呼び出しは `Result<T>` 型で結果またはエラー (`unauthenticated` / `rate_limited` / `network_error` / `invalid_response`) を返す。1 モデルが失敗しても合議は継続し、該当モデルの発言は UI で "failed" マーカー付きで表示される
- FR-6: `structuredContent` に `CouncilTranscript = { question; chatgpt_initial_answer; rounds: Round[]; consensus; revision_prompt; total_latency_ms; models_used }` 形式の合議ログを含める。`rounds` は Round 1-2 の 2 要素のみ。各 `Round` は `{ round_number; role; speakers: Speaker[] }`、各 `Speaker` は `{ provider; model; content?; stance?; error?; latency_ms }`。`stance` は `"agree" | "extend" | "partial" | "disagree"` の 4 値 enum で、Round 2 の Claude / Gemini にのみ設定される (Round 1 の ChatGPT speaker は `stance` を持たない)。`consensus` は `"unanimous_agree" | "mixed" | "unanimous_disagree"` の 3 値で、サーバーが Round 2 の stance 集計から導出する (`agree` + `extend` のみ → `unanimous_agree`、`disagree` のみ → `unanimous_disagree`、それ以外 → `mixed`)。`revision_prompt` は `content` に埋まる改訂指示テンプレートのコピー (監査用)
- FR-7: Round 2 の Claude / Gemini 呼び出しは **並列** に実行し、レイテンシを抑える (`Promise.allSettled`)
- FR-8: UI は **縦タイムライン** レイアウトで、Round 1 と Round 2 の 2 段を上から順に描画する。Round 1 は 1 カラム (ChatGPT 初案)、Round 2 は 2 カラム (Claude / Gemini の独立評価)。**タイムライン最上部に `Consensus バッジ`** を固定表示し (`Consensus: 3/3 agree` / `Mixed (1 agree, 1 partial)` / `Split (all disagree)` 等)、各 `Speaker` ブロックには stance タグを大きく表示する。**タイムライン末尾の固定フッター** は consensus に応じて文言を切り替える: `unanimous_agree` なら「初案が全員同意を得ました。改訂は原則不要ですが、補足があれば下のチャットに 1-2 行記してください」、それ以外なら「改訂案 (Round 3) はこの下のチャットメッセージに出力されます」
- FR-9: UI は Markdown をレンダリング (`react-markdown`) する。**diff 表示ライブラリは導入しない** (差分比較は記事側で筆者が手動整理)
- FR-10: UI フッターに合計レイテンシと各モデルのモデル名・個別レイテンシを表示する
- FR-11: `ANTHROPIC_API_KEY` と `GOOGLE_API_KEY` の両方を環境変数から取得する (ハードコード禁止)。片方でも未設定の場合はツール呼び出し段階で `isError: true` を返し、UI でどちらが未設定か明示する
- FR-12: Article 3 で導入済みの OAuth 2.1 自前実装経路と Fly.io デプロイ経路は **そのまま再利用** する。Article 4 独自の認可要件は追加しない
- FR-13: ChatGPT の Custom Connector に登録して End-to-End 動作することを確認する。**動作確認は 3 点で行い、結果は記事で正直に報告する**: (1) iframe に Round 1-2 と Consensus バッジが描画される (これは決定的、合否 gate として機能する)、(2) ChatGPT が tool 応答の `content` 内の consensus 連動改訂指示を読み、consensus に応じた挙動 (unanimous_agree なら補足のみ、それ以外なら改訂案) をチャットに出力するかを観察・記録する (ChatGPT の内部挙動に依存する probabilistic 現象のため pass/fail ではなく観察記録として扱う)、(3) 改訂案が Round 2 の stance 付き評価 (特に partial / disagree speaker の理由) を実際に反映しているかを定性評価して記事に記録する (これも probabilistic)。iframe 描画が動かない場合は basic-host で (1) のみ代替検証し、(2)(3) は ChatGPT でのみ観察可能な制約として記事に明記する
- FR-14: Zenn 記事は以下を含む — Article 3 からの連続性、合議プロトコルの選定 (Synthesizer × Round 1-2 + ChatGPT 改訂) 理由、Round 3 をサーバーで生成しない判断 (案 A / 案 C を排除した理由) の明示、**Round 2 で批判を強制しない判断 (sycophancy flip / confabulated disagreement / confirmation signal 喪失 の 3 失敗モードの解説と、stance-based 独立評価への切り替え理由)**、Provider 抽象の設計、Gemini 統合 (`@google/genai`)、stance enum と consensus 分岐ロジック、Consensus バッジ付きタイムライン UI、ChatGPT 検証、**Round 1 (初案) と Round 3 (ChatGPT 改訂案) の手動差分比較 (定量 + 定性)**、OpenRouter を Appendix コラムで紹介

## UX Requirements

- タイムラインは縦スクロール。各ラウンドは明確なヘッダ (`Round 1 — ChatGPT 初案`, `Round 2 — Claude / Gemini 独立評価`) と、ラウンド番号の大きなラベルを持つ
- **タイムライン最上部に Consensus バッジを固定表示**。`unanimous_agree` は緑、`mixed` は黄、`unanimous_disagree` は赤を基調とし、`3/3 agree` / `Mixed (agree, partial)` / `Split (all disagree)` のようなカウント表記を含める
- 各 Speaker ブロックの上部に **stance タグ** (`agree` / `extend` / `partial` / `disagree`) を大きく表示する。stance ごとに色分け (緑 / 青 / 黄 / 赤)
- タイムライン末尾に **固定フッター** を置き、consensus に応じて文言を切り替える: `unanimous_agree` なら「全員同意を得ました。改訂は原則不要ですが、補足があれば下のチャットに 1-2 行」、それ以外なら「Round 3 — ChatGPT 改訂案は下のチャットメッセージに出力されます」
- Round 2 の 2 カラムは iframe 幅 `< 640px` で縦並びにフォールバック
- 各 Speaker ブロックにはプロバイダアイコン (テキストバッジで OK) とモデル名、個別レイテンシをヘッダに表示
- Markdown コードブロックはシンタックスハイライト
- ローディング中は進行中ラウンドに skeleton、未開始ラウンドは薄いグレーで "pending" 表示
- エラー時は該当 Speaker に構造化エラー (code + message) を赤背景で表示。合議全体は停止せず他 Speaker の結果は通常表示する
- Article 3 の `ThemeContext` パターンを踏襲してダーク / ライトテーマに追従
- **diff 表示はしない** (iframe は合議ログに徹する方針)。Round 1 と Round 3 の差分は記事側で筆者が手動整理する

## System Requirements

- Node.js 20 LTS 以上
- TypeScript 6.x
- `@modelcontextprotocol/sdk` (Article 3 と同バージョン帯)
- `@modelcontextprotocol/ext-apps` v1.x
- `@anthropic-ai/sdk` (Article 3 で導入済みのバージョンを踏襲)
- `@google/genai` (Google AI Studio SDK、最新 stable)
- Express 5 + cors
- React 19 + `react-markdown` (diff 表示ライブラリは導入しない、FR-9 準拠)
- Vite 8 + `vite-plugin-singlefile`
- `tsx` (TypeScript 直起動)
- `cloudflared` または Fly.io (Article 3 の OAuth/Fly.io 経路を再利用)
- ChatGPT Plus / Pro (MCP Apps Custom Connector 利用可能なプラン)
- Anthropic API アカウント (`ANTHROPIC_API_KEY`、従量課金)
- Google AI Studio アカウント (`GOOGLE_API_KEY`、Gemini の無料枠で記事検証を完結可能)
- **Article 3 が導入済みの依存 / パターンをそのまま流用することを前提に、新規導入は最小限にとどめる**
- **Claude Max / Google One サブスクでは API は使えない** 点を記事で明記する

## Milestones

| Milestone | Description | Target Date |
|-----------|-------------|-------------|
| M0: PRD + spec 分割 | spec-001〜spec-006 の骨組み確定 | 2026-04-21 |
| M1: Provider 抽象 + Gemini 疎通 | spec-001〜spec-002 完了 — Article 3 から派生、Gemini 公式 SDK で実応答取得 | 2026-05-03 |
| M2: 合議オーケストレータ完成 | spec-003 完了 — Round 1-2 合議が curl で動作、`revision_prompt` が `content` に埋まる | 2026-05-10 |
| M3: タイムライン UI 完成 | spec-004 完了 — basic-host で Round 1-2 が描画され、"改訂案は下のチャットへ" フッターが出る | 2026-05-17 |
| M4: ChatGPT で End-to-End | spec-005 完了 — ChatGPT 会話内で iframe 描画 + ChatGPT が改訂案をチャットに出力 | 2026-05-24 |
| M5: Zenn 記事公開 | spec-006 完了 | 2026-05-31 |
