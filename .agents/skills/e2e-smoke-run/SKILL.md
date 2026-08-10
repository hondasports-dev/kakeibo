---
name: e2e-smoke-run
description: |
  kakeibo の Cloud Devin / クリーン worktree 環境で `pnpm run e2e:smoke` を完走させる手順。
  依存更新 PR などで golden-path ユーザー導線が壊れていないかを確認するときに使う。
---

# Smoke E2E 実行手順

## 目的

`package.json` 依存更新など、`src/**` や `e2e/**` には触れていない変更でも、
Vite / react-email / tsx などの更新が golden-path フローを破壊していないかを
`@smoke` タグ付き Playwright E2E で確認する。

## 前提

- `pnpm install` 済み
- `package.json` 内の `e2e:smoke` スクリプト: `node scripts/sync-e2e-env.mjs && playwright test --grep @smoke`
- `playwright.config.ts` では `workers: 1`、`project: chromium` のみ定義されている
- ローカル実行時は `webServer` として `pnpm run dev` を自動起動する
- 通常のローカル worktree では `docs/development-process.md` の `.env.local` 正本 / bootstrap 手順に従う

## Devin Secrets Needed

セッション environment または `.env.local` に以下が必要（値は secret 参照）。

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `E2E_CLERK_USER_EMAIL`
- `E2E_CLERK_USER_ID`
- `E2E_CLERK_USER_PASSWORD`
- `CONVEX_DEPLOYMENT`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`
- `E2E_CLEANUP_SECRET`

`.env.local` 生成例は organization blueprint の `knowledge.e2e-env` を参照。

## 1. Playwright Chromium の導入

Cloud Devin ではブラウザが未導入のことがある。

```bash
pnpm exec playwright install chromium --with-deps
```

`--with-deps` は root 権限が必要なシステムライブラリを apt で導入する。
失敗する場合は個別に `fonts-noto-color-emoji libasound2 libcairo2 libcups2 libfreetype6 libglib2.0-0 libnss3 xserver-common xvfb` などを入れてから再試行する。

## 2. `.env.local` の用意

### 通常のローカル worktree

`preview` 用 worktree の正本 `.env.local` を使う。worktree 作成直後にコピーし、
E2E 直前には `pnpm run e2e:env-sync` で再同期する。正本が無い場合は
`docs/development-process.md` の bootstrap 手順で最初の worktree の `.env.local` から復旧する。

### Cloud Devin / session secrets が正本の場合

`.env.local` を session secrets と一致させる。既存ファイルがある場合は
`for key in ...` で各キーが環境変数と一致するか確認する。

```bash
for key in VITE_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY E2E_CLERK_USER_EMAIL \
           E2E_CLERK_USER_ID E2E_CLERK_USER_PASSWORD CONVEX_DEPLOYMENT \
           VITE_CONVEX_URL VITE_CONVEX_SITE_URL E2E_CLEANUP_SECRET; do
  file_val=$(grep -E "^${key}=" .env.local 2>/dev/null | cut -d= -f2-)
  env_val=$(printenv "$key")
  if [ "$file_val" != "$env_val" ]; then
    echo "$key: 不一致（要更新）"
  fi
done
```

不一致がある場合は blueprint の heredoc で `.env.local` を作り直す。
secret 値そのものはログへ出力しない。

## 3. `e2e:env-sync` を必ず成功させる

`pnpm run e2e:env-sync` は次を行う必須ゲートである。

- `.env.local` の正本同期
- `convex env set E2E_CLEANUP_SECRET`
- cleanup 認証確認

通常のローカル worktree:

```bash
pnpm run e2e:env-sync
```

Cloud Devin で現在の `.env.local` を session secrets 由来の正本として使う場合:

```bash
KAKEIBO_E2E_ENV_CANONICAL="$PWD/.env.local" pnpm run e2e:env-sync
```

Convex CLI のアクセストークン（`DEV_CONVEX_DEPLOY_KEY` 等）が無く
`MissingAccessToken` になった場合は、資格情報を復旧して再実行する。
`E2E_SKIP_ENV_SYNC` などで同期を飛ばして E2E だけ実行してはいけない。

cleanup 認証だけ確認したい場合は次を使えるが、これは `e2e:env-sync` の代替にはしない。

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST "${VITE_CONVEX_SITE_URL}/e2e/cleanup-auth-check" \
  -H "Content-Type: application/json" \
  -H "X-E2E-Cleanup-Secret: ${E2E_CLEANUP_SECRET}" \
  -d '{}'
```

- 200: cleanup 認証は一致している。続けて `e2e:env-sync` 自体も成功させる。
- 401: `.env.local` / Convex 側の `E2E_CLEANUP_SECRET` がずれている。正本を復旧して再同期する。

## 4. Smoke E2E 実行

通常のローカル worktree:

```bash
pnpm run e2e:smoke -- --project=chromium --workers=1
```

Cloud Devin で現在の `.env.local` を正本として使う場合:

```bash
KAKEIBO_E2E_ENV_CANONICAL="$PWD/.env.local" pnpm run e2e:smoke -- --project=chromium --workers=1
```

- `--project=chromium`: 唯一のブラウザプロジェクトを明示指定（`setup` プロジェクトは依存関係で自動実行される）
- `--workers=1`: `playwright.config.ts` でも直列だが、明示しておく

## 5. 結果確認

成功時の terminal 出力例:

```
57 passed (6.7m)
```

同時に `playwright-report/index.html` が生成される。
ブラウザで開き、以下を目視確認する:

- All 57 / Passed 57 / Failed 0 / Flaky 0 / Skipped 0
- 各 spec のアコーディオンが緑のチェックマーク
- `test-results/` 内に失敗スクリーンショット・trace がない

## 6. よくあるトラブル

| 症状 | 対処 |
| --- | --- |
| 正本 `.env.local` が見つからない | `docs/development-process.md` の bootstrap 手順で復旧して `e2e:env-sync` を再実行 |
| `MissingAccessToken` in `e2e:env-sync` | Convex CLI の資格情報を復旧して再実行。同期をバイパスしない |
| cleanup auth 401 | 正本 `.env.local` と Convex dev の secret を一致させて再同期 |
| `browserType.launch: Executable doesn't exist` | `pnpm exec playwright install chromium --with-deps` |
| テストが flaky | 1 回だけ再実行。2 回連続失敗なら `stuck-advisor` を使う |
| Vite dev server が起動しない | `pnpm run dev` 単独で `http://localhost:5173` が立つか確認 |

## 禁止事項

- `.env.local` や secret 値をログ / チャット / コミットに出力しない
- `E2E_SKIP_ENV_SYNC` 等で `.env.local` / Convex 同期を飛ばさない
- `convex env set E2E_CLEANUP_SECRET` を手動で実行して CI / 他 worktree と値をずらさない
- env 同期、Convex 反映、E2E の失敗を理由だけ記録して次フェーズ、push、PR 作成へ進まない
- `--workers` を増やさない（単一 Clerk テストユーザー・共有 Dev DB の競合を避ける）
