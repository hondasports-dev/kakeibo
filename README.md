# kakeibo

週1回レシートをまとめて入力するWeb家計簿アプリです。

## ローカル起動

```bash
pnpm install
pnpm run dev -- --host 127.0.0.1
```

## 主要ドキュメント

| 用途 | 参照先 |
| --- | --- |
| 現在の進捗、次アクション | `PROJECT_STATUS.md` |
| プロダクト要件 | `REQUIREMENTS.md` |
| 技術設計、認証、環境分離 | `TECHNICAL_DESIGN.md` |
| UI/UX、MUI方針、入力フロー | `UI_UX_DESIGN.md` |
| 外部サービス操作ツールのセットアップ | `SERVICE_TOOLING_SETUP.md` |
| 開発プロセス、PR、CI、レビュー | `docs/development-process.md` |

## Codexでの作業

このリポジトリでは、Codex向けの共有Skillを `.agents/skills/kakeibo-*` に置きます。

| Skill | 用途 |
| --- | --- |
| `$kakeibo-virtual-company` | 仮想ソフト開発会社の役割分担、作業分解、ワークフロー選択 |
| `$kakeibo-service-ops-safety` | Clerk、Vercel、Convex、Chrome DevTools MCP、secret、production操作前の安全確認 |
| `$kakeibo-browser-verification` | Chrome DevTools MCPによる画面、Console、Network、DOM確認 |

`agents/` 配下はCodexの実行時サブエージェントではなく、役割別プロンプト集です。詳細な使い方は `OPERATING_MANUAL.md` と `COMPANY.md` を参照してください。

## ローカル状態とsecret

主要なローカルsecretとサービス状態はGit管理外です。

- `.env.local`
- `.vercel/`
- `.agents/` 配下の生成物
- `.pnpm-store/`
- `.npmrc`
