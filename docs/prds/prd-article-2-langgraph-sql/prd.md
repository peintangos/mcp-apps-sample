# Product Requirements Document (PRD) — Article 2: LangGraph × MCP Apps × Human-in-the-loop SQL

## Branch

`ralph/article-2-langgraph-sql`

## Overview

LangGraph で実装した「自然言語 → SQL 生成 → 人間承認 → DB 実行」エージェントに、自作 MCP Apps ホストを組み込むデモと、それを題材にした Zenn 記事を執筆・公開する。LangGraph の `interrupt()` が MCP App の承認 UI と接続し、UI 上でユーザーが OK を押すまで DB への破壊的操作 (UPDATE/DELETE) が止まる。LangSmith でエージェント全体の trace を可視化し、記事の "見せ場" として使う。

## Background

Article 1 で MCP Apps の基礎を抑えた読者、および LangGraph でエージェントを実装している読者が次に知りたいのは「LangGraph のループに UI を組み込めるか」である。MCP Apps は Claude や ChatGPT のような既存ホスト専用と見られがちだが、仕様上 postMessage + iframe + JSON-RPC で動くため、自作ホストを書けば LangGraph エージェントからも UI を描画できる。

この PRD はそのパターンを最短経路で実証する。副作用承認 (DB UPDATE) を題材にすることで、MCP Apps の価値提案である「人間がループに割り込める UI」が最も説得力を持つ形で示せる。Article 1 が "MCP Apps とは何か" を扱うのに対し、この記事は "MCP Apps を自分のエージェントに組み込む方法" を扱う。

## Product Principles

- **LangGraph 経験者の既知を前提にする** — LangGraph の基礎からは説明しない
- **副作用承認を必ず題材にする** — UI がなくても動くデモは記事の主張を弱める
- **LangSmith 可視化をスクショの主軸にする** — trace 1 枚で流れが伝わることを目指す
- **自作ホストは最小限** — `basic-host` を拡張する形で、スクラッチ実装は避ける
- **ローカル SQLite に閉じる** — 再現性とリスクのトレードオフでローカル完結を取る
- **Article 1 の知識は前提にする** — 重複説明を避け、相互リンクで補完する

## Scope

### In Scope

- LangGraph エージェント (Python, `interrupt()` + `Command(resume=...)` ベース)
- OpenRouter 経由での GPT-4.x 系モデル呼び出し (`langchain-openai` + OpenRouter エンドポイント)
- `langchain-mcp-adapters` で MCP ツールを LangGraph tool として吸い上げる
- ローカル SQLite サンプル DB とシードスクリプト
- 自然言語 → SQL 生成 (Structured Output で `{ preview_sql, execute_sql, is_destructive }` を返す)
- 自作 MCP Apps ホスト (React SPA, `basic-host` ベース)
- 承認 UI (生成 SQL のハイライト表示、`SELECT` プレビュー結果テーブル、[承認] / [キャンセル] / [編集] ボタン)
- LangGraph `interrupt()` と MCP App 承認シグナルの接続
- LangSmith トレーシング有効化と trace スクリーンショット
- Zenn 記事ドラフト執筆・レビュー・公開

### Out of Scope

- 本番 DB / リモート DB への接続
- マルチテナント / 認証 / 権限管理
- Claude Desktop / ChatGPT / VS Code Copilot など既存 MCP ホストでの検証 (自作ホストが前提)
- MCP Apps の spec を越える拡張機能 (host-specific extension)
- LangGraph 以外のエージェントフレームワーク (LangChain core 単体、Autogen 等)
- Article 1 の内容の再説明 (リンクで代替)
- 記事 1 との共通実装の共有 (各 PRD は独立ディレクトリで完結)

## Target Users

### 記事読者
- Python + LangGraph を最低限触ったことがある
- LLM エージェントに UI を組み込みたいと考えている
- 副作用を伴う操作の human-in-the-loop を実装したことがある or したい
- MCP Apps に関心はあるが自分で書いたことはない
- Article 1 を読了済み (推奨、必須ではない)

