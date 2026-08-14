---
name: verification
description: 選択されたRisk Profileに応じて、変更対象テストからfull verificationまで必要十分な検証をEvidence付きで実行する。実装後の実行証拠を得るときに使う。
license: Apache-2.0
---

# Verification

## 目的

「全部実行すれば安全」ではなく、**RiskとAcceptance Criteriaに対応する最小十分な検証**を行う。

テストを追加したことと、実行してPASSしたことは別。

## Profile別

### R0 trivial — targeted

例:

- `git diff --check`
- 対象format / static check
- behavior不変ならruntime testはNOT_REQUIRED根拠を残す

### R1 fast — targeted

原則:

- changed tests
- 変更に必要なlint / type / build
- Acceptance Criteriaで必要な代表E2Eまたはruntime確認

全test / 全coverageをローカルとCIで二重実行しない。CIをauthoritativeにできる全量checkはCIへ寄せる。

### R2 standard — scoped full

- affected unit/component/Convex/integration tests
- lint / format / build等の関連static checks
- changed-file coverageが必要なら実行
- user flow変更なら代表E2E
- shared surfaceなら回帰対象を追加

### R3 high — full for affected scope

- 影響範囲の正常 / 境界 / error / auth拒否 / partial failure
- coverage
- 必要なE2E
- build / runtime / browser
- schema / external service等のreflection or compatibility check

### R4 critical — full + recovery evidence

R3に加え:

- rollback / recovery手順の検証可能性
- destructive / production操作前のdry-run相当Evidence（可能な範囲）
- Human Gateで確認するprecondition

## E2E

E2Eは「毎回」ではなくAcceptance Criteriaが複数層を跨ぐ時に使う。

代表的required:

- navigation / major user flow
- authentication / authorization
- save / delete
- browserでしか証明できない状態

unit / component / Convexで十分ならNOT_REQUIREDにできる。

環境不足や失敗は、省略理由にはしない。requiredなら復旧またはBLOCKED。

## Suzumemo E2E environment

E2E対象変更では既存手順を使う。

```bash
pnpm run e2e:env-sync
```

Convex反映が必要なら:

```bash
pnpm exec convex dev --once
```

`.env.local` の正本やsecret値をlogへ出さない。

## Risk escalation

Verification中に想定より広い影響を発見した場合、現在profileのcheckを増やすだけで済ませずRequirements / Impactへ戻してRiskを再判定する。

例:

- local UIだと思ったがshared providerへ影響 → R1→R2
-通常query変更だと思ったがauthorization boundaryへ影響 → R2→R3

## FAIL

- code defect → Implementation
- spec mismatch → Requirements
- unknown / repeated failure → Incident
- required environment unavailable → BLOCKED / Incident

同じ失敗を惰性で繰り返さない。

## Evidence

```text
VERIFICATION
Status: PASS | FAIL | BLOCKED
Risk level:
Profile:
Checks:
Coverage:
E2E:
Runtime/browser:
Skipped checks + reason:
Risk escalation discovered:
Evidence:
```
