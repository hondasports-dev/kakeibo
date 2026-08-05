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

## 2. `.env.local` の同期

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

## 3. `e2e:env-sync` の扱い

`pnpm run e2e:env-sync` は `convex env set E2E_CLEANUP_SECRET` を実行する。
Cloud Devin では Convex CLI のアクセストークン（`DEV_CONVEX_DEPLOY_KEY` 等）が
セッションに渡っていないことがあり、以下のように 401 になる。

```
MissingAccessToken: An access token is required for this command.
Authenticate with `npx convex dev`
```

この場合、`.env.local` の `E2E_CLEANUP_SECRET` が Convex 側と既に一致しているか
`curl` で確認する（データは変更しない）。

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST "${VITE_CONVEX_SITE_URL}/e2e/cleanup-auth-check" \
  -H "Content-Type: application/json" \
  -H "X-E2E-Cleanup-Secret: ${E2E_CLEANUP_SECRET}" \
  -d '{}'
```

- 200 が返れば同期済みなので、以下のように `E2E_SKIP_ENV_SYNC=1` を指定してテストを実行する。
- 401 が返れば `.env.local` / Convex 側の `E2E_CLEANUP_SECRET` がずれている。
  その場合は `DEV_CONVEX_DEPLOY_KEY` を取得できる lead / CI 任せにし、
  ローカルで勝手に `convex env set` して値を変えないこと。

## 4. Smoke E2E 実行

```bash
E2E_SKIP_ENV_SYNC=1 pnpm run e2e:smoke -- --project=chromium --workers=1
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
| `MissingAccessToken` in `e2e:env-sync` | `E2E_SKIP_ENV_SYNC=1` 、 cleanup auth 200 を確認して実行 |
| `browserType.launch: Executable doesn't exist` | `pnpm exec playwright install chromium --with-deps` |
| テストが flaky | 1 回だけ再実行。2 回連続失敗なら `stuck-advisor` を使う |
| Vite dev server が起動しない | `pnpm run dev` 単独で `http://localhost:5173` が立つか確認 |

## 禁止事項

- `.env.local` や secret 値をログ / チャット / コミットに出力しない
- `convex env set E2E_CLEANUP_SECRET` を手動で実行して CI / 他 worktree と値をずらさない
- `--workers` を増やさない（単一 Clerk テストユーザー・共有 Dev DB の競合を避ける）
