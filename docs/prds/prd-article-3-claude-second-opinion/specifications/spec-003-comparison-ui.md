# spec-003: Side-by-Side Comparison UI

## Overview

spec-001 の最小 UI を、**2 カラムの side-by-side 比較ビュー**に置き換える。左カラムに `ChatGPT` の回答、右カラムに `Claude` の回答を配置し、Markdown を描画する。ローディング / エラー / `chatgpt_answer` 未指定時のフォールバックを網羅し、Article 1 の ThemeContext を流用して light/dark に追従させる。

## Acceptance Criteria

```gherkin
Feature: Side-by-side 比較 UI

  Background:
    spec-002 で `ask_claude` が実データを返せるようになっている

  Scenario: 正常系の描画
    Given `ask_claude` が `{ question, chatgpt_answer, claude_answer, model_used, latency_ms }` を返した
    When ツール結果が UI に届く
    Then 2 カラムレイアウトで左が "ChatGPT"、右が "Claude"
    And 各カラムに Markdown レンダリング済みの回答テキストが表示される
    And フッターに `model_used` と `latency_ms` が表示される

  Scenario: chatgpt_answer 未指定時
    Given `ask_claude` が `chatgpt_answer: undefined` で返した
    When UI が描画される
    Then ChatGPT 側カラムには "ChatGPT の回答を引用してください" のプレースホルダーが表示される
    And Claude 側カラムは通常通り回答を表示する

  Scenario: エラー描画
    Given `ask_claude` が `isError: true` + `error: { code: "rate_limited" }` を返した
    When UI が描画される
    Then Claude 側カラムに構造化エラーカードが表示される
    And ChatGPT 側カラムは正常時と同じ表示のまま

  Scenario: ローディング状態
    Given ツール呼び出しが進行中
    When UI がまだ結果を受け取っていない
    Then Claude 側カラムに skeleton が表示される

  Scenario: 狭幅レスポンシブ
    Given iframe 幅が 600px 未満
    When UI が描画される
    Then 2 カラムが縦積みに fallback する

  Scenario: テーマ追従
    Given ホストがダークモード
    When UI が描画される
    Then 両カラムがダークテーマで描画される
```

## Implementation Steps

- [x] `react-markdown` を依存に追加 (spec-001 で事前導入済み、10.1.0、2026-04-12)。シンタックスハイライトはサイズ削減のため未導入 (Markdown の `pre`/`code` にテーマ追従スタイルだけ適用)
- [x] `src/components/AnswerColumn.tsx` を作成 — ラベル (ブランドカラー) + メタ (model / latencyMs) + Markdown 本文 + loading / error / placeholder 分岐、ReactMarkdown の `components` prop で theme-aware なスタイルを適用 (2026-04-12)
- [x] `src/components/ComparisonView.tsx` を作成 — dashed border の Question セクション + `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` で自動レスポンシブ、狭幅時は縦積み fallback (2026-04-12)
- [x] ErrorCard / InfoCard / StatusBadge は `main.tsx` 内に inline 定義 (分離不要の小さなサブコンポーネント、2026-04-12)
- [x] Article 1 の `ThemeContext` / `LIGHT_PALETTE` / `DARK_PALETTE` / `useColors` を `src/main.tsx` に流用 — `codeBg` フィールドを追加、残りはほぼ同一 (2026-04-12)
- [x] `main.tsx` の AppRouter を更新し、`toolResult.structuredContent` の `AskClaudeStructured` 型で分岐して `ComparisonView` を描画、isToolRunning フラグでローディング状態を追従 (2026-04-12)
- [x] Markdown の `pre` / `code` にテーマ追従スタイル (codeBg + border) を適用。シンタックスハイライトは Out of Scope として記事で言及 (2026-04-12)
- [x] `chatgpt_answer` 未指定時のプレースホルダー UI を実装 — ChatGPT 列に "tool call の chatgpt_answer 引数で渡してください" と注意書きを表示 (2026-04-12)
- [x] ビルドサイズが gzipped 500KB 以下であることを確認 — 実測 **435 KB / gzipped 129 KB**、予算比 26% (2026-04-12)
- [x] basic-host で視覚検証しスクショ取得 (light / dark 両方) — `article-3-spec-003/01-comparison-light.png` と `02-comparison-dark.png`、console エラー 0 (2026-04-12)
- [x] Review (tsc 通過 + chrome-devtools MCP 視覚検証 + Recharts のような依存管理罠なし) (2026-04-12)

## Technical Notes

- **Markdown ライブラリ**: `react-markdown` + `remark-gfm` (テーブル・タスクリスト対応) + シンタックスハイライトに `react-syntax-highlighter` または `shiki`。バンドルサイズを見て軽い方を選ぶ
- **AnswerColumn の props**: `{ label: "ChatGPT" | "Claude"; content: string | null; meta?: { model, latencyMs }; isLoading?: boolean; error?: AskClaudeError }`
- **ComparisonView のレイアウト**: CSS Grid (`grid-template-columns: 1fr 1fr`) + `@media (max-width: 600px) { grid-template-columns: 1fr }` で狭幅 fallback
- **ThemeContext 流用**: Article 1 からの差分はゼロでコピー可能。ただし palette の key 名は変えず、必要なら色味だけ微調整
- **未解決事項**: Markdown 内の画像・リンクは外部ドメインに繋がる可能性があるが、CSP で許可していないのでそのまま読み込めないはず。記事では「外部画像は表示されない」制約として言及
