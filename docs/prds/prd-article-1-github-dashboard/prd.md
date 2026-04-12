# Product Requirements Document (PRD) — Article 1: GitHub Dashboard MCP App

## Branch

`ralph/article-1-github-dashboard`

## Overview

動く「GitHub リポジトリ分析ダッシュボード」の MCP App を 1 本作り、それを題材に MCP Apps 初見の読者向けの Zenn 記事を執筆・公開する。デモは Claude Desktop 上で "facebook/react を分析して" と問いかけると、言語比率ドーナツチャート・Star 数カード・Contributor トップ 5 からなるインタラクティブなダッシュボードがチャット内に描画される。

## Background

MCP Apps (SEP-1865) は 2026-01-26 に Stable 化された MCP 初の公式拡張で、MCP サーバーがプレーンテキストの代わりにリッチなインタラクティブ UI を Claude / ChatGPT / VS Code Copilot などのホストへ配信できるようにする。日本語の技術情報はまだ薄く、既存の記事の多くは仕様紹介にとどまっている。

この PRD は、読者が clone → `npm install` → 動くまで 10 分で到達できる "最初の 1 本" を再現可能な形で提供する。Zenn 記事が主たる成果物であり、デモ実装は記事の各セクションを "実際に動くコード" に紐付けるためのアンカーとして存在する。

## Product Principles

- **Hands-on over theoretical** — 記事に出てくる概念はすべて読者が手元で動かせるコードに紐付く
- **Single-host scope for honesty** — 検証は Claude Desktop のみに限定し、記事で誇張しない
- **Safe and reproducible** — 読者は 10 分以内で clone → install → 動作確認ができる
- **Visual impact drives engagement** — 冒頭スクリーンショットで「これ作りたい」と思わせる
- **Separate concerns from the LangGraph story** — LangGraph 中継パターンは別 PRD (Article 2) で扱い、この PRD では MCP Apps 基礎に集中する

## Scope

### In Scope

- `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps/server` を使った MCP Apps サーバー
- `analyze_repo` ツール (GitHub 公開 API を利用、認証なし)
- React + Recharts による UI を `vite-plugin-singlefile` で単一 HTML にバンドル
- `_meta.ui.csp.connectDomains` による CSP 宣言
- 公式 `basic-host` によるローカル動作検証
- `cloudflared` トンネル経由の Claude Desktop End-to-End 検証
- Zenn 記事のドラフト執筆・レビュー・公開
- 記事用スクリーンショット (basic-host / Claude Desktop)

### Out of Scope

- Article 2 (LangGraph × MCP Apps × 副作用承認) — 別 PRD で扱う
- MCP Apps ホストの自作 — Article 2 のテーマ
- ChatGPT / VS Code Copilot / Goose など他ホストでの検証
- セッション間の UI 状態永続化
- GitHub 認証 / プライベートリポジトリ対応
- React UI の単体テスト (スモーク以上の網羅テストは行わない)
- デモの CI/CD パイプライン

## Target Users

### 記事読者
- 日本語話者のエンジニアで JavaScript/TypeScript の基礎がある
- React は初歩レベルで読める
- MCP の名前は聞いたことがあるが、MCP サーバーを自作した経験はない
- そのまま fork して拡張できる実例を求めている

### プロジェクトコントリビュータ
- 記事の著者本人 (デモ実装と記事執筆を行う)
- 将来の拡張者 (スコープ外だが、構造がそれをブロックしないこと)

## Use Cases

1. **読者が clone してローカルで動かす** — `npm install && npm start` で `basic-host` 上にダッシュボードが表示される
2. **読者が Claude Desktop に接続する** — 記事の `cloudflared` 手順に従い、Claude に "facebook/react を分析して" と問いかけてダッシュボードが生えるのを確認する
3. **読者が CSP 設定を流用する** — 自分の外部 API 連携に `_meta.ui.csp.connectDomains` のパターンを適用する
4. **読者がデモを拡張する** — GitHub API を別の API に差し替え、同じ構造で派生アプリを作る

## Functional Requirements

- FR-1: spec-001 で `hello_time` ツールを登録し、外部 API を使わずに MCP Apps の往復を最小構成で検証できること
- FR-2: `analyze_repo` ツールは `{ owner: string, repo: string }` を受け取り、言語比率・Star 数・Contributor トップ 5 を構造化して返す
- FR-3: UI リソースは Recharts で言語比率ドーナツ、Star 数カード、Contributor リストを描画する
- FR-4: UI は `useApp()` でホストに接続し、`ontoolresult` でツール結果を受け取る
- FR-5: ビルド成果物は Vite + `vite-plugin-singlefile` による単一 HTML で、`registerAppResource` から配信される
- FR-6: サーバーは `_meta.ui.csp.connectDomains: ["https://api.github.com"]` を宣言し、必要に応じて UI からも GitHub API にアクセスできる
- FR-7: Zenn 記事は以下を含む: MCP Apps 概要、アーキテクチャ図、basic-host 実行手順、デモの段階的実装、CSP ハマりどころ、Claude Desktop 検証、Article 2 予告
- FR-8: Zenn 記事は Claude Desktop 上でダッシュボードが動いているスクリーンショットを最低 1 枚含む

## UX Requirements

- リファレンスマシンでツール呼び出しから 2 秒以内にダッシュボードが描画される
- Claude Desktop のデフォルト iframe サイズ (約 600x400 初期値) で可読性を保つ
- `useHostStyles` または `useDocumentTheme` でホストのライト/ダークテーマに追従する
- エラー状態 (rate limit / 404 / ネットワークエラー) は人間が読めるフォールバックメッセージを表示する
- 記事冒頭のスクリーンショットは、初見の読者が「これ作ってみたい」と思うレベルの映えを確保する

## System Requirements

- Node.js 20 LTS 以上
- npm または pnpm
- TypeScript 6.x (spec-001 で確定)
- `@modelcontextprotocol/sdk` 最新 stable (spec-001 で `^1.29.0`)
- `@modelcontextprotocol/ext-apps` v1.x (spec-001 で `^1.5.0` を pin)
- Vite 8.x + `vite-plugin-singlefile`
- React 19 + Recharts (バージョンは spec-003 で確定)
- Express 5 系 (サーバートランスポート)
- `tsx` (TypeScript サーバーの直接起動)
- `cloudflared` CLI (Claude Desktop 検証時)
- Claude Desktop (Pro プラン相当、End-to-End 検証時)
- DB / 認証 / ホスティングインフラは不要 (ローカル dev サーバーのみ)

## Milestones

| Milestone | Description | Target Date |
|-----------|-------------|-------------|
| M1: 最小 MCP App が動く | spec-001 完了 — `hello_time` が basic-host で描画される | 2026-04-19 |
| M2: GitHub analyzer が動く | spec-002 + spec-003 完了 — 実リポジトリのダッシュボードが basic-host で描画される | 2026-04-26 |
| M3: Claude Desktop で End-to-End | spec-004 完了 — Claude Desktop 内でダッシュボードが描画される | 2026-05-03 |
| M4: 記事ドラフト完成 | spec-005 の初稿ができて自己レビュー待ち | 2026-05-10 |
| M5: Zenn 記事公開 | spec-005 公開済み | 2026-05-17 |
