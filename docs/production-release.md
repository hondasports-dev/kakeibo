# DEV / PREVIEW / PROD リリース手順

このドキュメントは、kakeibo のリリース経路を DEV / PREVIEW / PROD に分けて扱うための運用手順を定義する。

現時点では **PROD 反映 workflow は未構築** とする。Clerk Production は独自ドメインが必要なため、ドメイン取得と Clerk Production activation が完了するまで PROD 反映は手動運用にも進めない。

## 環境の役割

| 環境    | Vercel                         | Convex                         | Clerk                | 用途                         |
| ------- | ------------------------------ | ------------------------------ | -------------------- | ---------------------------- |
| DEV     | Local / 通常の Vercel Preview  | Development deployment         | Development instance | 日常開発、PR単位の確認       |
| PREVIEW | 手動実行した Vercel Preview RC | Preview deployment             | Development instance | マイルストーン単位の候補確認 |
| PROD    | Vercel Production              | Production deployment          | Production instance  | 実ユーザー向け。本手順では未対応 |

PREVIEW は本番DBのコピーではない。Convex Preview deployment は fresh backend として扱い、PROD / DEV のデータや functions と混在させない。

## DEV から PREVIEW までの流れ

```text
PRをmainへmerge
  ↓
マイルストーン内のIssue / PRをすべてclose
  ↓
マイルストーンをclose
  ↓
milestone-preview-ready.yml が準備チェックを実行
  ↓
Preview Release workflowを手動実行
  ↓
PREVIEW URLで候補確認
```

`milestone-preview-ready.yml` は準備チェック専用であり、PREVIEWへデプロイしない。

PREVIEWデプロイは `preview-release.yml` を `workflow_dispatch` で手動実行する。

入力値:

| 入力               | 例     | 説明                                      |
| ------------------ | ------ | ----------------------------------------- |
| `milestone_number` | `15`   | close済みマイルストーン番号               |
| `source_ref`       | `main` | デプロイ対象ref。初期運用では `main` または `release/*` のみ |
| `preview_name`     | `m15`  | Convex Preview deployment名               |

`preview_name` は、Convex Preview deployment に付ける一時的な識別名である。
マイルストーン単位の release candidate では、`m<マイルストーン番号>` を基本形にする。
例: milestone #15 なら `m15`。

同じ `preview_name` で再実行すると、`convex deploy --preview-create` により同名の
Convex Preview deployment を作り直す。候補を上書き確認する場合は `m15` を再利用し、
履歴を分けたい場合は `m15-rc1`、`m15-rc2` のように suffix を付ける。

`preview_name` は `^[a-z0-9][a-z0-9-]{0,31}$` に一致させる。
`M15`、`m15_rc1`、`m15/rc1` は使わない。

## PREVIEW release candidate の事前条件

- 対象マイルストーンが close されている。
- マイルストーン内の open issue / PR が 0 件である。
- マイルストーンに含まれる PR が merge 済みである。
- `source_ref` が `main` または `release/*` である。
- `pnpm run lint`、`pnpm run format:check`、`pnpm test --run`、`pnpm run build` が成功する。
- DB/schema変更がある場合、代表データと migration/backfill 要否が説明できる。

## PREVIEW に必要な設定

GitHub Environment `Preview` に以下を設定する。

| 種類   | 名前                | 用途                                  |
| ------ | ------------------- | ------------------------------------- |
| Secret | `VERCEL_TOKEN`      | GitHub Actions から Vercel CLI を実行する |
| Secret | `CONVEX_DEPLOY_KEY` | Convex Preview deployment を作成・更新する |
| Variable | `VERCEL_ORG_ID`   | Vercel project の所属ID               |
| Variable | `VERCEL_PROJECT_ID` | Vercel project ID                    |

`CONVEX_DEPLOY_KEY` は、Convex Dashboard の Project Settings で作成する
Project-level の Preview Deploy Key を設定する。`pnpm exec convex deployment token create`
で作る既存 deployment 用 deploy key では、`preview-release.yml` の
`convex deploy --preview-create` に使わない。

Vercel Preview Environment には `VITE_CLERK_PUBLISHABLE_KEY` を Clerk Development instance の公開鍵で設定する。

Convex Project の Preview / Development 用 default environment variables には、少なくとも以下を設定する。

- `CLERK_JWT_ISSUER_DOMAIN`
- `CLERK_SECRET_KEY`
- `RECEIPT_IMAGE_EXTRACTOR_MODE=mock`
- `APP_ENV=preview`

`OPENAI_API_KEY` は PREVIEW に設定しない。通常検証で実OpenAI APIを呼ばない。

## DB/schema変更時のチェックリスト

- schema変更内容を PR または Issue に明記する。
- 既存データとの互換性を確認する。
- migration / backfill の要否を判断する。
- 旧schema相当、新schema相当、optional field 欠損を含む代表データで確認する。
- `groupId` あり/なし、owner/member 混在など、認可境界に関わるデータを確認する。
- PROD反映前提の rollback に頼らず、forward-fix 方針を確認する。

## PREVIEW smoke checklist

- GoogleログインまたはE2E認証でアプリへ入れる。
- グループ未所属 / 所属済みの導線が破綻しない。
- レシート登録、編集、削除ができる。
- 週次サマリーが表示される。
- 設定保存ができる。
- レシート画像抽出は mock mode として動作し、実OpenAI APIを呼ばない。
- Convex / Clerk / Vercel の接続先が DEV / PROD と混在していない。

## PROD は今回の対象外

PROD 反映は、以下が完了してから別途構築する。

- 独自ドメイン取得
- Clerk Production activation
- Google OAuth Production credentials 設定
- GitHub Environment `Production` の required reviewers / prevent self-review / branch rule 設定
- Convex Production deploy key の作成
- `production-release.yml` の追加
- PROD smoke test の非破壊化

PROD では Preview deployment の promote を初期方針として採用しない。PREVIEWで確認した同じ commit / ref を、Production 環境へ再デプロイする。
