# spec-004: LangGraph Interrupt Integration

## Overview

spec-001 の LangGraph エージェントと spec-003 の承認 UI を接続し、破壊的 SQL が生成された時に `interrupt()` でエージェントが停止し、UI 上で承認された場合のみ `Command(resume=...)` で SQL 実行を続行する End-to-End フローを完成させる。承認チャネル (UI → LangGraph の信号パス) は MCP ツール呼び出しとして実装する。

## Acceptance Criteria

```gherkin
Feature: interrupt 承認フローの End-to-End

  Background:
    spec-001 (LangGraph)、spec-002 (自作ホスト)、spec-003 (承認 UI) が完了している

  Scenario: 破壊的 SQL が interrupt で停止する
    Given ユーザーが "先月のトップ 5 顧客の住所を〇〇に更新して" と送る
    When LangGraph がモデルに SQL を生成させる
    And 生成された SQL が `UPDATE` で始まる
    Then エージェントは `interrupt()` で停止する
    And 停止したことが UI に伝わる
    And UI が生成 SQL とプレビュー結果を描画する

  Scenario: 承認後の resume
    Given UI が承認待ち状態
    When ユーザーが UI の [承認] → [実行] を押す
    Then UI は承認ツール (例: `approve_sql`) を MCP 経由で呼び出す
    And LangGraph は `Command(resume={"approved": true})` で続行する
    And SQL が SQLite 上で実行される
    And 実行結果が UI に反映される

  Scenario: キャンセル時の応答
    Given UI が承認待ち状態
    When ユーザーが UI の [キャンセル] を押す
    Then LangGraph は `Command(resume={"approved": false})` で続行する
    And エージェントは "実行を中止した" とチャットに応答する
    And DB は変更されない

  Scenario: SELECT は interrupt されない
    Given ユーザーが "顧客を 5 件表示して" と送る
    When LangGraph が `SELECT` を生成する
    Then interrupt は発生せず、結果がそのまま UI に描画される
```

## Implementation Steps

- [ ] `agent/graph.py` の SQL 実行ノードの前に `is_destructive` 判定ノードを追加
- [ ] 破壊的と判定された時に `interrupt()` を呼び、状態に `preview_sql` と `execute_sql` と `preview_rows` を保持
- [ ] 承認チャネルとして `approve_sql` MCP ツールを実装 (`{ approved: boolean, edited_sql?: string }` を受ける)
- [ ] `langchain-mcp-adapters` で `approve_sql` を LangGraph tool として吸い上げる
- [ ] UI 側は spec-003 の承認ボタンハンドラから `approve_sql` を `tools/call` 経由で呼ぶ
- [ ] LangGraph は `Command(resume=...)` で graph を再開
- [ ] 編集シナリオ (`edited_sql`) を対応: 承認された SQL を DB に流す前に上書き
- [ ] キャンセル時の応答文言を定数化
- [ ] End-to-End 動作確認 (破壊的・安全・編集・キャンセルの 4 パターン)
- [ ] スクリーンショットとログを `docs/references/MCP Apps/screenshots/article-2/spec-004/` に保存
- [ ] Review (pytest + `/code-review`)

## Technical Notes

- `interrupt()` は LangGraph v0.2 以降前提。古いバージョンの document を参照しない
- 承認チャネルを MCP tool にすることで、MCP Apps の理念 ("UI も MCP クライアントである") に乗せられる。REST エンドポイントを別建てする案より記事の主張に沿う
- `is_destructive` 判定はキーワードベース (`UPDATE`, `DELETE`, `INSERT`, `DROP`, `ALTER`, `TRUNCATE`) で十分。正規表現で簡易実装
- Structured Output で `{ preview_sql, execute_sql, is_destructive }` をモデルに生成させる案もある。プロンプトで判定を任せる方が安定するか、ローカル判定の方が確実か、実装時に決定
