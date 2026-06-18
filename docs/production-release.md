# DEV / PREVIEW / PROD リリース手順

このドキュメントは、kakeibo のリリース経路を DEV / PREVIEW / PROD に分けて扱うための運用手順を定義する。

PROD 反映の正規ルートは `.github/workflows/production-release.yml` とし、`main` への push で自動起動する。
ただし、GitHub Environment `production` の承認後にだけ本番反映を行う。Actions 以外の Vercel Dashboard、Convex Dashboard、ローカル CLI からの直接 Production deploy は正規ルートにしない。

## 環境の役割

| 環境    | Vercel                         | Convex                         | Clerk                | 用途                         |
| ------- | ------------------------------ | ------------------------------ | -------------------- | ---------------------------- |
| DEV     | Local / 通常の Vercel Preview  | Development deployment         | Development instance | 日常開発、PR単位の確認       |
| PREVIEW | `preview` branch の Vercel Preview | fixed staging deployment       | Development instance | 統合確認、マイルストーン候補確認 |
| PROD    | Vercel Production              | Production deployment          | Production instance  | 実ユーザー向け               |

PREVIEW は本番DBのコピーではない。Convex staging deployment は固定の非本番バックエンドとして扱い、PROD / DEV のデータや functions と混在させない。

## DEV から PREVIEW までの流れ

```text
PRをpreviewへmerge
  ↓
preview-deploy.yml が固定 staging Convex と Vercel Preview を更新
  ↓
PREVIEW URLで候補確認
  ↓
PRをmainへmerge
  ↓
production-release.yml が自動起動
  ↓
preflight後、GitHub Environment: production の承認待ち
  ↓
承認後にPRODへ反映
  ↓
マイルストーン内のIssue / PRをすべてclose
  ↓
マイルストーンをclose
  ↓
milestone-preview-ready.yml が準備チェックを実行
  ↓
必要に応じて Preview Release workflowを手動実行
  ↓
PREVIEW URLで候補確認
```

`milestone-preview-ready.yml` は準備チェック専用であり、PREVIEWへデプロイしない。

通常の PREVIEW デプロイは、`preview` branch への push で `preview-deploy.yml` が自動実行する。
マイルストーン候補を明示的に再作成したい場合は、`preview-release.yml` を `workflow_dispatch` で手動実行する。

入力値:

| 入力               | 例        | 説明                                      |
| ------------------ | --------- | ----------------------------------------- |
| `milestone_number` | `15`      | close済みマイルストーン番号               |
| `source_ref`       | `preview` | デプロイ対象ref。`preview`、`main`、または `release/*` のみ |

## PREVIEW release candidate の事前条件

- 対象マイルストーンが close されている。
- マイルストーン内の open issue / PR が 0 件である。
- マイルストーンに含まれる PR が merge 済みである。
- `source_ref` が `preview`、`main`、または `release/*` である。
- `pnpm run lint`、`pnpm run format:check`、`pnpm test --run`、`pnpm run build` が成功する。
- DB/schema変更がある場合、代表データと migration/backfill 要否が説明できる。

## PREVIEW に必要な設定

GitHub Environment `Preview` に以下を設定する。

| 種類     | 名前                | 用途                                  |
| -------- | ------------------- | ------------------------------------- |
| Secret   | `VERCEL_TOKEN`      | GitHub Actions から Vercel CLI を実行する |
| Secret   | `CONVEX_DEPLOY_KEY` | 固定 Convex staging deployment へ反映する |
| Variable | `VERCEL_ORG_ID`     | Vercel project の所属ID               |
| Variable | `VERCEL_PROJECT_ID` | Vercel project ID                     |

`CONVEX_DEPLOY_KEY` は、固定 staging deployment 用の deploy key を設定する。
`preview-deploy.yml` と `preview-release.yml` は、この key で staging functions / schema を更新してから Vercel Preview を作成する。

Vercel Preview Environment には `VITE_CLERK_PUBLISHABLE_KEY` を Clerk Development instance の公開鍵で設定する。

Convex staging deployment には、少なくとも以下を設定する。

- `CLERK_JWT_ISSUER_DOMAIN`
- `CLERK_SECRET_KEY`
- `RECEIPT_IMAGE_EXTRACTOR_MODE=mock`
- `APP_ENV=preview`

`OPENAI_API_KEY` は PREVIEW に設定しない。通常検証で実OpenAI APIを呼ばない。

## PROD 反映フロー

PREVIEW 環境をそのまま PROD へ向け替える運用にはしない。PREVIEW で検証した同じ commit / ref を、Production 環境へ再デプロイする。

```text
PREVIEWで検証したcommit/refを確定
  ↓
main への merge で production-release.yml が自動起動
  ↓
preflight（入力確認、lint、format、test、build）
  ↓
GitHub Environment: production の承認待ち
  ↓
承認後に Convex Production へ反映
  ↓
Vercel Production へ反映
  ↓
PROD smoke checklist
  ↓
Actions Summary に結果を残す
```

`production-release.yml` は、`main` への push と手動実行の両方を受け付ける。

