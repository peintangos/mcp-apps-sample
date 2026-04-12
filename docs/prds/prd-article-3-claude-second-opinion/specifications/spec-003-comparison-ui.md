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

- [ ] `react-markdown` と `react-syntax-highlighter` (またはその相当) を依存に追加
- [ ] `src/components/AnswerColumn.tsx` を作成 (見出し + Markdown 本文 + フッター)
- [ ] `src/components/ComparisonView.tsx` を作成 (AnswerColumn を 2 つ横並び、狭幅時は縦積み)
- [ ] `src/components/ErrorCard.tsx` と `LoadingSkeleton.tsx` (必要なら) を作成
- [ ] Article 1 の `ThemeContext` / `LIGHT_PALETTE` / `DARK_PALETTE` / `useColors` を `src/main.tsx` に流用
- [ ] `main.tsx` の AppRouter を更新し、`toolResult.structuredContent` の shape で ComparisonView を描画
- [ ] Markdown コードブロックのシンタックスハイライトを設定 (theme 追従)
- [ ] `chatgpt_answer` 未指定時のプレースホルダー UI を実装
- [ ] ビルドサイズが gzipped 500KB 以下であることを確認
- [ ] basic-host で視覚検証しスクショ取得 (light / dark 両方)
- [ ] Review (build check + `/code-review`)

## Technical Notes

- **Markdown ライブラリ**: `react-markdown` + `remark-gfm` (テーブル・タスクリスト対応) + シンタックスハイライトに `react-syntax-highlighter` または `shiki`。バンドルサイズを見て軽い方を選ぶ
- **AnswerColumn の props**: `{ label: "ChatGPT" | "Claude"; content: string | null; meta?: { model, latencyMs }; isLoading?: boolean; error?: AskClaudeError }`
- **ComparisonView のレイアウト**: CSS Grid (`grid-template-columns: 1fr 1fr`) + `@media (max-width: 600px) { grid-template-columns: 1fr }` で狭幅 fallback
- **ThemeContext 流用**: Article 1 からの差分はゼロでコピー可能。ただし palette の key 名は変えず、必要なら色味だけ微調整
- **未解決事項**: Markdown 内の画像・リンクは外部ドメインに繋がる可能性があるが、CSP で許可していないのでそのまま読み込めないはず。記事では「外部画像は表示されない」制約として言及
