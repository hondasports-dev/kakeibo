---
name: code-review
description: Verification PASS後、baseとの差分を独立観点でレビューし、正しさ、回帰、保守性、テスト妥当性の指摘をclosureまで追跡する。
---

# Code Review

## 目的

Issue / Acceptance Criteriaに対する差分の正しさと回帰リスクを確認し、**実装者の自己評価とは別の観点**でPASS/FAILを判定する。

セキュリティ最終判定は次工程 `security-review` の独立Gateとするが、明らかなsecurity defectを見つけた場合はCode ReviewでもMust-fixにする。

## 前提

- `VERIFICATION: PASS`
- AGENTS.mdの常時必須Skillを適用済み

## 入力

- REQUIREMENTS成果物
- IMPACT_ANALYSIS成果物
- Verification Evidence
- baseとの差分（デフォルト `origin/preview`）

## 原則

- レビュー中はまず読み取りに徹し、見つけた問題を即座に編集して隠さない。
- 問題がない場合も、確認した観点を明示する。
- diffだけでなくcaller / shared moduleなど**変更されていない影響先**も見る。
- 指摘には「問題」「なぜ問題か」「再現/影響」「修正方向」を含める。
- Review中に差分を変更した場合、Verificationへ戻る。

## 1. 差分確定

```bash
git fetch origin preview
git diff origin/preview...HEAD --name-only
git diff origin/preview...HEAD
git log --oneline origin/preview..HEAD
```

別baseが明示されている場合はそれを使う。

trackedだけでなくuntrackedも確認する。

## 2. 目的との一致

- Acceptance Criteriaを満たす変更か
- scope外変更がないか
- Preserve対象の既存挙動を壊していないか
- Impact Analysisで挙げたcaller / regression riskに対応しているか
- Verificationが実際の変更範囲を覆っているか
- 実装時に新しく発見した影響がRequirements / Impactへ反映されているか

## 3. 共通レビュー

### Correctness

- 正常系
- 異常系
- 境界値
- error handling
- null / undefined / empty / zero
- async / race / stale state
- retry / duplicate / idempotency（該当時）

### Contract

- API / type / schema契約
- callerとの互換性
- validation
- error type / message

### Maintainability

- 責務分離
- 命名
- 重複
- 不要な抽象化
- 不要な依存
- scope外リファクタ

### Performance

- 明らかなN+1
- 不要なfull scan / collect
- unnecessary rerender / effect
- 大きな同期処理

## 4. Frontend観点（`src/**`）

- loading / error / empty state
- `null` / `undefined` / empty array / `0`の扱い
- render中の副作用
- derived stateの不要なstate化
- `useEffect` dependencyの過不足
- `useQuery` / `useMutation` 引数の安定性
- mutation failure表示の一貫性
- API不整合を境界層で扱っているか
- click可能要素のa11y
- stable key
- Playwright locatorの一意性
- UIからConvex server implementationを直接importしていないか
- responsive / keyboard / focusが既存UIを壊していないか

## 5. Backend / Convex観点（`convex/**`）

先に `convex/_generated/ai/guidelines.md` を確認する。

- public functionのargs / returns validator
- await漏れ
- queryで非決定的な時刻取得をしていないか
- 大量 `.collect()` / scan / index不足
- N+1に近いread
- OCC競合しやすいread-modify-write
- wrapperとdomain logicの責務
- existing callerとの契約整合
- mutation失敗時のpartial update / rollbackリスク
- schema変更にmigration / compatibility考慮があるか

## 6. テスト妥当性

変更ロジックに対応する `.test.{ts,tsx}` / `convex/**/*.test.ts` / `e2e/*.spec.ts` を確認する。

### 正常系

- テスト名が「条件→結果」を表す
- `expect` が業務仕様を検証する
- UI/E2Eではユーザーが観測する最終状態をassertする

### Edge

- 0 / min / max / 境界前後
- empty / whitespace / special chars
- empty / 1 / many / duplicate
- month-end / year boundary / timezone
- undefined / null / omitted

### 準異常

- 未ログイン / 未所属 / 権限不足
- 古いデータ / 部分入力
- concurrent / duplicate / OCC
- external dependency partial state

### 異常

- validation
- auth / authorization拒否
- DB / network / external service failure
- user-visible error
- rollback / failure result

### Assertion quality

- `toBeDefined()` や `not.toThrow()` だけで重要仕様を済ませていない
- throw時は可能な範囲でmessage / typeまで見る
- async assertionにawait漏れがない
- snapshot更新が意図した差分か確認する

### Layer choice

- E2Eでしか確認できない導線/認可をunitだけで済ませていない
- unitで十分な純粋ロジックを無駄にE2E重複していない

## Findings分類

### Must-fix

次はPASS前に必ず解消する。

- bug
- Acceptance Criteria未達
- 現実的な回帰
- 必要test不足
- type/API契約破壊
- data loss等の重大リスク
- 明らかな認証・認可漏れ

### Nice-to-have

本Issueの正しさに直接影響しない改善。

closureルール:

- **diff内ファイル**に関するもの: scopeを不必要に広げず安全に修正できるなら今回修正する。修正で挙動が変わる場合はVerificationへ戻る。
- **diff外ファイルのみ**に関するもの: 今回のscopeへ混ぜず、必要ならfollow-up Issue候補として分離する。
- 本質的にMust-fixなのにNice-to-haveへ降格しない。

## Review-Fix Loop

Must-fixが1件でもあれば:

```text
CODE_REVIEW FAIL
  ↓
IMPLEMENTATION
  ↓
VERIFICATION
  ↓
CODE_REVIEW（全観点を再実行）
```

前回指摘だけ確認してPASSにしない。

同じ指摘が2回再発したら `incident` を使って前提・修正方針を見直す。

## Integrity Check

PASS直前にtracked / untrackedを再確認し、レビュー中にscope外変更が混ざっていないことを確認する。

## 出力

```text
CODE_REVIEW
Status: PASS | FAIL
Base:
Reviewed scope:
Must-fix:
Nice-to-have:
Frontend findings:
Backend findings:
Test adequacy:
Regression / side effects:
Integrity check:
Residual risks:
Evidence:
```

Must-fix 0件かつ確認観点を明示できた場合だけPASS。次は `security-review`。
