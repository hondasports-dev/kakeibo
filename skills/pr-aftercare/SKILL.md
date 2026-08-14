---
name: pr-aftercare
description: PR公開後、最新headのCI・review・requested changes・conflict・approvalを追跡し、選択Risk Profileに必要な修正ループを回してmerge-readyまで収束させる。
license: Apache-2.0
---

# PR Aftercare

## 目的

PR作成で止まらず、**最新headが実際にmerge-readyになるまで**追跡する。

Risk-basedにしてもAftercareは軽量化の対象外。ここは主にGitHub state / Evidence確認であり、multi-agent reviewを増やす工程ではない。

## Session boundary

Aftercareがterminalになるまでcurrent taskを保持する。

- 別taskのDelivery PRを作らない
- 同一taskの修正は同じbranch / PRへ積む
- 並行taskはユーザー明示許可時だけ

## Observation epoch

cycleごとに:

```text
PR
Base
Head branch
Observed head SHA
Risk / profile
Delivery target
```

を固定する。

head SHAが変わったら旧headのsuccessを流用しない。

## 監視対象

- required CI / checks
- actionable human / bot review findings
- requested changes
- unresolved blocking threads
- required approval
- conflict / mergeability
- Draft状態

pending / queued / in_progressはPASSではない。

## Finding / CI failure時

### Code / test fix

```text
PR_AFTERCARE
→ IMPLEMENTATION
→ profile-required VERIFICATION
→ profile-required CODE_REVIEW
→ profile-required SECURITY_REVIEW
→ DELIVERY (same PR)
→ PR_AFTERCARE (new head)
```

`profile-required` が重要。R1/R2の修正で理由なくfull Security Reviewへ拡大しない。

### Risk escalation

reviewやCIで新しいauth/data/shared/external impactが見つかった場合:

```text
PR_AFTERCARE
→ REQUIREMENTS / IMPACT
→ Risk/Profile更新
→ new-profile required gates
→ DELIVERY
→ PR_AFTERCARE
```

### Specification conflict

Requirementsへ戻す。C0になったら解消までImplementation禁止。

### Unknown / repeated failure

Incident。

### Human-only blocker

BLOCKED。DONEにしない。

## Finding closure

各findingを:

- fixed
- rejected with reason
- outdated
- resolved
- blocking

のいずれかにする。

コード変更したclosureは最新headでprofile-required Verification/Review Evidenceが必要。

## Merge-ready

PASS条件:

- current taskの唯一のDelivery PR
- non-draft（明示Draft運用を除く）
- latest headのrequired checks success
- actionable blocking findingsなし
- requested changesなし
- required approval satisfied
- conflictなし
- mergeable
- verified headがcurrent

## merged_cleaned

ユーザーがmergeまで明示した場合だけ:

- merge直前にmerge-ready再確認
- merge result / base反映確認
- Issue state確認
- task branch/worktree cleanup

mergeとcleanupを一体操作にしない。canonical preview worktreeや正本`.env.local`を削除しない。

## 明示的PR作成だけ

「PR作成までで止めて」「CI待ちは不要」等の明示時だけ `NOT_REQUIRED` 可。

単なる「PR投げて」は `merge_ready`。

## 出力

```text
PR_AFTERCARE
Status: PASS | FAIL | BLOCKED | NOT_REQUIRED
Risk / profile:
Target:
PR:
Observed head SHA:
Checks:
Review findings:
Requested changes:
Approval:
Conflict:
Mergeable:
Risk escalation:
Blocking items:
Evidence:
```
