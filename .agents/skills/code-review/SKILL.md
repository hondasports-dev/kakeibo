---
name: code-review
description: Verification PASS後、baseとの差分を独立観点でレビューし、正しさ、回帰、保守性、テスト妥当性の指摘をclosureまで追跡する。
---

# Code Review

## 目的

Issue / Acceptance Criteriaに対する差分の正しさと回帰リスクを確認し、**実装者の自己評価とは別の観点**でPASS/FAILを判定する。

旧 `code-review` の「差分基準」「Must-fix closure」「変更されていない依存先への影響推論」「テストケース判定」を継承する。セキュリティは次工程 `security-review` で独立Gateにする。

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

## 手順

### 1. 差分確定

```bash
git fetch origin preview
git diff origin/preview...HEAD --name-only
git diff origin/preview...HEAD
git log --oneline origin/preview..HEAD
```

別baseが明示されている場合はそれを使う。

### 2. 目的との一致

- Acceptance Criteriaを満たす変更か
- scope外変更がないか
- Impact Analysisで挙げたcaller / regression riskに対応しているか
- Verificationが実際の変更範囲を覆っているか

### 3. 共通レビュー

- 正常系・異常系・境界値
- error handling
- API / type契約
- race / async / stale state
- 責務分離
- 命名
- 重複
- 不要な依存・複雑化
- パフォーマンス上の明らかな退行
- テストが実装詳細ではなく仕様を証明しているか

### 4. Frontend観点（`src/**`）

- loading / error / empty state
- `null` / `undefined` / empty array / `0`の扱い
- render中の副作用
- derived stateの不要なstate化
- `useEffect` dependency
- `useQuery` / `useMutation` 引数の安定性
- mutation failure表示
- API不整合を境界層で扱っているか
- a11y / stable key / locatorの一意性
- UIからConvex server implementationを直接importしていないか

### 5. Backend / Convex観点（`convex/**`）

先に `convex/_generated/ai/guidelines.md` を確認する。

- public functionのargs / returns validator
- await漏れ
- queryで非決定的な時刻取得をしていないか
- 大量 `.collect()` / scan / index不足
- N+1に近いread
- OCC競合しやすいread-modify-write
- wrapperとdomain logicの責務
- existing callerとの契約整合

※認証・認可そのものの最終判定はSecurity Reviewで行うが、明らかな漏れを見つけたらCode ReviewでもMust-fixにする。

### 6. テスト妥当性

- 変更ロジックに対応するtestがある
- 正常、edge、準異常、異常を必要範囲で覆う
- dateなら月末/年跨ぎ/timezone等
- authなら未ログイン/権限不足
- `expect` が業務仕様を検証している
- `toBeDefined` 等だけで重要仕様を済ませていない
- E2Eでしか証明できない導線をunitだけで済ませていない
- unitで十分なロジックを無駄にE2E重複していない

## Findings分類

### Must-fix

- bug
- Acceptance Criteria未達
- 回帰リスクが現実的
- 必要test不足
- type/API契約破壊
- data loss等の重大リスク

PASS前に必ず修正する。

### Nice-to-have

本Issueの正しさに直接影響しない改善。

- diff内で小さく安全に直せるものは今回直してよい
- scopeを広げる改善はフォローアップ候補として分離する
- Nice-to-haveのために無関係な大規模リファクタを始めない

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