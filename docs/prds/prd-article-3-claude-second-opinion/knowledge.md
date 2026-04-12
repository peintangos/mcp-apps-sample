# Knowledge — Article 3: ChatGPT × Claude Second Opinion MCP App

## Reusable Patterns

<!-- Document patterns that should be reused in later tasks or later PRDs. -->

## Integration Notes

<!-- Capture cross-cutting behavior, dependencies, or setup details that are easy to forget. -->

- **Article 1 の構成 (`projects/article-1/`) をコピーベースに開始する**: server.ts / src/main.tsx / tsconfig.json / vite.config.ts の雛形が流用できる。Recharts と GitHub API 関連のみ削除し、Anthropic SDK に差し替える
- **Article 1 の ThemeContext / ColorPalette / useColors をそのまま流用**: Light / Dark 追従のパターンはすでに確立済み
- **spec-001 を 1 イテレーションで完走できるパターン**: Article 1 が同じ spec を 5 コミットに分けたのに対し、Article 3 は雛形流用のおかげで package.json 初期化 + 依存 + server.ts + UI + vite.config + basic-host 検証までを 1 回で片付けられる。**2 番目以降のサブプロジェクトのコストが 1/5 になる** ことの実証
- **依存バージョンの一貫性**: Article 1 と同じバージョンが解決された (TypeScript 6.0.2, React 19.2.5, Vite 8.0.8, Express 5.2.1, ext-apps 1.5.0, sdk 1.29.0)。Article 3 固有は `@anthropic-ai/sdk@0.88.0` と `react-markdown@10.1.0` のみ
- **dotenv + `.env` + `.env.example` の組み合わせがスタンダード**: 秘密情報は `.env` (gitignore)、テンプレートは `.env.example` (committable) に分離。`import "dotenv/config"` 1 行で `process.env` に読み込まれる。Node 20.6+ の `--env-file=.env` native フラグも使えるが、tsx との互換性を考えると dotenv パッケージが最も portable
- **Claude API モデル識別子 (2026-04 時点)**: `"claude-sonnet-4-6"` / `"claude-opus-4-6"` が現行 stable。haiku は `"claude-haiku-4-5-20251001"`。alias ではなく specific name で pin するのが本番向き
- **Claude API の実測レイテンシ (sonnet vs opus)**: 同じ質問で sonnet = 1591ms、opus = 5911ms。opus は約 3.7 倍遅い。UI では Claude 側カラムに skeleton を出して体感を和らげるのが良い (特に opus 選択時)
- **Anthropic SDK のエラー判別は HTTP status で十分**: SDK は `Anthropic.APIError` などのクラスを提供しているが、`instanceof` 判定より `err.status === 401 / 429` の方が portable。429 時の reset 時刻は `anthropic-ratelimit-requests-reset` または `anthropic-ratelimit-tokens-reset` ヘッダから取得
- **chatgpt_answer を Claude に渡さない設計判断**: Claude には質問だけを投げ、`chatgpt_answer` は UI 側で並べるためにだけ structuredContent で搬送。これにより Claude は "ChatGPT の回答を見ない状態での独立した意見" を返し、**中立な side-by-side 比較** が成立する。Claude に chatgpt_answer を見せると "似たこと言ってる" とか "間違いを指摘する" 挙動になって公平性が崩れる
- **Claude は MCP Apps について断片的な知識しかない (2026-04-12 時点)**: "MCP Apps の本質を 1 文で" と聞いたら、MCP 全般 (AIエージェントが外部ツールに接続する標準プロトコル) の説明が返ってきた。Claude の training cutoff に MCP Apps の SEP-1865 が含まれていないのか、記事的に面白い観察 — **複数 LLM の比較では "知識のムラ" が可視化される** という副次的な面白さ
- **`react-markdown` の `components` prop で theme-aware な描画**: `components={{ p: ..., code: ..., pre: ... }}` を渡すと、各 Markdown 要素のレンダリングを React コンポーネントに差し替えられる。`useColors()` と組み合わせると、`pre` の background と border を theme で切り替えられる。シンタックスハイライトライブラリを使わなくても、Markdown の見た目は十分に整う
- **シンタックスハイライトは意図的に入れない判断**: `react-syntax-highlighter` や `shiki` はバンドルサイズを数百 KB 押し上げる。Zenn 記事のコード例は短い断片が多く、ハイライトなしでも読めるので **バンドルサイズ優先で未導入**。これは Article 3 spec-003 で明示的に "Out of Scope" に格上げした決定
- **`grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` で自動レスポンシブ**: CSS Grid の auto-fit + minmax は、インラインスタイルのままでも media query なしで狭幅時に 2→1 カラムの自動 fallback を実現できる。広い時は 2 列、狭い時は 1 列、という典型的な比較レイアウトに最適
- **ブランドカラーで列を区別**: ChatGPT 列は `#10a37f` (OpenAI 緑)、Claude 列は `#d97757` (Anthropic オレンジ) をラベルに使用。両テーマで色を固定することで、ダーク時でもどちらの回答か一瞬でわかる
- **`isToolRunning` フラグで loading 状態を追従**: `ontoolinput` で `true` に、`ontoolresult` で `false` にする。これで tool 呼び出し中に "考え中…" の loading 表示を出せる。単純だが spec-002 までの実装では抜けていた改善ポイント
- **spec-003 のバンドルサイズ実測**: react-markdown を追加して 313 KB / gzipped 93 KB → **435 KB / gzipped 129 KB** (+122 KB / +36 KB)。予算 500 KB に対して 26%、余裕あり。Article 1 の spec-003 (Recharts 投入) が gzipped 190 KB だったのと比較すると、比較 UI の方が軽い

## Gotchas

<!-- Document pitfalls, edge cases, or failure modes. -->

- **Claude Max サブスクでは Claude API キーは別契約**: 月額の Max プランと Claude API (従量課金) は別会計。記事読者が誤解しないよう明記
- **ChatGPT の MCP Apps 実装は制約あり**: 2026-04 時点で UI からのツール再呼び出しは一部未対応とされる (Article 1 の gemini.md 参照)。`ask_claude` が初回ツール呼び出しで完結する設計にするのが安全
- **`@anthropic-ai/sdk` の model 識別子**: `claude-sonnet-4-6` / `claude-opus-4-6` のようなバージョン付きが推奨。aliases は互換維持用で本番では specific name を pin する
- **Anthropic API の rate limit エラー**: 429 で返る。`anthropic-ratelimit-*` ヘッダでリセット時間を取得できるので、`Result<T>` の rate_limited エラーに詰めて UI に返す

## Testing Notes

<!-- Record durable testing patterns, not one-off execution logs. -->

- **実 API を叩くスモークテスト**: `ANTHROPIC_API_KEY` を env にセットして、`askClaude("1+1 は?", { model: "sonnet" })` で通ることを `tsx -e` で検証。これは Article 1 の GitHub API スモークと同じパターン

## Article Publication Record

<!-- Record the Zenn article URL once published, plus any post-publication feedback. -->
