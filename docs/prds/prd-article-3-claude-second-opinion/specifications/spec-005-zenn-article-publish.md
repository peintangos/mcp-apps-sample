# spec-005: Zenn Article Draft and Publish

## Overview

spec-001〜spec-004 で完成した ChatGPT × Claude セカンドオピニオン MCP App を題材に、Zenn 記事「**ChatGPT の中で Claude に聞ける MCP App を作ってみた**」を執筆・レビュー・公開する。Article 1 で確立した文体ルール (ですます + 口語崩し、太字多用、ハマりどころ連発、おわり締め) をそのまま踏襲し、LLM-to-LLM 越境の面白さを記事の中心に据える。

## Acceptance Criteria

```gherkin
Feature: Article 3 の Zenn 公開

  Background:
    spec-004 が完了し ChatGPT で iframe 描画のスクショが揃っている

  Scenario: ドラフト完成
    Given 9 章前後の骨子が固まっている
    When ドラフトを執筆する
    Then 各章は本リポジトリの動くコードを参照している
    And ドラフトには ChatGPT で描画されている比較 UI のヒーロースクショがある
    And 冒頭と末尾に Article 1 / Article 2 との関係性が示されている

  Scenario: ドラフトがセルフレビューを通過する
    Given ドラフトが完成している
    When `/code-review` と `docs-review` をドラフトと参照先コードに対して実行する
    Then クリティカルな指摘が残らない

  Scenario: 記事が公開される
    Given ドラフトがレビューを通過している
    When 記事を Zenn に公開する
    Then 公開 URL が `knowledge.md` に記録される
    And PRD の progress が done に更新される
```

## Implementation Steps

- [ ] `article-writer` スキル (Zenn スタイル) で Article 3 のドラフトを執筆
  - 章構成: 冒頭掴み / "なぜ ChatGPT で Claude を呼ぶのか" / 技術の仕組み / 実装 / ハマりどころ / ChatGPT で動かす / 制約と学び / まとめ / 次の記事予告
- [ ] コードスニペットは `projects/article-3/` から逐語的にコピーする
- [ ] スクショを `images/mcp-apps-claude-second-opinion/` に配置し `/images/...` パスで参照
- [ ] Article 1 と Article 2 への内部リンクを冒頭と末尾に入れる
- [ ] "Claude Max では API キーが別契約" の注意喚起を必ず入れる
- [ ] ChatGPT の制約 (UI からのツール呼び出し等) をハマりどころの章に書く
- [ ] `/code-review` と `docs-review` を実行
- [ ] Zenn に公開 (Zenn CLI または Web)
- [ ] 公開 URL を `knowledge.md` の "Article Publication Record" に記録
- [ ] `progress.md` の spec-005 を done に更新
- [ ] Review (公開後のサニティパス)

## Technical Notes

- **タイトル案**:
  - ⭐ "ChatGPT の中で Claude に聞ける MCP App を作ってみた" (シリーズの中で一番バズりそう)
  - "2 つの LLM を MCP Apps 越しに繋ぐ実験 — ChatGPT × Claude Second Opinion"
  - "MCP Apps で ChatGPT に Claude のセカンドオピニオンを埋め込む"
- **Zenn メタデータ**:
  - `type: tech`
  - `topics: ["mcp", "chatgpt", "claude", "react", "typescript"]`
  - `emoji: 🤝` (LLM どうしの握手)
  - `published: false` (デフォルト)
- **文字数目標**: 5000〜7000 字 (Article 1 と同等)
- **筆者独自の視点**:
  - 「**ライバル同士の LLM が同じ MCP サーバーを共有する**」というメタ構造の面白さ
  - ChatGPT が自分の回答を tool call 引数として自己報告する能力 (conversational にできる理由)
  - LLM の回答の "癖" が同じ UI で並列可視化される体験
  - Article 1 (Claude 専用)、Article 2 (自作ホスト)、Article 3 (ChatGPT) の**ホスト実装 3 部作**としての位置付け
- **図版**:
  1. 冒頭スクショ (ChatGPT 会話内の比較 UI)
  2. アーキテクチャ図 (ChatGPT → MCP Server → Claude API の流れ)
  3. basic-host での実装途中スクショ
  4. ChatGPT と Claude.ai で同じ URL が動くスクショ (Write Once, Run Anywhere の証拠)
- **公開後のフォロー**: 公開 URL を `knowledge.md` に記録、初速の反応をメモ、必要なら追記パッチ
- **次の記事予告**: 現時点では未定 (Article 4 以降は Article 3 の反応を見てから決める)
