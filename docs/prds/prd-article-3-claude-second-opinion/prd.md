# Product Requirements Document (PRD) — Article 3: ChatGPT × Claude Second Opinion MCP App

## Branch

`ralph/article-3-claude-second-opinion`

## Overview

ChatGPT の会話内で `ask_claude` ツールを呼び出すと、MCP サーバーが Claude API を叩いて回答を取得し、**ChatGPT の回答と Claude の回答を side-by-side 比較 UI** として iframe に描画する MCP App を作る。そしてそれを題材にした Zenn 記事を執筆・公開する。成果は「**ChatGPT の中で Claude に聞ける**」というメタ構造そのもので、MCP Apps の Write Once, Run Anywhere 主張を LLM ベンダーを越境する形で実証する。

## Background

Article 1 で MCP Apps の基礎を抑え、Article 2 で自作ホスト × LangGraph の応用パターンを扱った後、**クロスベンダー LLM 協調**という次のレイヤーに踏み込む必要が出てきた。MCP Apps は仕様レベルで "ホストに依存しない UI 標準" を謳っているが、実際にライバル関係にある Claude と ChatGPT が同じ MCP サーバーを共有できることは、ほぼ誰も記事化していない。

この PRD は **"ChatGPT の中で Claude に聞く"** という一見ありえない構造を最小実装で証明することで、MCP Apps の価値提案の限界を広げ、LLM を横断して "セカンドオピニオン" を得る実用的なパターンを提示する。記事は Article 1/2 より一段メタな視点 (LLM どうしの協調) に立ち、読者に「複数 LLM を UI 経由で繋ぐ」という新しいメンタルモデルを提供する。

## Product Principles

- **ChatGPT を主ホストに据える** — Article 1 の Claude、Article 2 の自作ホストに続く第 3 のホスト実装例
- **単方向で十分** — 双方向 (Claude → ChatGPT も呼ぶ) は扱わない。"ChatGPT が Claude に聞く" 1 本に絞る
- **MCP Apps の核だけを使う** — Anthropic SDK + `_meta.ui.resourceUri` + side-by-side UI の最小構成、余計な抽象は作らない
- **LLM どうしの比較を UI で見せる** — 2 つの回答を並べる体験そのものが記事の価値
- **記事は "越境" の物語** — 技術論だけでなく「ライバルベンダーを繋ぐ」というナラティブを残す

## Scope

### In Scope

- `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps/server` を使った MCP Apps サーバー
- `@anthropic-ai/sdk` で Claude API (Sonnet / Opus) を呼び出す tool
- `ask_claude({ question, chatgpt_answer?, model? })` ツール
- React + `react-markdown` で Side-by-side 比較 UI を実装
- `ChatGPT` (Plus/Pro) の Custom Connector に登録して End-to-End 検証
- `ALLOWED_HOSTS` env var と cloudflared トンネルでの公開 (Article 1 の pattern 再利用)
- 実機検証スクショ (ChatGPT 内での描画 + Claude.ai フォールバック時の描画)
- Zenn 記事ドラフト執筆 → レビュー → 公開

### Out of Scope

- **他 LLM への拡張** (Gemini / Llama / o1 等) — 将来の派生記事で扱う
- **双方向協調** (Claude から ChatGPT を呼ぶ) — 今回は ChatGPT → Claude の単方向のみ
- **ChatGPT 以外のホストでの検証** (Article 1 / 2 の代替実装と位置付けないため)
- **Multi-turn 会話サポート** — 1 ツール呼び出しで完結、multi-turn は Article 2 の LangGraph 領域
- **ストリーミングレスポンス** — `stream: false` ベースの completion に限定
- **Prompt Caching / Extended Thinking** — Claude API の高度機能は別記事で
- **UI からの二次ツール呼び出し** — ChatGPT は一部制限があり、記事では "制約" として言及するにとどめる
- **Article 1 / 2 との共有コード** — `projects/article-3/` 配下で独立して実装

## Target Users

### 記事読者
- **ChatGPT Plus / Pro ユーザー** かつ **Claude API** にも加入している (または加入予定の) エンジニア
- 複数 LLM の回答を比較する needs を持つ人 (プロンプトエンジニア / AI 活用業務)
- Article 1 を読んで MCP Apps に興味を持った読者 (連続ナラティブで読ませる)
- MCP Apps の可搬性に懐疑的だったが、実証例を見たい人

