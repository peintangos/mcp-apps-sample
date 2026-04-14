# spec-006: Zenn 記事執筆・レビュー・公開

## Overview

Article 4 の実装と実機検証を題材にした Zenn 記事を執筆し、レビューを経て公開する。Article 3 からの連続ナラティブ (1 対 1 越境 → 3 者合議) を強調し、3 ツール構成 (`ask_claude` / `ask_gemini` / `start_council`) の設計意図、Synthesizer 型 Round 1-2 + ChatGPT 改訂フローを選定した理由、Round 3 をサーバーで生成しない判断 (案 A / 案 C 排除の理由)、Provider 抽象、Gemini 統合、タイムライン UI、ChatGPT 実機検証、**Round 1 (初案) と Round 3 (ChatGPT 改訂チャット応答) の手動差分比較**、Appendix として OpenRouter への言及を含める。

## Acceptance Criteria

```gherkin
Feature: Zenn 記事の執筆・公開

  Background:
    spec-001〜spec-005 が完了し、実機スクショと実測値が揃っている

  Scenario: 記事の構成が PRD の FR-14 を満たす
    Given 記事ドラフトが書かれている
    When 章立てをレビューする
    Then Article 3 からの連続性が冒頭で明示されている
    And 3 ツール構成 (ask_claude / ask_gemini / start_council) の導線が説明されている
    And Synthesizer 型 Round 1-2 + ChatGPT 改訂を選んだ理由が書かれている
    And Round 3 をサーバーで生成しない設計判断 (案 A / 案 C を排除した理由) が明示されている
    And **Round 2 で批判強制をやめた理由 (LLM-as-critic の 3 失敗モードと stance-based 独立評価への切り替え) が独立セクションで解説されている**
    And **stance enum (agree / extend / partial / disagree) と consensus 分岐ロジック (unanimous_agree / mixed / unanimous_disagree) が解説されている**
    And Provider 抽象の設計が説明されている
    And Gemini 統合 (`@google/genai`) の手順が書かれている
    And タイムライン UI + "改訂案は下のチャットへ" フッターの実装が解説されている
    And ChatGPT 実機検証スクショ (iframe 描画 + ChatGPT 改訂チャット応答) が掲載されている
    And Round 1 (初案) と Round 3 (ChatGPT 改訂応答) の手動差分比較 (定量 + 定性) が書かれている
    And Appendix で OpenRouter が「代替案」として 1 段落以上紹介されている

  Scenario: コードブロックの再現性が確保されている
    Given 記事内のコードサンプルを読者が写経したと仮定する
    When `projects/article-4/` の該当箇所と見比べる
    Then コード断片が動作するコードと整合する
    And 依存パッケージバージョンが明示されている

  Scenario: レビューと公開
    Given 記事ドラフトが完成している
    When `/docs-review` 相当で事実確認を行う
    Then 指摘事項がすべて解消される
    And Zenn に公開される
    And 公開 URL が `knowledge.md` と `docs/roadmap.md` に記録される
```

## Implementation Steps

- [ ] 記事の章立てドラフトを作成する (冒頭: Article 3 からの連続性 / 本論: 3 ツール導線・合議設計・実装・UI / 検証: ChatGPT スクショ + Round 1 vs Round 3 比較 / Appendix: OpenRouter)
- [ ] Article 3 からの連続ナラティブを冒頭に書く (1 対 1 越境 → 合議)
- [ ] 3 ツール (`ask_claude` / `ask_gemini` / `start_council`) の使い分けガイドを書く (単発質問と合議モードの導線を読者に示す)
- [ ] Synthesizer 型 Round 1-2 + ChatGPT 改訂を選んだ理由と、Debate / MoA / Round-Robin を避けた理由を書く
- [ ] Round 3 をサーバーで生成しない判断を明示する (Claude を synthesizer に使う案 A が欺瞞構造になる理由、複数 tool call を使う案 C が flaky になる理由を両方書く)
- [ ] **Round 2 で批判強制をやめた判断を独立セクションで書く** (sycophancy flip / confabulated disagreement / confirmation signal 喪失 の 3 失敗モードを実装上の観察と合わせて解説し、stance-based 独立評価の方が「同意も正当な出力」として扱えることを強調する)
- [ ] **stance enum (agree / extend / partial / disagree) と consensus 分岐ロジックの解説を書く** (unanimous_agree では改訂不要を誘導、mixed では標準の改訂誘導、unanimous_disagree では根本書き直しを誘導する 3 分岐の具体例を示す)
- [ ] Provider 抽象 (`src/providers/types.ts` + `claude.ts` + `gemini.ts`) の設計と移植手順を書く
- [ ] Gemini 統合 (`@google/genai` + `GOOGLE_API_KEY` + 実測レイテンシ) を書く
- [ ] Consensus バッジ + stance 表示 + consensus に応じて文言が変わる改訂誘導フッター付きのタイムライン UI の実装を書く (diff UI を持たないことも明記)
- [ ] ChatGPT Custom Connector 登録と実機検証スクショを掲載する (iframe 描画 + ChatGPT 改訂チャット応答の 2 系統)
- [ ] Round 1 (初案) と Round 3 (ChatGPT が実際にチャットに書いた改訂応答) の手動差分比較を定量 (文字数差分・情報追加量) + 定性 (具体例) で書く
- [ ] Appendix で OpenRouter を「代替案」として 1 段落以上紹介する (実装には入れないが、読者への選択肢提示)
- [ ] `/docs-review` 相当の事実確認を行い、記事内のコードとリポジトリの整合を確認する
- [ ] Zenn に公開する
- [ ] 公開 URL を `knowledge.md` と `docs/roadmap.md` に記録する
- [ ] Review (最終読み合わせ + `/code-review` による記事本文チェック)

## Technical Notes

- Article 3 の Zenn 記事 (spec-005) の文体と構成を参照し、連載としてのトーンを揃える
- **3 ツール構成の意図**: `ask_claude` / `ask_gemini` は単発比較の入り口、`start_council` は合議モードの応用。読者が段階的に理解できる導線として機能させる
- **stance-based 独立評価は記事の差別化要因**: 従来の MoA / LLM council 設計の多くは「他モデルが批判する」パターンで、同意が正当な出力として扱えなかった。本 PRD はこの制約を乗り越えた事例として記事化することで、凡庸な多エージェント紹介記事との差別化を狙う
- 合議前後の品質比較は読者が "合議の価値" を直感的に理解できる目玉セクション。実機 ChatGPT の改訂応答を抜粋し、初案との対比を手動で整理する。**特に unanimous_agree ケースで「改訂が行われなかった」事例も 1 つ示すと、stance 設計が実際に機能していることの証拠になる**
- OpenRouter 言及は公平性を保つため、メリット (SDK 統一 / キー 1 本) と デメリット (越境感の希薄化 / 固有機能制限) を両論併記する
- 記事に使う実機スクショはダーク / ライト両テーマ + `ask_claude` 1 枚 + `ask_gemini` 1 枚 + `start_council` iframe 2 枚 + ChatGPT の改訂チャット応答 1 枚の計 6 枚を最低ライン
- 筆者文体は `.claude/skills/article-writer/references/writing-style.md` を参照して揃える
