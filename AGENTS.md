<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## 出力言語

ユーザー向けの回答とドキュメント更新は、すべて日本語で記述してください。
ただし、コード、コマンド、ファイルパス、識別子、プロダクト名は、元の表記のまま
残した方が明確または正確な場合はそのまま記述してください。
コミットメッセージも日本語で記述してください。

## パッケージマネージャー

このプロジェクトのパッケージマネージャーは **pnpm** です。
`npm` コマンドは使わず、必ず `pnpm` を使ってください。

| 用途 | コマンド |
|------|---------|
| スクリプト実行 | `pnpm run <script>` または `pnpm <script>` |
| テスト実行 | `pnpm test` |
| lint | `pnpm run lint` |
| ビルド | `pnpm run build` |
| パッケージ追加 | `pnpm add <pkg>` |
| Convex CLI | `pnpm exec convex <cmd>` または `npx convex <cmd>`（convex は例外として npx 可） |

## ドキュメント参照

コードの実装、修正、レビューを行う前に、作業内容に関連するドキュメントが
`docs/` 配下に存在する場合は確認してください。読む範囲は現在の作業に必要な
ドキュメントに限定し、関連しないドキュメントをデフォルトで読み込まないでください。

特に次のドキュメントを確認してください。

- 開発プロセス、Pull Request、レビュー、CI、GitHub 運用に関わる作業:
  - `docs/development-process.md`
- 設計、仕様、技術判断に関わる作業:
  - `docs/` 配下の関連ドキュメント
- Convex に関わる作業:
  - `convex/_generated/ai/guidelines.md`
  - 必要に応じて `docs/` 配下の関連ドキュメント
