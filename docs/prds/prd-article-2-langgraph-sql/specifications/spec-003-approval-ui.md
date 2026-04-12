# spec-003: SQL Approval UI Resource

## Overview

spec-002 の自作ホストに載せる UI リソースとして、SQL 承認 UI を実装する。UI は (a) 生成 SQL をシンタックスハイライト表示、(b) `SELECT` プレビュー結果を表形式で表示、(c) [承認] / [キャンセル] / [編集] ボタン、(d) 破壊的 SQL かどうかの色分け、を含む。この spec ではまだ LangGraph とは接続せず、スタブデータで描画を成立させる。

## Acceptance Criteria

```gherkin
Feature: SQL 承認 UI

  Background:
    spec-002 の自作ホストが起動している

  Scenario: 破壊的 SQL の表示
    Given `analyze_repo` スタブが `{ preview_sql, execute_sql, is_destructive: true }` を返す
    When ツール結果が UI に届く
    Then `execute_sql` がシンタックスハイライト付きで表示される
    And 破壊的であることを示す警告バナーが表示される
    And `preview_sql` の結果テーブルが 20 行まで表示される
    And [承認] [キャンセル] [編集] ボタンが表示される

  Scenario: 安全な SQL の表示
    Given ツール結果が `is_destructive: false` を返す
    When UI が描画される
    Then 警告バナーは表示されない
    And ボタンは [実行] のみに簡略化される

  Scenario: 承認の 2 段階クリック
    Given 破壊的 SQL が表示されている
    When ユーザーが [承認] を押す
    Then 確認モーダルが表示される
    And 確認モーダルで [実行] を押すと初めて承認シグナルが送られる

  Scenario: キャンセル
    Given 破壊的 SQL が表示されている
    When ユーザーが [キャンセル] を押す
    Then UI は "キャンセル済み" 状態に遷移する
    And 承認シグナルは送られない
```

## Implementation Steps

- [ ] `frontend/src/mcp-app.html` と `frontend/src/mcp-app.tsx` を作成し、UI リソース用のエントリポイントを分離
- [ ] `react-syntax-highlighter` (または `shiki`) を導入し SQL ハイライト
- [ ] `SqlPanel`, `PreviewTable`, `ActionBar`, `ConfirmModal` コンポーネントを作成
- [ ] 破壊的 / 安全の色分けを CSS で実装 (破壊的: 警告色 / 安全: ニュートラル)
- [ ] `useApp().ontoolresult` でスタブデータを受け取り、state にセット
- [ ] 承認・キャンセル・編集のそれぞれで対応する送信ロジック (ただしエンドポイントはスタブでよい)
- [ ] `vite-plugin-singlefile` で単一 HTML ビルドを出力
- [ ] スタブ MCP サーバー (spec-002 の `scripts/stub-server.ts`) にこの UI リソースを登録
- [ ] spec-002 の自作ホストで UI を描画し、3 種類のツール結果 (安全 SELECT / 破壊的 UPDATE / 破壊的 DELETE) でスクショを取得
- [ ] Review (`/code-review`)

## Technical Notes

- 編集ボタンは MVP では "テキストエリアで編集して再送信" の最小実装でよい
- `PreviewTable` は結果行数が多すぎる場合に備えて 20 行で truncate、残件数を注釈表示
- このスペックが LangGraph に繋がるのは spec-004。この spec ではスタブが全面的
- UI デザインは "Claude Desktop の iframe 標準幅 (約 600px)" でも破綻しない構成を優先
