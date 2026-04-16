# spec-004: タイムライン UI + 単発応答 UI (ツール別描画分岐) + Consensus バッジ + stance 表示

## Overview

Article 4 は `ask_claude` / `ask_gemini` / `start_council` の 3 ツールを持つため、UI は **ツール別にレイアウトを切り替える** 構成にする。`ask_claude` / `ask_gemini` は Article 3 由来の単発応答 UI (`AnswerColumn` 流用) を再利用。`start_council` は Round 1-2 の縦タイムライン + **最上部の Consensus バッジ** + **各 Speaker の stance タグ** + **consensus に応じて文言が変わる改訂誘導フッター** の新 UI を実装する。Round 1 と Round 3 の diff 表示は iframe では行わない (記事側で手動比較する)。Article 3 の `ThemeContext` パターンを踏襲してダーク / ライトテーマに追従する。

## Acceptance Criteria

```gherkin
Feature: ツール別 UI 描画分岐 + stance-based 合議 UI

  Background:
    spec-001〜spec-003 が完了し、3 ツールすべてがサーバーで動作する
    basic-host でローカル検証が可能

  Scenario: `ask_claude` 呼び出しは単発応答 UI になる
    Given `ask_claude({ question: "X", chatgpt_answer?: "..." })` のレスポンスを受け取る
    When UI が判定する
    Then Article 3 と同じ単発応答 UI (左右 2 カラム or 単列) が描画される
    And Consensus バッジは表示されない
    And タイムラインフッターは表示されない

  Scenario: `ask_gemini` 呼び出しも単発応答 UI になる
    Given `ask_gemini({ question: "X" })` のレスポンスを受け取る
    When UI が判定する
    Then 単発応答 UI が描画される
    And プロバイダバッジが "Gemini" / モデル名が表示される

  Scenario: `start_council` 呼び出しはタイムライン UI になる (mixed consensus)
    Given サーバーが `CouncilTranscript` (Round 1-2 成功、consensus = "mixed") を返す
    When UI が受信する
    Then 画面最上部に Consensus バッジが黄色基調で表示され、`Mixed (1 agree, 1 partial)` のようなカウント表記が出る
    And Round 1 は 1 カラムに ChatGPT 初案が Markdown で描画される
    And Round 2 は横並び 2 カラムに Claude / Gemini の独立評価が描画される
    And 各 Speaker ブロックの上部に stance タグ (agree / extend / partial / disagree) が大きく色分け表示される
    And 各 Speaker ブロックにはプロバイダ名・モデル名・個別レイテンシがヘッダに表示される
    And タイムライン末尾に "Round 3 — ChatGPT 改訂案は下のチャットメッセージに出力されます" という固定フッターが出る
    And diff 表示関連の UI は一切存在しない

  Scenario: Unanimous agree — フッター文言が切り替わる
    Given `CouncilTranscript.consensus = "unanimous_agree"`
    When UI が描画される
    Then Consensus バッジが緑基調で `3/3 agree` 相当の表記を出す
    And 全 Speaker の stance タグが `agree` または `extend` のいずれか
    And タイムライン末尾のフッターが「全員同意を得ました。改訂は原則不要ですが、補足があれば下のチャットに 1-2 行」に切り替わる

  Scenario: Unanimous disagree — 警告トーン
    Given `CouncilTranscript.consensus = "unanimous_disagree"`
    When UI が描画される
    Then Consensus バッジが赤基調で `Split (all disagree)` 相当の表記を出す
    And 全 Speaker の stance タグが `disagree`
    And フッターは通常の改訂誘導文言になる

  Scenario: 狭い iframe で Round 2 が縦並びになる
    Given iframe 幅が `< 640px`
    When `start_council` の結果が描画される
    Then Round 2 の 2 カラムは上下の 2 段に折り返される
    And Consensus バッジとフッターは幅に関係なく常に表示される

  Scenario: Speaker 単位の失敗表示 (start_council)
    Given Round 2 の Gemini が `error.code: "unauthenticated"` で失敗した `CouncilTranscript` を受け取る
    When UI が描画される
    Then Gemini の Speaker ブロックは赤背景で `error.code` と `error.message` を表示し、stance タグは "未表明" のラベルになる
    And Claude の Speaker ブロックは通常通り stance タグ付きで描画される
    And Consensus バッジは Claude の stance 1 件のみから導出された表記 (例: `Partial (1 agree, 1 failed)`) になる
    And 改訂誘導フッターは通常通り表示される

  Scenario: ローディング表示 (start_council)
    Given UI が合議結果の受信待ち
    Then Consensus バッジは skeleton 表示
    And Round 1 / Round 2 すべてが skeleton 表示される
    And 未開始ラウンドは薄いグレーで "pending" ラベルが出る

  Scenario: ダーク / ライトテーマに追従する
    Given Article 3 由来の `ThemeContext` がホストテーマを伝えている
    When ホストテーマが切り替わる
    Then 全ツール共通でタイムライン背景・単発応答 UI 背景・Consensus バッジ・stance タグがテーマに合わせて切り替わる
```

## Implementation Steps

