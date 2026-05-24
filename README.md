![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/hondasports/kakeibo?utm_source=oss&utm_medium=github&utm_campaign=hondasports%2Fkakeibo&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

# kakeibo

週1回レシートをまとめて入力するWeb家計簿アプリです。

## ローカル起動

```bash
pnpm install
pnpm run dev -- --host 127.0.0.1
```

## 主要ドキュメント

### 設計・仕様

| 用途                                 | 参照先                          |
| ------------------------------------ | ------------------------------- |
| プロダクト要件                       | `docs/requirements.md`          |
| 技術設計、認証、環境分離             | `docs/technical-design.md`      |
| UI/UX、MUI方針、入力フロー           | `docs/ui-ux-design.md`          |
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
