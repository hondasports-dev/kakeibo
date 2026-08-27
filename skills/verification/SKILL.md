---
name: verification
description: AC/IV/TCのCoverage Map、max observed Risk、Required Controlsに対応する最小十分な検証をfail-fast順で行い、requirements gapとtest gapを分離する。
license: Apache-2.0
---

# Verification

## 原則

「全部実行した」ではなく、**AC / relevant IVとrequired boundaryを証明した**ことをPASS条件にする。

PREPAREのCoverage Mapを使い、ここで仕様やtest caseをゼロから再導出しない。

テストを追加したことと、実行してPASSしたことは別。

## Context discipline

通常読むのは:

- AC / IV / TC IDと短いcontract
- behavior change map / changed files
- Risk / Controls
- Coverage Map
- current revision
- open findings

Issue全文・chat履歴・Requirements Skill全文を再読するのは、contract conflictやrequirements gapが見つかった時だけ。

## Fail-fast execution order

高価なcheckへ進む前に安いcheckで手戻りを止める。

1. scopeable static / owning `tsconfig`
2. targeted unit / contract test
3. affected integration / Convex test
4. required functional E2E
5. repo-wide regressionは原則CI Aftercare

上流の失敗で下流結果が無意味になる場合、高価なcheckを先に走らせない。

失敗後は原因を分類し、修正deltaで無効化されたcheckだけ再実行する。

## Profile

### R0

- diff / format / targeted static check
- behavior不変ならruntime test NOT_REQUIRED理由

### R1

- changed / directly affected tests
- scopeable lint / type / build
- browser ACがあればfunctional E2E

### R2

- affected unit/component/Convex/integration tests
- shared caller regression
- browser ACのfunctional E2E

### R3

R2に加え、affected scopeのrelevant dimension:

- normal / boundary / error
- auth denial / group isolation
- partial failure
- data / state transition compatibility
- concurrency / idempotency when relevant

### R4

R3 + rollback / recovery evidence + Human Gate precondition。

## Coverage checks

### Forward coverage

すべてのAC / relevant IVについて:

- 対応TCまたは明示NOT_REQUIRED理由がある
- TCが実際に実行され、期待するobservable contractを確認している
- AC/IVが複数layerをまたぐなら、必要なboundaryまでEvidenceが届いている

単に関数が呼ばれた、mockが返った、実装内部のfieldが変わっただけでは、外部contractの証明にならない場合がある。

### Reverse coverage

Implementationのbehavior change mapを確認する。

- behavior-changing diff → AC / IV / design deviation の対応あり
- 対応なし → `requirements_gap`。Verificationで勝手に仕様を補完せずPREPAREへ戻す

### Requirements gap と Test gap

区別する。

- **requirements gap**: 必要behaviorがあるのにAC/IVへ定義されていない、またはdiffのbehaviorがcontract外
  - PREPAREへ戻す
  - 必要ならFinding Ledgerへ `category: requirements_gap`
- **test gap**: AC/IVは明確やが、それを証明するtest/evidenceが無い
  - `category: test_gap`
  - fixまたはRequirements正式変更までPASS不可

「testが無いから仕様も無かったことにする」は禁止。

## Required Controls

### Security

auth / authorization / group boundary変更なら、許可経路だけでなくdenial / cross-user・cross-groupを検証する。

### Data model

Convex schema / shared membership helper変更なら、affected query / mutation / callerを検証する。

`getGroupMembership`、`resolveActiveGroupForUserId`、`getResolvedMemberships`等のshared helper変更はfeatureのtargeted testだけで終えない。

### Financial integrity

billing/payment/settlement変更は境界値、二重実行、失敗経路、整合性を検証する。

### Destructive/stateful

delete/retention/state transition/idempotency変更はfailure pathとrecoveryを確認する。

## Relevant dimensionからの漏れ確認

PREPAREで`relevant`になった観点だけ確認する。

- happy path
- boundary
- error / failure
- empty / loading
- auth / ownership
- persistence / state transition
- caller compatibility
- concurrency / idempotency
- navigation / accessibility

全部のtaskへ全部のtestを要求しない。`not_applicable`の観点をVerificationで再議論しない unless 新Evidenceが出た場合。

## Suzumemo E2E environment

browser ACがある場合は既存手順を使う。

```bash
pnpm run e2e:env-sync
```

Convex反映が必要なら:

```bash
pnpm exec convex dev --once
```

secret / `.env.local` の値は、次のどこにも表示・送信・保存・commitしない。

- shell command / test commandの引数・標準出力
- local / CI log
- CI artifact / trace / screenshot / HAR
- PR / Issue / chat
- 外部サービスへの不要なrequest
- tracked file / commit

secretを含む可能性がある出力はmaskして扱う。必要な検証を安全にmaskできない場合はskipせずBLOCKEDとし、別の検証方法または環境復旧を選ぶ。

required environment unavailable / env sync failure / Convex reflection failureはskip理由ではない。復旧またはBLOCKED / Incident。

## CIとの分担

同一contentのrepo-wide full checks / regression E2EはCI Aftercareを正本にできる。

localで同じfull suiteを重ねる場合は理由を記録する。

盲目的retryをしない。失敗原因を分類し、修正deltaに依存するcheckだけを再実行する。

## Finding Ledger

新しいgapにはstable IDを払い出し、最低限:

- `id`
- `source: verification`
- `observed_revision`（commit SHA + tree SHA）
- `category: requirements_gap | test_gap`
- `status: open`
- `disposition: open` または `fix_now`
- affected AC / IV
- `evidence`

を保持する。

同じgapが残る場合はduplicate recordを作らず、同じstable IDのentryへ最新revision / evidenceを追記する。

別のmaterial_test_gap表やresidual recordへ転記しない。

requirements gapはPREPAREへ戻す。test gapは解決までVerification PASS不可。Human Gateで迂回しない。

## Revision change

previous evidenceをsame contentとして再利用するには、previous/current双方の非空tree SHA一致を必須とする。

- matching tree SHA → previous evidence reuse可
- tree identity不明 → content changedとしてdelta/full再検証
- content changed → delta verification
- protected behavior / AC coverage / Risk / Controls changed、またはdeltaをboundできない → affected scopeをfull rerun

## PASS条件

- forward coverage成立
- reverse coverage成立
- relevant dimensionのTC/Evidenceが揃う
- Required Controlsのboundaryが証明済み
- blocking requirements gap / test gapなし
- required checks PASS

## 出力

AC本文やsource本文は再掲せずID中心にする。

```text
VERIFICATION
Status: PASS | FAIL | BLOCKED
Revision commit / tree:
Affected scope:
AC / IV results:
TC results:
Forward / reverse coverage:
Checks:
Skipped + reason:
Reruns + reason:
Finding IDs added/updated:
Evidence:
```
