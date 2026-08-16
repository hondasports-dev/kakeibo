# 標準デリバリーフロー v8

## 目的

品質を維持しつつ、低リスク変更へ不要なmulti-agent reviewやfull verificationを課さない。

実行契約の正本は `AGENTS.md`、`.loop/process.yaml`、`skills/*/SKILL.md`。

## 1. Intake: Spec Confidence

実装前に `C0 / C1 / C2` を判定する。

- C2: 明確でmaterial conflictなし
- C1: 不足を正本からほぼ一意に復元可能
- C0: 不明またはConflict。実装禁止

Issueが曖昧ならdocs/tests/既存patternを調べる。成果物を変える選択が残るならHuman Gate。

Issueと既存実装が違っても、Issueが明示的なB→A変更ならexpected deltaでありConflictではない。

## 2. Risk Classification

4軸:

- Blast Radius
- Data / Security
- Reversibility
- Uncertainty

0..2点ずつで、0..2=R1、3..4=R2、5..8=R3。
R0/R4は明示condition。

Auth/authz、tenant/data boundary、schema/migration、delete/retention、billing、secret、external write等はR3 floor。
Production不可逆data操作、account deletion、secret rotation、DNS cutover等はR4。

## 3. Profile

### R0 TRIVIAL

```text
PREFLIGHT → MINIMAL PLAN → CHANGE → TARGETED CHECK → DELIVERY → AFTERCARE
```

独立Requirements / Code / Security Reviewは原則起動しない。

### R1 FAST

```text
PREFLIGHT
→ PLAN (Requirements + Impact summary)
→ IMPLEMENT
→ TARGETED VERIFY
→ REVIEW (Code + Security quick scan)
→ DELIVERY
→ PR_AFTERCARE
```

通常の局所変更はこれをデフォルトとする。

### R2 STANDARD

```text
PREFLIGHT
→ REQUIREMENTS
→ IMPACT
→ IMPLEMENT
→ VERIFY
→ CODE REVIEW + Security quick scan
→ DELIVERY
→ PR_AFTERCARE
```

Requirements independent reviewは0が既定。C1、material uncertainty、cross-cutting等の場合だけ1 review。

### R3 HIGH

```text
PREFLIGHT
→ REQUIREMENTS + independent review x2
→ IMPACT
→ IMPLEMENT
→ FULL VERIFY
→ CODE REVIEW
→ SECURITY REVIEW
→ DELIVERY
→ PR_AFTERCARE
→ PROCESS LEARNING
```

### R4 CRITICAL

R3に加えて:

- independent review x3
- post-synthesis review x1
- implementation前Human Gate
- production/irreversible operation直前Human Gate
- rollback/recovery Evidence

## 4. Implementation

writerは原則1体。Implementation Handoffには次を含める。

- Spec Confidence
- Risk Level / selected profile
- Acceptance Criteria
- editable scope
- relevant impact
- required verification

Issue本文だけをwriterへ渡して実装させない。

## 5. Verification

`skills/verification/SKILL.md` に従いprofile別に実行する。

- R0: targeted static check
- R1: changed tests +必要なlint/build/E2E
- R2: affected scopeのtests/coverage/E2E
- R3: full affected-scope verification
- R4: R3 + recovery evidence

全test/coverageをローカルとCIで毎回二重実行しない。

## 6. Review

- R0: separate review原則不要
- R1/R2: Code Review内でSecurity quick scan
- R3/R4: Code ReviewとSecurity Reviewを独立Gate化

quick scanでauth/data/secret/external/destructive triggerを発見したらRiskをR3+へ昇格する。

## 7. Delivery / PR Aftercare

PR作成はcheckpoint。

```text
DELIVERY
→ PR_AFTERCARE
   latest head
   required CI
   actionable findings
   requested changes
   approval
   conflict / mergeability
→ merge_ready
```

修正は同じPRへ積む。headが変わったらprofileで必要なVerification / ReviewとAftercareを最新headでやり直す。

## 8. Process Learning

R0-R2はevent-driven。

Eventなしなら:

```text
Events: none
Candidates: none
```

で終了。

R3/R4またはhuman correction、CI failure、review finding、retry、Incident、scope/impact/delivery missがあればfull analysis。

## 9. Task Transition

Aftercareと必要なLearningが終わったらtask identityを閉じる。次taskへ前taskのIssue/PR/CI contextを暗黙に持ち越さない。

## Failure routing

- Spec ambiguity / conflict → Requirements / Human Gate
- Impact拡大 → Risk再分類
- code/test defect → Implementation → profile-required Verification/Review
- security floor trigger → R3+へ昇格
- unknown/repeated failure → Incident
- human-only production/irreversible step → Human Gate

## 完了条件

- C1/C2
- Risk/Profile記録済み
- profile必須Gate PASS
- Delivery target到達
- PR Aftercare terminal
- Learning Event分類済み
- Task Transition完了
