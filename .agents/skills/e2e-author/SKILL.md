---
name: e2e-author
description: Plan 契約フェーズ2（該当時）。E2E 追加・更新・省略の判断と Playwright spec 作成。GATE0 E2E 方針と整合させる。
argument-hint: "<issue-number>"
triggers:
  - user
  - model
---

# E2E テスト作成（Plan 契約フェーズ2）

## 前提

- GATE0 成果物の **E2E 方針**（追加 / 更新 / 省略 + 理由）に従う
- 手順正本: `docs/development-process.md`「ローカル E2E 実行」、`docs/qa-checklist.md`

## E2E を追加・更新する条件

- Issue がユーザー導線を追加または変更し、既存 E2E で覆えない
- GATE0 で QA Agent が E2E 追加を approved している
- 認証・保存・主要ナビゲーションに触れる変更

## E2E を省略できる条件

- ユニット / コンポーネント / Convex テストで完了条件を十分カバーしている
- ドキュメントのみ、typo、振る舞い不変のリファクタ
- GATE0 で省略理由が記録されている

省略時は PR 本文に理由を書く。

## spec 作成の注意

- 既存 `e2e/*.spec.ts` のパターンと `e2e/helpers/auth.ts`（`gotoAuthenticated`）に合わせる
- Playwright `.or()` は複数マッチしやすい。strict mode violation を避け、`.first()` 等で 1 件に限定する
- ロケーターは role / label / test id を優先する
- 新 spec 追加後、該当 spec を単体実行して通ることを確認する

```bash
pnpm exec playwright test e2e/<spec>.spec.ts --project=chromium
```

## 実行前（ローカル E2E）

- `docs/development-process.md`「`.env.local` 同期」を **E2E の直前毎回** 実施する
- 未導入なら一度 `pnpm exec playwright install chromium`
- `convex/**` 変更がある場合は先に `pnpm exec convex dev --once`

## 完了条件

- GATE0 E2E 方針どおり spec を追加/更新した、または省略理由を PR/Issue に記録した
- 次フェーズ: `verify-pre-push`
