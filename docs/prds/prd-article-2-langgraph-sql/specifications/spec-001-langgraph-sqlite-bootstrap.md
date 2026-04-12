# spec-001: LangGraph + SQLite + OpenRouter Bootstrap

## Overview

Python 環境を初期化し、LangGraph から OpenRouter 経由で GPT-4.x 系を呼び出して、ローカル SQLite に対する SELECT クエリを自然言語で生成・実行できる最小エージェントを作る。この spec は破壊的 SQL・承認 UI・MCP Apps に一切触れず、LangGraph 自体と OpenRouter/SQLite の配線が正しいことだけを担保する。

## Acceptance Criteria

```gherkin
Feature: LangGraph が OpenRouter 経由で SQLite の SELECT を生成する

  Background:
    クリーンな Python 3.11 環境

  Scenario: 環境のブートストラップ
    Given リポジトリがクローンされている
    When 開発者が依存関係をインストールする
    Then `langgraph`, `langchain-openai`, `langsmith`, `pytest` がインストールされる
    And `python -m agent.seed` で SQLite ファイルとサンプルデータが生成される

  Scenario: 自然言語から SELECT を生成して実行する
    Given エージェントが起動している
    When ユーザーが "顧客テーブルのトップ 5 を見せて" と送る
    Then LangGraph が OpenRouter 経由でモデルを呼ぶ
    And モデルが `SELECT * FROM customers LIMIT 5` 相当の SQL を生成する
    And エージェントが SQLite 上で SQL を実行する
    And 結果が構造化された形で返る

  Scenario: スキーマが system prompt に渡る
    Given サンプル DB のスキーマが更新された
    When エージェントが起動する
    Then system prompt には更新後のテーブル定義が含まれる
```

## Implementation Steps

- [ ] `pyproject.toml` (または `requirements.txt`) を作成し、`langgraph`, `langchain-openai`, `langchain-mcp-adapters`, `langsmith`, `pytest` を pin
- [ ] `agent/` モジュールを作成し、OpenRouter 向けの `ChatOpenAI` インスタンスを構成 (`base_url="https://openrouter.ai/api/v1"`)
- [ ] `agent/db.py` で SQLite コネクション管理とスキーマ introspection を実装
- [ ] `agent/seed.py` で `customers`, `orders`, `products` の 3 テーブルをシード
- [ ] `agent/graph.py` で最小 LangGraph (ノード: SQL 生成 → SQL 実行 → 結果返却) を実装
- [ ] スキーマを system prompt に流し込む helper 関数を実装
- [ ] pytest で "SELECT が生成されて実行される" のスモークテストを追加
- [ ] README に `python -m agent.seed && python -m agent.run "顧客テーブルのトップ 5"` の実行手順を記載
- [ ] Review (`pytest` + `/code-review`)

## Technical Notes

- モデル: OpenRouter 経由の `openai/gpt-4o` または `openai/gpt-4.1` を第 1 候補。Structured Output 動作確認はこの spec で済ませる
- SQLite ファイルは `data/sample.db`、git ignore する
- 破壊的 SQL のハンドリングは spec-004 で追加するため、この spec では SELECT のみ想定
- OpenRouter API キーは `OPENROUTER_API_KEY` で受け取り、`.env.example` を同梱
