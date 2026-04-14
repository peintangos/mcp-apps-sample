# spec-005: ChatGPT Custom Connector 統合 + Fly.io デプロイ

## Overview

Article 3 で既に導入済みの OAuth 2.1 自前実装経路と Fly.io デプロイ設定を Article 4 用に複製し、ChatGPT Plus/Pro の Custom Connector として登録して End-to-End で 3 ツール (`ask_claude` / `ask_gemini` / `start_council`) がすべて動作することを実機検証する。とくに `start_council` は、iframe 描画 + ChatGPT が tool content の改訂指示を読んでチャット応答として Round 3 (改訂案) を書くところまで確認する。動かない場合は basic-host で代替検証し、記事に制約を明記する。

## Acceptance Criteria

```gherkin
Feature: ChatGPT Custom Connector End-to-End

  Background:
    spec-001〜spec-004 が完了している
    Article 3 の OAuth / Fly.io 設定がリファレンスとして利用可能
    ChatGPT Plus / Pro の MCP Apps Custom Connector が利用可能

  Scenario: Fly.io デプロイが成功する
    Given `projects/article-4/fly.toml` が Article 4 アプリ名で設定されている
    When `fly deploy` を実行する
    Then デプロイが成功し、公開 URL から MCP サーバーが到達可能
    And 環境変数 `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, OAuth 関連設定がすべて注入されている

  Scenario: OAuth 2.1 フローが完走する
    Given ChatGPT から Article 4 の MCP サーバー URL を Custom Connector 登録する
    When OAuth 認可フローを開始する
    Then Article 3 由来の OAuth 実装経路で認可が完了する
    And ChatGPT のコネクタ一覧に Article 4 サーバーが表示される

  Scenario: `ask_claude` / `ask_gemini` 単発ツールが動作する
    Given ChatGPT 会話で `ask_claude({ question: "X" })` を呼ぶ
    When ツールが呼び出される
    Then iframe に単発応答 UI (Article 3 相当) が描画され、実 Claude 応答が入る
    And 同様に `ask_gemini` でも実 Gemini 応答が単発応答 UI に描画される
    And 両方ともスクショを保存する

  Scenario: `start_council` で iframe 合議ログが描画される
    Given ChatGPT 会話で `start_council` を呼び出させるプロンプトを投げる
    And `chatgpt_initial_answer` として直前の自分の回答を渡す
    When ツールが呼び出される
    Then iframe にタイムライン UI (Round 1 + Round 2) が描画される
    And "Round 3 — ChatGPT 改訂案は下のチャットメッセージに出力されます" フッターが表示される
    And スクショを保存する

  Scenario: `start_council` 後に ChatGPT が改訂案をチャットに書く
    Given 上記の Scenario が成立し、tool 応答の `content` に改訂指示が埋まっている
    When ChatGPT が tool 応答を読んで自然に次のチャットメッセージを生成する
    Then ChatGPT は Round 1 (初案) と Round 2 (stance 付き独立評価) を踏まえた改訂案または補足応答を自分の発話として出力する
    And consensus が `unanimous_agree` なら改訂はせず簡潔な確認または 1-2 行の補足応答になる
    And consensus が `mixed` / `unanimous_disagree` なら改訂案になり、Round 2 の partial / disagree speaker の理由を少なくとも一部反映する
    And チャット応答 (改訂案または補足) をスクリーンショットで保存する

  Scenario: ChatGPT で動かない場合のフォールバック
    Given ChatGPT 側に MCP Apps の制約で描画されない事象が発生する
    When basic-host で同じ `start_council` 呼び出しを再現する
    Then basic-host でタイムライン UI が描画される
    And 制約内容が `knowledge.md` に記録される
```

## Implementation Steps

- [ ] Article 3 の `src/oauth.ts` を `projects/article-4/src/oauth.ts` にコピーし、発行者 / audience / scope 等の設定値を Article 4 用に書き換える
- [ ] Article 3 の `Dockerfile` を Article 4 に複製し、必要な env / build コマンドを Article 4 に合わせる
- [ ] Article 3 の `fly.toml` を複製し、アプリ名 / ポート / ヘルスチェック / スケーリング設定を Article 4 用に書き換える
- [ ] Fly.io の secrets に `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, OAuth クライアント情報を設定する
- [ ] `fly deploy` を実行し、公開 URL 経由で MCP サーバーが応答することを curl で確認する
- [ ] ChatGPT Plus/Pro の Custom Connector に Article 4 の URL を登録し、OAuth フローが完走することを確認する
- [ ] ChatGPT 会話で `ask_claude` / `ask_gemini` / `start_council` の 3 ツールすべてが呼び出せることを実機確認する
- [ ] `start_council` で iframe に Round 1-2 タイムラインが描画されることを確認する
- [ ] `start_council` の後、ChatGPT が tool 応答を読んで改訂案をチャットメッセージとして出力することを実機確認する
- [ ] 改訂案 (または unanimous_agree 時の補足応答) が Round 2 の stance 付き評価を実際に反映しているかを定性評価し、`knowledge.md` に観察結果を記録する。特に unanimous_agree で "改訂が起きなかった" ケースを 1 つ以上収集すると stance 設計が機能している証拠になる
- [ ] ダーク / ライトテーマ両方での描画スクショを保存する (単発応答 UI ×2 + タイムライン UI ×2 + 改訂チャット応答 ×1 の最低 5 枚)
- [ ] ChatGPT 側で描画されない場合は basic-host で iframe 描画のみ代替検証し、差分を `knowledge.md` に記録する (改訂チャット応答は ChatGPT でのみ成立する制約を明記)
- [ ] Article 4 独自の認可例外 (あれば) を `knowledge.md` に追記する
- [ ] Review (build check + lint + `/code-review`)

## Technical Notes

- Article 3 の OAuth / Fly.io 設定はそのまま使える前提なので、本 spec では設計変更は行わず「流用」に徹する
- Fly.io の secrets 差分だけで動くことを優先。Article 3 側の運用状態には影響を与えない
- ChatGPT は tool content に改行や長文を含めると描画が崩れる事例があるため、`content` にはタイムラインのプレーンテキストサマリを短めに入れる (`structuredContent` に本体)
- 実機検証スクショは Zenn 記事 (spec-006) で必須になるため、最低でも (a) `ask_claude` の単発応答 UI、(b) `ask_gemini` の単発応答 UI、(c) `start_council` のダーク + ライトのタイムライン、(d) ChatGPT の改訂チャット応答の 5 枚を確保する
