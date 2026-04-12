# spec-004: ChatGPT Custom Connector Integration

## Overview

`projects/article-3/` のサーバーを cloudflared トンネル経由で公開し、ChatGPT Plus / Pro の Custom Connector に登録して **ChatGPT の会話内で `ask_claude` が呼ばれ、iframe に比較 UI が描画される**ことを End-to-End で確認する。ChatGPT の MCP Apps 実装の制約 (UI からのツール再呼び出し等) を実測で洗い出し、記事に書くネタとして記録する。ChatGPT で動かない部分があれば Claude.ai で代替検証する。

## Acceptance Criteria

```gherkin
Feature: ChatGPT での End-to-End 検証

  Background:
    spec-003 で side-by-side UI が basic-host で動いている、ANTHROPIC_API_KEY セット済み、ChatGPT Plus/Pro アカウントあり

  Scenario: ALLOWED_HOSTS で DNS rebinding 保護を回避
    Given `ALLOWED_HOSTS="<tunnel-host>"` 環境変数でサーバーを起動
    When cloudflared トンネル経由で `initialize` リクエストが届く
    Then `Invalid Host` エラーではなく正常なレスポンスが返る

  Scenario: cloudflared トンネルが発行される
    Given MCP サーバーがポート 3001 で起動
    When 開発者が `cloudflared tunnel --url http://localhost:3001` を実行
    Then 公開 HTTPS URL が発行される

  Scenario: ChatGPT に Custom Connector として登録
    Given cloudflared URL を入手している
    When 開発者が ChatGPT Settings から Custom Connector にその URL を追加
    Then `ask_claude` ツールが ChatGPT の使えるツールとして認識される

  Scenario: ChatGPT が ask_claude を呼ぶ
    Given Custom Connector が有効
    When ユーザーが "Rust と Go どちらを学ぶべきか Claude にも聞いて比較して" と送信
    Then ChatGPT が `ask_claude({ question: "...", chatgpt_answer: "..." })` を呼ぶ
    And iframe に side-by-side 比較 UI が描画される
    And ChatGPT 側カラムに ChatGPT の回答、Claude 側カラムに Claude の回答が表示される

  Scenario: ChatGPT 制約のフォールバック
    Given ChatGPT で iframe が描画されない or 動作不安定
    When 開発者は Claude.ai の Custom Connector に同じ URL を登録
    Then Claude.ai 上で同じ動作が再現される
    And 記事にはその制約と代替検証結果を明記する
```

## Implementation Steps

- [ ] `ALLOWED_HOSTS` env var 対応を `projects/article-3/server.ts` に入れる (Article 1 から流用)
- [ ] cloudflared 起動 → HTTPS URL 取得 → `ALLOWED_HOSTS` で server 再起動
- [ ] curl で tunnel 経由 `initialize` と `ask_claude` を smoke test (ChatGPT に登録する前にサニティチェック)
- [ ] ChatGPT Plus/Pro の Settings → Connectors に Custom Connector として URL を登録
- [ ] ChatGPT で実際に比較を依頼するプロンプトを送信 (例: "Rust と Go どちらを学ぶべきか Claude にも聞いて比較して")
- [ ] iframe の描画を Chrome DevTools MCP で視覚検証、accessibility tree と screenshot を取得
- [ ] ChatGPT 側の制約 (UI から追加のツール呼び出し不可、等) があれば記録
- [ ] 制約があれば Claude.ai でも同じ URL を登録してフォールバック検証
- [ ] スクショを `docs/references/MCP Apps/screenshots/article-3/` に保存 (ChatGPT 内 / Claude.ai 内 / basic-host の 3 ケース)
- [ ] `knowledge.md` に ChatGPT / Claude / basic-host の挙動差を記録
- [ ] Review (`/code-review`)

## Technical Notes

- **ChatGPT の MCP Apps 対応状況 (2026-04 時点の知見)**: 公式サポートあり、ただし "UI からのツール呼び出し等、一部制限" と `docs/references/MCP Apps/gemini.md` に記載。基本フロー (LLM → tool_call → UI 描画) は動く想定
- **ChatGPT の Custom Connector UI**: Claude.ai の `/settings/connectors` に近い構造のはず。画面操作は chrome-devtools MCP で自動化可能 (ユーザーの Add ボタンは手動)
- **Anthropic API キーの扱い**: server.ts の process.env 経由。cloudflared 経由で外部公開する際も API キーはサーバー側に閉じているので外部に漏れない
- **セキュリティ考慮**: トンネル URL を知っていれば誰でもアクセス可能 → API キーの使用料が他人に使われるリスクがある。**記事では "公開中は自分だけが URL を知っている前提" と明記**し、named tunnel + auth が本番向きと補足
- **フォールバック決定基準**: ChatGPT で iframe が描画されない / `ask_claude` が呼ばれない / structuredContent が UI に届かない、のいずれかが起きたら Claude.ai で代替検証
