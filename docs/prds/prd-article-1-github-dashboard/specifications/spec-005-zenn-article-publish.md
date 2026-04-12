# spec-005: Zenn Article Draft and Publish

## Overview

spec-001〜spec-004 で完成したデモを題材に、Zenn 記事「MCP Apps で、Claude の中に自作ダッシュボードを生やす」を執筆・レビュー・公開する。記事は壁打ちで合意済みの 9 章構成 (概要 / 面白さ / 仕組み / basic-host 動作 / デモ実装 / CSP ハマりどころ / Claude Desktop 検証 / 制約 / Article 2 予告) に従う。

## Acceptance Criteria

```gherkin
Feature: Article 1 の Zenn 公開

  Background:
    spec-004 が完了し全スクリーンショットが取得済み

  Scenario: ドラフト完成
    Given 9 章構成の骨子が固まっている
    When ドラフトを執筆する
    Then 各章は本リポジトリの動くコードを参照している
    And ドラフトに冒頭スクリーンショットと Claude Desktop スクリーンショットが含まれる
    And 末尾に Article 2 の予告が含まれる

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

- [x] `article-writer` スキル (Zenn スタイル) で 9 章構成のドラフトを執筆 — `articles/mcp-apps-github-dashboard.md` に約 7000 字、10 セクション構成で執筆、ですます調 + 口語的崩し + 太字強調、writing-style.md の 5 項目セルフレビュー通過 (2026-04-12)
- [x] コードスニペットをリポジトリから逐語的にコピーする (書き換えない) — `server.ts` の `createMcpServer` / `registerAppTool` / `registerAppResource` / `_meta.ui.csp`、`main.tsx` の `useApp` + `onhostcontextchanged`、`ALLOWED_HOSTS` env var パターンをすべて実装から抜粋 (2026-04-12)
- [x] `docs/references/MCP Apps/screenshots/` のスクリーンショットを挿入 — 4 枚を `images/mcp-apps-github-dashboard/` にコピーし `/images/...` 相対パスで参照 (hero / basic-host / dashboard closeup / dark theme) (2026-04-12)
- [x] `knowledge.md` に記録した実エラーをもとに CSP ハマりどころの章を執筆 — "ハマりどころ 3 連発" セクションに Recharts ResponsiveContainer / CSP img-src / DNS rebinding 保護の 3 件を実エラーメッセージ付きで記述 (2026-04-12)
- [x] Article 2 PRD を予告する章を執筆 — 末尾に LangGraph × interrupt × 承認 UI の予告を追加、`prd-article-2-langgraph-sql` と内容的に整合 (2026-04-12)
- [ ] `/code-review` をドラフトに対して実行
- [ ] `docs-review` をドラフトとリンク先コードに対して実行
- [ ] Zenn に公開 (Zenn CLI または Web)
- [ ] `knowledge.md` の "Article Publication Record" に公開 URL を記録
- [ ] `progress.md` の spec-005 を done に更新
- [ ] Review (公開後のサニティパス)

## Technical Notes

- **骨子リファレンス** (決定): [`docs/references/article-outlines/article-1-outline.md`](../../../references/article-outlines/article-1-outline.md)
- **Zenn メタデータ** (推奨):
  - `type: tech`
  - `topics: ["mcp", "claudecode", "typescript", "react", "zenn"]`
  - `emoji: 🧩` (絵文字は Zenn の慣例に合わせて設定)
  - `published: false` でドラフト、レビュー後に `true`
- **図版** (必須):
  1. 冒頭スクショ (Claude Desktop 内のダッシュボード)
  2. アーキテクチャ図 (Server / Host / iframe の三角関係) — Mermaid or drawio
  3. basic-host 実行画面
  4. CSP エラー時の白画面 (失敗例、記事の "痛み" として使う)
  5. 最終動作スクショ (Claude Desktop)
- **コードブロック方針**: すべて実リポジトリから逐語コピー。ブログ用に書き換えない
- **字数の目安**: 5000〜8000 字 (Zenn の読み切りレンジ)
- **文体** (決定): 「だ/である」調、技術記事のトーン。`article-writer` スキルの Zenn プロファイルを使用
- **公開後のフォロー**: 公開 URL を `knowledge.md` に記録、初速の反応をメモ、必要なら追記パッチ
- **Article 2 への導線**: 末尾に Article 2 PRD (`prd-article-2-langgraph-sql`) へのリンクを置く