### プロジェクトコントリビュータ
- 記事の著者本人 (実装 + 執筆)
- 将来の拡張者

## Use Cases

1. **技術判断のセカンドオピニオン**: ChatGPT に「Rust と Go どちらを学ぶべきか」と聞いた後、`ask_claude` ツール呼び出しで Claude にも同じ質問を投げ、両方の回答を並べて比較する
2. **コードレビューの第三者視点**: ChatGPT が出したコードに対して、Claude がどういう改善を提案するかを同じ UI で見る
3. **意見分かれそうなテーマでの比較**: アーキテクチャ選定・デザイン判断などで両モデルの傾向を把握する
4. **モデルの癖の観察**: 同じ質問への回答スタイルの違い (簡潔さ / 網羅性 / トーン) を side-by-side で見比べる

## Functional Requirements

- FR-1: MCP サーバーは `ask_claude` ツールを 1 つ登録する
- FR-2: `ask_claude` の input schema は `{ question: string, chatgpt_answer?: string, model?: "sonnet" | "opus" }`
- FR-3: tool handler は `@anthropic-ai/sdk` で Claude API を呼び、`model` 指定 (デフォルト `claude-sonnet-4-6`) で回答を取得する
- FR-4: `structuredContent` には `{ question, chatgpt_answer, claude_answer, model_used, latency_ms }` を含める
- FR-5: Claude API エラー (rate limit / 401 / network) は `Result<T>` で構造化して UI に届ける
- FR-6: UI は **2 カラム側並び**で、左に ChatGPT の回答、右に Claude の回答を描画する
- FR-7: UI は Markdown をレンダリングする (`react-markdown` 等)
- FR-8: UI はモデル名とレイテンシをフッターに表示する
- FR-9: `ANTHROPIC_API_KEY` 環境変数から API キーを取得する (ハードコード禁止)
- FR-10: cloudflared トンネル経由で ChatGPT の Custom Connector に登録して動作することを確認する
- FR-11: ChatGPT で動かない場合は Claude.ai で代替検証し、記事にその制約を明記する
- FR-12: Zenn 記事は以下を含む — MCP Apps とクロスベンダー協調の背景、`ask_claude` の実装、Claude API 統合、側並び UI、ChatGPT 検証、LLM-to-LLM 協調の考察

## UX Requirements

- 2 カラムの幅は左右均等 (50:50)、狭い iframe でも縦並びにフォールバック
- モデル名 (ChatGPT / Claude) はカラムヘッダに大きく表示、どちらの回答かが一瞬でわかる
- Markdown のコードブロックはシンタックスハイライト
- ローディング中は Claude 側カラムに skeleton を表示
- エラー時は Claude 側カラムに構造化エラー (code + message) を描画
- ChatGPT の回答が `chatgpt_answer` として渡されていない場合は、「ChatGPT の回答を引用してください」というプレースホルダーを表示
- ダーク / ライトテーマに追従 (Article 1 の ThemeContext pattern 再利用)

## System Requirements

- Node.js 20 LTS 以上
- TypeScript 6.x
- `@modelcontextprotocol/sdk` (Article 1 と同バージョン帯)
- `@modelcontextprotocol/ext-apps` v1.x
- `@anthropic-ai/sdk` 最新 stable
- Express 5 + cors
- React 19 + `react-markdown`
- Vite 8 + `vite-plugin-singlefile`
- `tsx` (TypeScript 直起動)
- `cloudflared` CLI (Article 1 で導入済み)
- ChatGPT Plus / Pro (MCP Apps Custom Connector 利用可能なプラン)
- Anthropic API アカウント (`ANTHROPIC_API_KEY`、従量課金)
- **Claude Max サブスクでは Claude API は使えない**点を記事で明記する

## Milestones

| Milestone | Description | Target Date |
|-----------|-------------|-------------|
| M1: ask_claude が text 返却 | spec-001 + spec-002 完了 — Anthropic SDK で Claude から回答取得 | 2026-07-05 |
| M2: Side-by-side UI 完成 | spec-003 完了 — basic-host で 2 カラム比較描画 | 2026-07-12 |
| M3: ChatGPT で End-to-End | spec-004 完了 — ChatGPT 会話内で iframe 描画 | 2026-07-19 |
| M4: Zenn 記事公開 | spec-005 完了 | 2026-07-26 |