`main` push では、merge commit の SHA を `source_ref` として扱い、
`preview -> main` のブランチ運用により PREVIEW 確認済みとみなす。
実際の Production 反映は GitHub Environment `production` の承認後にだけ実行される。

手動実行時の入力値:

| 入力 | 例 | 説明 |
| --- | --- | --- |
| `source_ref` | `main` | PREVIEWで検証済みの ref。`main` または `release/*` のみ |
| `preview_confirmed` | `true` | 同じ ref を PREVIEW で確認済みであることの明示確認 |
| `db_schema_change_check` | `no_db_or_schema_change` | DB/schema 変更なし、または forward-fix 前提の確認済みを選ぶ |
| `release_note` | `m15 PREVIEW URL確認済み` | PREVIEW evidence またはリリース意図の短いメモ |

`preflight` job は GitHub Environment `production` の承認前に実行される。`production` job には必ず `environment: production` を設定し、GitHub 側の required reviewers / prevent self-review / branch rule で承認を強制する。

## Production に必要な設定

GitHub Environment `production` に以下を設定する。

| 種類     | 名前                   | 用途                                  |
| -------- | ---------------------- | ------------------------------------- |
| Secret   | `VERCEL_TOKEN`         | GitHub Actions から Vercel CLI を実行する |
| Secret   | `CONVEX_DEPLOY_KEY`    | Convex Production deployment へ反映する |
| Variable | `VERCEL_ORG_ID`        | Vercel project の所属ID               |
| Variable | `VERCEL_PROJECT_ID`    | Vercel project ID                     |
| Variable | `PRODUCTION_SMOKE_URL` | 任意。custom domain など smoke 対象を固定したい場合に設定 |

GitHub Environment `production` 側で設定するもの:

- Required reviewers を有効にする。
- Prevent self-review を有効にする。
- Deployment branch rule で `main` または許可した `release/*` branch だけに絞る。
- PROD 用の値は `production` environment にだけ置く。
- 必要に応じて Wait timer を設定する。

Convex Production deployment には Production 用の環境変数を設定する。`RECEIPT_IMAGE_EXTRACTOR_MODE=real` は `APP_ENV=production` とセットでのみ使う。

Vercel Production Environment には Clerk Production instance と Convex Production URL に対応する値だけを設定する。DEV/PREVIEW の `pk_test_*` / `sk_test_*` や Convex dev / preview URL は流用しない。

## DB/schema変更時のチェックリスト

- schema変更内容を PR または Issue に明記する。
- 既存データとの互換性を確認する。
- migration / backfill の要否を判断する。
- 旧schema相当、新schema相当、optional field 欠損を含む代表データで確認する。
- `groupId` あり/なし、owner/member 混在など、認可境界に関わるデータを確認する。
- PROD反映前提の rollback に頼らず、forward-fix 方針を確認する。
- `production-release.yml` の `db_schema_change_check` は、変更なしなら `no_db_or_schema_change`、変更ありなら `reviewed_forward_fix_plan` を選ぶ。

## PREVIEW smoke checklist

- GoogleログインまたはE2E認証でアプリへ入れる。
- グループ未所属 / 所属済みの導線が破綻しない。
- レシート登録、編集、削除ができる。
- 週次サマリーが表示される。
- 設定保存ができる。
- レシート画像抽出は mock mode として動作し、実OpenAI APIを呼ばない。
- Convex / Clerk / Vercel の接続先が DEV / PROD と混在していない。

## PROD smoke checklist

初期の PROD smoke は非破壊確認に限定する。Production データの作成、更新、削除を自動テストで行わない。

- `production-release.yml` が Vercel Production deployment URL または `PRODUCTION_SMOKE_URL` へ HTTP GET を行い、空でない応答を確認する。
- Clerk Production のサインイン画面またはアプリ shell が表示可能であることを手動確認する。
- Convex / Clerk / Vercel の接続先が PROD 用であり、DEV/PREVIEW と混在していないことを確認する。
- 主要CRUDなどデータ変更を伴う確認は、自動 smoke ではなくリリース後の手動確認として必要最小限で行う。

## 直接 Production deploy の扱い

Actions で防ぐこと:

- 承認なしの PROD deploy
- `main` / 許可 branch 以外からの PROD deploy
- test / lint / build 未通過の PROD deploy
- PREVIEW 未確認の PROD deploy
- DB/schema 変更チェック未記入の PROD deploy
- PROD 反映 workflow の二重実行
- PROD 用の値が DEV/PREVIEW に流れること

Actions だけでは防ぎにくいこと:

- Vercel Dashboard からの直接 Production deploy
- Vercel Git Integration による main push 時の自動 Production deploy
- ローカル端末からの直接 Production deploy
- Convex / Vercel / Clerk の管理画面での直接変更

そのため、Actions 以外を PROD 反映の正規ルートにしない。緊急対応で直接操作が必要な場合も、事前承認、操作内容、影響範囲、結果を Issue または PR に残す。

## Forward-fix 方針

PROD 反映後に不具合が見つかった場合、既存データの破壊的 rollback を前提にしない。原則として、修正 commit を作り、必要な検証を通したうえで同じ `production-release.yml` から forward-fix release として反映する。
