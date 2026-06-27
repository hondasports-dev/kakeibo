![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/hondasports/kakeibo?utm_source=oss&utm_medium=github&utm_campaign=hondasports%2Fkakeibo&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

# Suzumemo

レシート画像をAIで読み取り、まとめて支出を記録・振り返るための個人向けWeb家計簿アプリです。

UI ブランド名は **Suzumemo**、リポジトリ名は **kakeibo** です。

## ローカル起動

### 1. 依存関係と環境変数

```bash
pnpm install
cp .env.example .env.local
```

`.env.local` に Clerk と Convex の値を設定します。詳細は [`docs/environment-variables.md`](docs/environment-variables.md) を参照してください。

最低限必要な変数:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`（E2E / HTTP エンドポイント用）

### 2. Convex バックエンド

```bash
pnpm run convex:dev
```

または Cursor Cloud 等では `CONVEX_AGENT_MODE=anonymous npx convex dev` で匿名 dev deployment を起動できます（`AGENTS.md` 参照）。

Convex 側には最低限 `CLERK_JWT_ISSUER_DOMAIN` を設定してください:

```bash
pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-frontend-api-url.clerk.accounts.dev
pnpm exec convex env set RECEIPT_IMAGE_EXTRACTOR_MODE mock
pnpm exec convex env set APP_ENV development
```

### 3. フロントエンド

```bash
pnpm run dev -- --host 127.0.0.1
```

ブラウザで `http://localhost:5173` を開きます。

## 検証コマンド

```bash
pnpm test --run
pnpm run lint
pnpm run format:check
pnpm run build
pnpm run e2e:smoke -- --project=chromium
pnpm run e2e -- --project=chromium
```

E2E 実行前は `pnpm exec playwright install chromium` と `.env.local` の同期が必要です（[`docs/development-process.md`](docs/development-process.md) 参照）。

## 主要ドキュメント

### 設計・仕様

| 用途                                 | 参照先                          |
| ------------------------------------ | ------------------------------- |
| プロダクト要件                       | `docs/requirements.md`          |
| 技術設計、認証、環境分離             | `docs/technical-design.md`      |
| UI/UX、MUI方針、入力フロー           | `docs/ui-ux-design.md`          |
| グループ管理・権限                   | `docs/group-admin-permissions.md` |
| 外部サービス操作ツールのセットアップ | `docs/service-tooling-setup.md` |

### 開発プロセス・運用

| 用途                           | 参照先                          |
| ------------------------------ | ------------------------------- |
| 開発プロセス、PR、CI、レビュー | `docs/development-process.md`   |
| 認証ガード設計                 | `docs/auth-guard.md`            |
| 環境変数一覧                   | `docs/environment-variables.md` |
| QAチェックリスト               | `docs/qa-checklist.md`          |
| エージェント運用マニュアル     | `OPERATING_MANUAL.md`           |
| 仮想開発会社の構成             | `COMPANY.md`                    |

## Codex / Devinでの作業

このリポジトリでは、Codex / Devin 向けの共有Skillを `.agents/skills/` に置きます。

| Skill                   | 用途                                                                           |
| ----------------------- | ------------------------------------------------------------------------------ |
| `$issue-gate-0`         | Plan 契約フェーズ0。実装前仕様ゲート                                           |
| `$tdd-implement`        | Plan 契約フェーズ1。TDD 実装（RED/GREEN）                                      |
| `$e2e-author`           | Plan 契約フェーズ2。E2E 追加・更新・省略判断                                   |
| `$verify-pre-push`      | Plan 契約フェーズ3。push 前検証                                                |
| `$code-review`          | Plan 契約フェーズ4。preview 差分のセルフレビュー                               |
| `$babysit-pr`           | PR を merge-ready にする                                                       |
| `$prompt-injection-guard` | GitHub Issue / PRコメント、ログ、Web等の外部由来コンテンツを扱う前の安全確認 |
| `$virtual-company`      | 仮想ソフト開発会社の役割分担、作業分解、ワークフロー選択                       |
| `$service-ops-safety`   | Clerk、Vercel、Convex、Chrome DevTools MCP、secret、production操作前の安全確認 |
| `$browser-verification` | Chrome DevTools MCPによる画面、Console、Network、DOM確認                       |

`.agents/roles/` 配下は実行時サブエージェントではなく、Codex / Devin 共通の役割別プロンプト集です。詳細な使い方は `OPERATING_MANUAL.md` と `COMPANY.md` を参照してください。

## ローカル状態とsecret

主要なローカルsecretとサービス状態はGit管理外です。

- `.env.local`
- `.vercel/`
- `.agents/` 配下の生成物
- `.pnpm-store/`
- `.npmrc`

## License

This project is licensed under the Apache License 2.0.
See [LICENSE](./LICENSE) for details.
