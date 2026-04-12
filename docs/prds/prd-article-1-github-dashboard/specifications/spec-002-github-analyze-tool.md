# spec-002: GitHub Analyze Repo Tool

## Overview

MCP ツール `analyze_repo` を追加する。入力は `{ owner, repo }`、出力は言語比率・Star 数・Contributor トップ 5 からなる構造化 payload。ツールは GitHub の公開 REST/GraphQL API を認証なしで利用し、rate limit と 404 を構造化エラーとして吸収する。UI 側の描画は spec-003 で行うため、この spec は touch しない。

## Acceptance Criteria

```gherkin
Feature: GitHub リポジトリ分析ツール

  Background:
    spec-001 の MCP サーバーが起動している

  Scenario: 公開リポジトリの分析成功
    Given ユーザーが `{ owner: "facebook", repo: "react" }` を渡す
    When ツールが呼び出される
    Then レスポンスに `languages`, `stars`, `contributors` フィールドが含まれる
    And `languages` は `{ name, percentage }` の配列で percentage 降順にソートされている
    And `contributors` は `{ login, avatarUrl, contributions }` を最大 5 件含む

  Scenario: リポジトリが存在しない
    Given ユーザーが `{ owner: "nonexistent", repo: "nonexistent" }` を渡す
    When ツールが呼び出される
    Then ツールは `code: "not_found"` と人間可読な `message` を含む構造化エラーを返す

  Scenario: rate limit に到達
    Given GitHub API が 403 rate limit 応答を返している
    When ツールが呼び出される
    Then ツールは `code: "rate_limited"` と `resetAt` タイムスタンプを含む構造化エラーを返す
    And サーバーはクラッシュしない
```

## Implementation Steps

- [ ] 薄い GitHub API クライアント (`src/github.ts`) を追加し、`fetchLanguages`, `fetchRepo`, `fetchContributors` を実装
- [ ] `x-ratelimit-remaining` ヘッダを見て rate limit を検出
- [ ] TypeScript 型 `AnalyzeRepoResult` を定義し、UI からも再利用できるよう export
- [ ] `analyze_repo` を `registerAppTool` で登録 (UI リソース URI は spec-001 と共通、UI はツール名で分岐)
- [ ] GitHub エラーを `{ code, message }` 構造の payload にマップしてツール応答に乗せる
- [ ] `analyze_repo` を `facebook/react` に対して呼び出して shape を検証するスモークテストを追加
- [ ] 非自明な GitHub API 挙動があれば `knowledge.md` に追記
- [ ] Review (`/test` でスモークテスト + `/code-review`)

## Technical Notes

- **GitHub API エンドポイント** (決定):
  - 言語比率: `GET /repos/{owner}/{repo}/languages` (バイト数返却、percentage はクライアントで算出)
  - リポジトリ基本情報: `GET /repos/{owner}/{repo}` (star 数は `stargazers_count`)
  - Contributor: `GET /repos/{owner}/{repo}/contributors?per_page=5`
- **認証**: 未認証アクセス (認証なしだと 60 req/h 制限、記事用途なら十分)。`GITHUB_TOKEN` 環境変数があればそれを `Authorization: Bearer` で乗せる (任意)
- **HTTP クライアント**: 最小依存で `fetch` (Node 20 native) を使う。Octokit は導入しない
- **データ shape** (決定):
  ```ts
  type AnalyzeRepoResult = {
    owner: string;
    repo: string;
    stars: number;
    languages: Array<{ name: string; percentage: number }>;  // 降順
    contributors: Array<{ login: string; avatarUrl: string; contributions: number }>;  // 最大 5
  };
  ```
- **エラー shape** (決定):
  ```ts
  type AnalyzeRepoError =
    | { code: "not_found"; message: string }
    | { code: "rate_limited"; message: string; resetAt: string }
    | { code: "network_error"; message: string };
  ```
- **ツール結果の返し方**: `content` に `text` と `resource` を混在させる必要はなく、`structuredContent` (MCP の Structured Output) を優先。`_meta.ui.resourceUri` で UI リソースに紐づけ済み
- **未解決事項**: `percentage` を UI 側で算出するか、サーバー側で算出するか → サーバー側で算出する方針 (UI が Recharts に直接流せるため)