### プロジェクトコントリビュータ
- 記事の著者本人
- 将来の拡張者

## Use Cases

1. **読者が clone してローカル実行する** — seed スクリプトで SQLite を作り、LangGraph と自作ホストを起動、ブラウザから "先月の売上トップ 5 の顧客の住所を〇〇に更新して" と送る
2. **読者が承認ゲートを体験する** — エージェントが停止し、UI 上で生成された UPDATE SQL と影響行プレビューを確認、承認して実行
3. **読者が LangSmith で trace を見る** — interrupt → 停止 → resume の流れが可視化されているのを確認
4. **読者が自分のエージェントに応用する** — 承認 UI と interrupt のパターンをそのまま流用

## Functional Requirements

- FR-1: LangGraph エージェントは OpenRouter 経由で GPT-4.x 系モデルを呼び出す
- FR-2: エージェントは SQLite DB のスキーマをシステムプロンプトに渡し、自然言語クエリから SQL を生成する
- FR-3: 生成された SQL が破壊的 (`UPDATE`, `DELETE`, `INSERT`, `DROP`) であれば `interrupt()` で停止し、承認を待つ
- FR-4: 自作 MCP Apps ホストは React SPA で、`basic-host` のロジックを拡張して実装する
- FR-5: MCP App の承認 UI は (a) 生成 SQL をシンタックスハイライト表示、(b) `SELECT` プレビューの結果テーブル、(c) [承認] [キャンセル] [編集] のボタンを持つ
- FR-6: ユーザーが承認すると UI から LangGraph に承認シグナルを送り、エージェントが SQL を実行して結果を UI に返す
- FR-7: キャンセルするとエージェントは "実行を中止した" とチャットに応答する
- FR-8: LangSmith トレーシングが有効化され、interrupt → 停止 → resume の全ステップが trace で可視化される
- FR-9: Zenn 記事は以下を含む: Article 1 との連続性、アーキテクチャ図、自作ホスト実装、承認 UI 実装、LangGraph interrupt 統合、LangSmith 可視化スクショ、制約、Article 1 への逆リンク

## UX Requirements

- 承認 UI はブラウザで開いた瞬間に "何が起きようとしているか" が 3 秒以内に把握できる
- SQL の diff は危険度 (破壊的/安全) を色で示す
- 影響行プレビューは最大 20 行までのサンプル表示
- 承認ボタンは誤クリック防止のため軽い確認を挟む (モーダルまたは 2 段階クリック)
- LangSmith の trace スクショは記事の "見せ場" として、1 枚で全体の流れが分かる絵になる

## System Requirements

- Python 3.11 以上
- `langgraph` 最新安定版 (interrupt サポート必須)
- `langchain-mcp-adapters`
- `langchain-openai` + OpenRouter エンドポイント
- `langsmith` クライアント + API キー
- SQLite 3 (標準ライブラリ)
- Node.js 20 + React + Vite (自作ホスト側)
- `@modelcontextprotocol/ext-apps` 関連パッケージ
- ブラウザ (Chrome / Firefox)
- OpenRouter API キー / LangSmith API キー (読者の動作確認に必要)

## Milestones

| Milestone | Description | Target Date |
|-----------|-------------|-------------|
| M1: LangGraph + SQLite 基礎動作 | spec-001 完了 — 自然言語で SELECT が動く | 2026-05-24 |
| M2: 自作ホスト最小動作 | spec-002 完了 — `basic-host` 拡張版の React ホストで hello tool を描画 | 2026-05-31 |
| M3: 承認 UI 完成 | spec-003 完了 — SQL + プレビューが描画される | 2026-06-07 |
| M4: interrupt 統合完了 | spec-004 完了 — 承認フローが End-to-End で動く | 2026-06-14 |
| M5: LangSmith 可視化完了 | spec-005 完了 — trace スクショが取れる | 2026-06-18 |
| M6: Zenn 記事公開 | spec-006 公開済み | 2026-06-28 |
