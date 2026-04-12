# spec-003: React Dashboard UI Resource

## Overview

spec-001 の最小 UI を、`analyze_repo` の出力を描画する実ダッシュボードに置き換える。ダッシュボードは言語比率ドーナツ (Recharts)、Star 数カード、Contributor リストを含み、ローディング / エラー / 空状態を扱い、ホストのライト/ダークテーマに追従する。

## Acceptance Criteria

```gherkin
Feature: インタラクティブな GitHub ダッシュボード

  Background:
    spec-002 の MCP サーバーが起動し basic-host から到達可能

  Scenario: 正常系の描画
    Given `analyze_repo` が `facebook/react` に対して有効な結果を返した
    When ツール結果が `ontoolresult` 経由で UI に届く
    Then ドーナツチャートが言語の割合をラベル付きで表示する
    And Star 数カードが 1000 区切り付きで数値を表示する
    And Contributor リストが最大 5 件のアバターとログイン名を表示する

  Scenario: エラー描画
    Given `analyze_repo` が `{ code: "not_found" }` を返した
    When ツール結果が UI に届く
    Then ダッシュボードはチャートの代わりに人間可読なエラーカードを表示する

  Scenario: ローディング状態
    Given ツール呼び出しが進行中
    When UI がまだ結果を受け取っていない
    Then ローディング skeleton もしくはインジケータが表示される

  Scenario: テーマ追従
    Given ホストがダークモード
    When ダッシュボードが描画される
    Then 背景色とテキスト色がホストのダークテーマに一致する
```

## Implementation Steps

- [x] `recharts` をインストールし Vite クライアントバンドルに組み込む (`recharts@3.8.1`、2026-04-12)
- [x] `src/components/LanguageDonut.tsx` を Recharts `PieChart` で作成 (innerRadius 55 / outerRadius 90、8 色パレット、top 6 + "Other" 集約、2026-04-12)
- [x] `src/components/StarCard.tsx` と `src/components/ContributorList.tsx` を作成 (2026-04-12)
- [x] `useApp().ontoolresult` を React state setter につなぎ、描画を駆動する (`CallToolResult.structuredContent` の shape で `AnalyzeRepoView` vs 汎用テキスト表示に分岐、2026-04-12)
- [x] トップレベル `App` コンポーネントにローディング / エラー / 空状態を追加 (`InfoCard` / `ErrorCard` / `StatusBadge` で connecting/connected/error/waiting/tool-error を網羅、2026-04-12)
- [ ] `useDocumentTheme` または `useHostStyles` でホストテーマに追従
- [x] ビルドされた `mcp-app.html` のサイズが妥当な予算 (gzipped 500 KB 未満目標) に収まることを確認 (実測 638KB / gzipped 189KB、目標比 38%、2026-04-12)
- [x] basic-host で手動確認しスクリーンショットを取得 (`docs/references/MCP Apps/screenshots/spec-003/` に 04 枚、facebook/react で PieChart + Contributor avatars が描画されることを視覚検証、2026-04-12)
- [x] Review (build check + `/code-review`) — tsc EXIT=0、console エラー 0、CSP 修正後に再検証済み (2026-04-12)

## Technical Notes

- **Recharts のコンポーネント選定** (決定):
  - 言語比率: `<PieChart>` + `<Pie>` + `<Cell>` (カラーは言語ごとに割当)
  - Star 数: Recharts を使わず単純な数値カード (`<div>` + CSS)
  - Contributor リスト: Recharts を使わず単純な `<ul>` + avatar `<img>`
- **テーマ追従**:
  - 第 1 候補: `useDocumentTheme()` で light/dark を取得し、Recharts の `stroke` / `fill` を切り替える
  - 第 2 候補: `useHostStyles()` で CSS 変数を取得し、`var(--host-bg)` 等を適用
  - この spec で第 1 候補を試し、うまく行かなければ第 2 候補にフォールバック
- **バンドルサイズ予算**: gzipped 500KB 以下を目標。Recharts は重いので Tree-shaking を確認し、使わない chart 種類は import しない
- **アバター画像**: `avatars.githubusercontent.com` からロードするため `_meta.ui.csp.resourceDomains` に追加が必要 (spec-004 で実装)
- **コンポーネント構造** (決定):
  ```
  App
  ├── LoadingState / ErrorState / EmptyState (排他)
  └── Dashboard
      ├── StarCard
      ├── LanguageDonut
      └── ContributorList
  ```
- **状態管理**: `useState` のみ。Redux / Zustand は過剰。`useApp().ontoolresult` → `setResult` の一方向で十分
- **未解決事項**: ダッシュボードのレイアウトは Claude Desktop の iframe 初期サイズ (約 600x400) で可読性を保つ必要あり。初期ビルドで実機確認して調整
