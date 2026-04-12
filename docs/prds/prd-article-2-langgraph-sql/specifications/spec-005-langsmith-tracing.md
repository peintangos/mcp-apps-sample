# spec-005: LangSmith Tracing and Visualization

## Overview

LangSmith トレーシングを spec-004 の End-to-End フローに組み込み、`interrupt → 停止 → resume` の 3 ステップが trace 上で明確に可視化されることを確認する。記事の "見せ場" となる trace スクリーンショットを取得する。

## Acceptance Criteria

```gherkin
Feature: LangSmith で承認フローを可視化

  Background:
    spec-004 が完了し End-to-End が動く

  Scenario: tracing 有効化
    Given `LANGSMITH_API_KEY` が環境変数にセットされている
    When エージェントが起動する
    Then LangSmith クライアントが有効化される
    And 1 回のクエリが LangSmith プロジェクトに trace として記録される

  Scenario: interrupt が trace 上で視認できる
    Given ユーザーが破壊的クエリを送り承認した
    When LangSmith UI で trace を開く
    Then interrupt ノードと resume ノードが分かれて表示される
    And interrupt から resume までのギャップ (人間の承認時間) が計測されている

  Scenario: スクリーンショットが取得される
    Given 記事用の trace が LangSmith に 1 本ある
    When 開発者がスクリーンショットを取得する
    Then スクショが `docs/references/MCP Apps/screenshots/article-2/spec-005/langsmith-trace.png` に保存される
    And スクショには interrupt → approval wait → resume → db exec の流れが写っている
```

## Implementation Steps

- [ ] `langsmith` パッケージが依存に含まれていることを確認
- [ ] `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, `LANGSMITH_TRACING` を `.env.example` に追加
- [ ] `agent/graph.py` の初期化時に tracing を有効化
- [ ] 記事用クエリ (`"先月の売上トップ 5 の顧客の住所を 〇〇 に更新して"`) を実行
- [ ] LangSmith UI で trace を開き、interrupt の停止時間を確認
- [ ] 記事用スクリーンショットを取得 (全体、interrupt ノード詳細、LLM ノード詳細の 3 枚)
- [ ] OpenRouter モデルのレイテンシとトークンコストを trace から抜粋して `knowledge.md` に記録
- [ ] Review (`/code-review`)

## Technical Notes

- LangSmith は LangGraph 側のみ trace する。MCP Apps iframe 内の postMessage は trace されないので、記事ではその境界を明示する
- スクショは LangSmith ダッシュボードの UI 変更で後から取り直す可能性があるので、撮影日を付記
- trace が公開されるか private かで記事のリンク可否が変わる。LangSmith のプロジェクト設定を確認
