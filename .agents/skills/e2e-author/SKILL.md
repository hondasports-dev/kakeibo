---
name: e2e-author
description: GATE0 の E2E 方針に従って Playwright spec の追加・更新・省略を決める。Plan 契約フェーズ2や、ユーザー導線・認証・保存・主要ナビゲーションの変更時に使う。
---

# E2E テスト作成（Plan 契約フェーズ2）

## 目的

Issue の受け入れ条件を適切な Playwright E2E で検証し、不要な場合は根拠を残す。

## 入力

- Issue 番号
- GATE0 の E2E 方針と受け入れ条件

## 前提

- GATE0 成果物の **E2E 方針**（追加 / 更新 / 省略 + 理由）に従う
- 手順正本: `docs/development-process.md`「ローカル E2E 実行」、`docs/qa-checklist.md`
- E2E追加・更新はMainが判断して修正Handoffへ含め、同じImplementerが編集する。QA Agentは論理read-onlyで、必要性、原因、対象spec、修正方針だけを返す。
- branch、worktree、stage、commit、push、PR、E2E再実行のトリガーはMainが管理する。

## E2E を追加・更新する条件

- Issue がユーザー導線を追加または変更し、既存 E2E で覆えない
- GATE0 で QA Agent が E2E 追加を approved している
- 認証・保存・主要ナビゲーションに触れる変更

## E2E を省略できる条件

- ユニット / コンポーネント / Convex テストで完了条件を十分カバーしている
- ドキュメントのみ、typo、振る舞い不変のリファクタ
- GATE0 で省略理由が記録されている

省略時は PR 本文に理由を書く。

**環境不足や実行失敗は E2E の省略理由にしない。**
GATE0 で E2E が必要と判断された変更は、ローカル E2E が成功するまで後続フェーズへ進まない。

## spec 作成の注意

- 既存 `e2e/*.spec.ts` のパターンと `e2e/helpers/auth.ts`（`gotoAuthenticated`）に合わせる
- Playwright `.or()` は複数マッチしやすい。strict mode violation を避け、`.first()` 等で 1 件に限定する
- ロケーターは role / label / test id を優先する
- 新 spec 追加後、該当 spec を単体実行して通ることを確認する

```bash
pnpm exec playwright test e2e/<spec>.spec.ts --project=chromium
```

## 実行前（ローカル E2E）

- worktree 作成直後に `preview` 用 worktree の正本 `.env.local` をコピーする
- 正本 `.env.local` が無い場合は `docs/development-process.md` の bootstrap 手順で復旧する
- E2E の直前毎回 `pnpm run e2e:env-sync` を実行し、`.env.local` コピー、Convex `E2E_CLEANUP_SECRET` 反映、cleanup 認証確認まで成功させる
- 未導入なら一度 `pnpm exec playwright install chromium`
- `convex/**` 変更がある場合は `.env.local` 同期後に `pnpm exec convex dev --once` を成功させる

## 完了条件

- GATE0 E2E 方針どおり spec を追加/更新した、または要件上 E2E 不要と判断した根拠を記録した
- E2E が必要な変更では、必要な `.env.local` 同期、Convex 反映、ローカル E2E が成功している
- spec の追加・更新を同じImplementerが担当し、Main integrity checkを通過した
- 次フェーズ: `verify-pre-push`

## 停止条件と出力

- 必要な `.env.local` や資格情報がない場合は値を作らず、正本の bootstrap / 同期手順で復旧する。
- `pnpm run e2e:env-sync`、必要な `pnpm exec convex dev --once`、ローカル E2E のいずれかが失敗した場合は停止する。
- 実行不能理由を Issue / PR に記録するだけで `verify-pre-push`、review、push、PR 作成へ進まない。
