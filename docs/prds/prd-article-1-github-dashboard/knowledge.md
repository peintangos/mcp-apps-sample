# Knowledge — Article 1: GitHub Dashboard MCP App

## Reusable Patterns

- **サンプル実装のディレクトリ位置**: `projects/article-1/` をリポジトリルート直下に置き、PRD ごとに完全に独立した package.json / node_modules を持つ構成を採用。Article 2 (予定) も同じパターン (`projects/article-2/`) で追加する。これによりリポジトリルートの Ralph Matsuo テンプレ検証 (`npm test` 等) と衝突しない
- **TypeScript サーバーの直接起動**: `tsx` を devDependency に入れて、`"start": "tsx server.ts"` で TypeScript ソースを直接実行する。`ts-node` より軽く ESM とも相性が良い

## Integration Notes

- **パッケージマネージャ**: 各 `projects/article-*/` が独自の package.json と node_modules を持つ。root (`mcp-apps-sample/`) の package.json は Ralph Matsuo テンプレ検証専用
- **`.gitignore` の扱い**: root の `.gitignore` に `node_modules/` が入っているため `projects/article-1/node_modules/` も自動で除外される
- **root `npm test` は bash シンタックスチェックのみ**: `bash -n scripts/*.sh scripts/ralph/*.sh .github/scripts/*.sh .claude/hooks/*.sh` を実行している。projects 配下の変更では回帰しない

## Gotchas

- **Express 5 系を初期化時に採用**: 2026-04-12 の `npm install express` で `^5.2.1` が入った。Express 4 系とは middleware API に差分があるため、記事やサンプルコードは "Express 5 前提" で統一する
- **React 19 系を初期化時に採用**: `^19.2.5` が入る。一部のサードパーティ React ライブラリが 19 対応していない可能性があるため、spec-003 で Recharts を導入する際に互換性確認が必要
- **TypeScript 6 系を初期化時に採用**: `^6.0.2` が入る。`tsconfig.json` の `module` / `moduleResolution` 設定は TS 6 のデフォルトに従う
- **Vite 8 系を初期化時に採用**: `^8.0.8` が入る。`vite.config.ts` は spec-001 task 4 で作成する (Vite 8 の config 形式に準拠)
- **`@modelcontextprotocol/ext-apps` / `sdk` は strict ESM**: `require('pkg/package.json')` は `ERR_PACKAGE_PATH_NOT_EXPORTED` で失敗する。バージョン確認は `npm list --depth=0` を使う

## Testing Notes

<!-- Record durable testing patterns, not one-off execution logs. -->

## Article Publication Record

<!-- Record the Zenn article URL once published, plus any post-publication feedback. -->
