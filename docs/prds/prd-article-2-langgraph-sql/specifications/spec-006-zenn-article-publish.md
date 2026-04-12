# spec-006: Zenn Article Draft and Publish

## Overview

spec-001〜spec-005 で完成した LangGraph × MCP Apps の承認フローデモを題材に、Zenn 記事「LangGraph の副作用承認 UI を MCP Apps で作る」を執筆・レビュー・公開する。Article 1 へのリンクを必ず含め、LangGraph 経験者向けのトーンで書く。

## Acceptance Criteria

```gherkin
Feature: Article 2 の Zenn 公開

  Background:
    spec-005 が完了し全スクショと trace が取得済み

  Scenario: ドラフト完成
    Given 9 章前後の骨子が固まっている
    When ドラフトを執筆する
    Then 各章は本リポジトリの動くコードを参照している
    And ドラフトに冒頭スクショ、LangSmith trace スクショ、承認 UI スクショが含まれる
    And 冒頭と末尾に Article 1 へのリンクが含まれる

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

- [ ] Article 2 の骨子 (9 章前後、Article 1 導線付き) を固める
- [ ] `article-writer` スキル (Zenn スタイル) でドラフトを執筆
- [ ] コードスニペットをリポジトリから逐語的にコピーする (書き換えない)
- [ ] LangSmith スクショと承認 UI スクショを挿入
- [ ] 「なぜ自作ホストが必要だったか」の章で、langchain-mcp-adapters が `ui://` を扱わないことを明示する
- [ ] 「制約と次の一歩」の章で、状態永続化なし・Claude Desktop 非対応などの制約を書く
- [ ] Article 1 への内部リンク (冒頭と末尾) を挿入
- [ ] `/code-review` をドラフトに対して実行
- [ ] `docs-review` をドラフトとリンク先コードに対して実行
- [ ] Zenn に公開 (Zenn CLI または Web)
- [ ] `knowledge.md` の "Article Publication Record" に公開 URL を記録
- [ ] `progress.md` の spec-006 を done に更新
- [ ] Review (公開後のサニティパス)

## Technical Notes

- Article 1 の公開から 4〜6 週間後の公開を想定
- LangSmith スクショは記事の目玉なので、最初の 1 枚に選ぶ
- 読者層が LangGraph 経験者なので、LangGraph の基礎説明には紙面を割かない。関連ドキュメントへのリンクで代替する