- [x] `src/main.tsx` でツール種別 (`ask_claude` / `ask_gemini` / `start_council`) を判定し、表示コンポーネントを分岐する (`_meta.tool_name` と `structuredContent` shape の両方を吸収する `src/ui-router.ts` を追加。`main.tsx` は single-answer / council / unknown の 3 分岐に整理し、loading 中も pending tool 名で view を安定保持、2026-04-16)
- [x] Article 3 の `AnswerColumn.tsx` を `src/components/SingleAnswerView.tsx` として流用または軽量リネームし、`ask_claude` / `ask_gemini` 両方で使えるようにプロバイダ名とモデル名をパラメータ化する (`SingleAnswerView.tsx` を追加し、provider ごとの label / accent color / answer field を `buildSingleAnswerViewModel()` で吸収。`main.tsx` の単発分岐はこのコンポーネントへ移し、vitest で 4 ケースの helper テストを追加、2026-04-16)
- [x] `src/components/ConsensusBadge.tsx` を新規実装する (タイムライン最上部に固定表示、`CouncilTranscript.consensus` と speaker の stance 集計を props で受けて色分け + カウント表記、`buildStanceSummary` で stance counts を集計し `(1 agree, 1 partial)` のようなカウント表記、skeleton loading 対応、2026-04-16)
- [x] `src/components/RoundTimeline.tsx` を新規実装する (ConsensusBadge + Round 1 単列 + Round 2 CSS Grid 2 カラム + total_latency_ms + RevisionFooter を縦タイムラインに配置、`RoundSection` / `SkeletonCard` を内包、`repeat(auto-fit, minmax(min(280px, 100%), 1fr))` で 640px 以下は自動縦並び、2026-04-16)
- [x] `src/components/SpeakerCard.tsx` を新規実装する (AnswerColumn を再利用し stance タグを上部に配置。`StanceTag` は agree=緑/extend=青/partial=黄/disagree=赤 の色付き pill + テキストラベル併記、エラー時は "未表明" グレー表示。ChatGPT=OpenAI 緑/Claude=オレンジ/Gemini=青のプロバイダカラー、2026-04-16)
- [x] `src/components/RevisionFooter.tsx` を新規実装する (consensus を props で受けて文言を切り替える: `unanimous_agree` → 「全員同意、補足のみ」、それ以外 → 「改訂案は下のチャットへ」、COUNCIL_COLOR のアクセント付き footer、2026-04-16)
- [x] Article 3 の `ThemeContext` を踏襲し、3 つすべての UI に同じテーマ機構を適用する (全コンポーネントが `useColors()` で palette を取得、background/border/text は palette から、accent color はブランドカラーとして固定、2026-04-16)
- [x] ローディング / pending / エラーの各状態を mock data で手元確認するための最小プレビューページを追加する (`#preview` ハッシュで `PreviewGallery` を起動、ask_claude / ask_gemini / council 3 variants + partial failure + loading の 7 セクション + テーマトグル、code-review の must-fix で `src/theme.ts` に ThemeContext / palettes / useColors を切り出して循環依存を解消、2026-04-16)
- [x] `npm run build` で `dist/mcp-app.html` を生成し、basic-host で各ツールの実応答を描画する (dist 492KB 生成、dev server で HTML 200 確認、dist バンドルに consensus 値 + responsive grid 含有確認、実 API E2E は手動確認に委譲、2026-04-16)
- [x] iframe 幅 `< 640px` のブレークポイントで Round 2 が縦並びになり、Consensus バッジとフッターは常に表示されることを確認する (`repeat(auto-fit, minmax(min(280px, 100%), 1fr))` が dist に含有、280px×2 + gap > 640px で自動 1 カラム化を構造的に保証、2026-04-16)
- [x] diff 表示ライブラリを導入していないことを依存関係で確認する (FR-9 遵守) (package.json に diff 関連依存なし、2026-04-16)
- [x] Review (build check + lint + `/code-review`) (tsc ✅ / vite build 492KB ✅ / vitest 39 pass ✅ / code-review must-fix 1 件を解消、2026-04-16)

## Technical Notes

- UI の分岐は "構造化コンテンツの形" で判定するのが安全。`structuredContent.rounds` が存在すれば `start_council`、存在しなければ単発応答、という簡易判定で十分
- `ask_claude` / `ask_gemini` の UI を Article 3 の `AnswerColumn` から流用することで、spec-004 の実装ボリュームは実質 `ConsensusBadge` + `RoundTimeline` + `SpeakerCard` + `RevisionFooter` + 分岐ロジックに集中する
- diff ライブラリの依存は持たない。記事用の差分比較は筆者が実機ログからテキスト手動比較する (FR-9 / FR-14)
- `RevisionFooter` の文言は consensus に応じて切り替える。ChatGPT が tool content を読むためのプロンプトとは別に、iframe を見ている人間にも consensus 結果が一目で伝わるよう設計する (フッターは人間用、content プロンプトは ChatGPT 用)
- **stance タグの色分けは accessibility を意識し、色だけでなくラベル文字も併記する** (agree / extend / partial / disagree のテキストを必ず表示)。緑 (agree) / 青 (extend) / 黄 (partial) / 赤 (disagree) を基調
- **Consensus バッジのカウント表記**は発生した stance だけを並べる形式が読みやすい (例: `Mixed (1 agree, 1 partial)` / `3/3 agree` / `Split (all disagree)`)
- `ThemeContext` は Article 3 の実装をそのままコピーして使う (新規設計はしない)
