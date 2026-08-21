# 標準デリバリーフロー v9

## 目的

品質を維持しつつ、低リスク変更へ不要なmulti-agent reviewやfull verificationを課さない。

実行契約の正本は `AGENTS.md`、`.loop/process.yaml`、`skills/*/SKILL.md`。この文書は運用の要約であり、正本と矛盾する場合は正本を優先する。

## 1. PREPARE

最初にSpec Confidenceを `C0 / C1 / C2` で判定する。

- C2: 目的・期待結果・Acceptance Criteriaが明確でmaterial conflictなし
- C1: 不足をauthoritative sourceからほぼ一意に復元可能
- C0: 不明またはConflict。実装禁止

C0はRequirements Discovery / Source Reconciliationを行い、解消できないmaterial choiceはHuman Gateへ送る。

repository変更では、最初の編集前にWorkspace Preflightを実行する。

```bash
node scripts/check-task-worktree.mjs --require-clean
```

PREPAREは最低限次を確定する。

- Goal / In scope / Out of scope
- Acceptance Criteria
- Spec Confidence
- Risk
- Required Controls
- Verification plan

## 2. Risk + Required Controls

Riskは4軸で評価する。

- Blast Radius
- Data / Security
- Reversibility
- Uncertainty

目安は `0..2=R1`、`3..4=R2`、`5..8=R3`。R0/R4は明示条件。

ただし、**Riskの高さと必要な専門Controlを分離する**。

代表Control:

- Security Review: auth/authz、tenant/group/user data boundary、secret、user-controlled URL/HTML、webhook/external write
- Data Model: Convex schema/data contract、shared membership/auth helper、migration/data shape
- Financial Integrity: billing/payment/settlement
- Destructive/Stateful: deletion/retention、rollback、idempotency/state transition
- Service Ops: Clerk/Convex/Vercel/GitHub/OAuth/webhook/env/deploy/DNS等のwrite
- Human Gate: R4、production/irreversible write、protected finding acceptance

Risk R3/R4という理由だけでRequirements reviewerやSecurity reviewerの人数を増やさない。

## 3. Default path

```text
PREPARE
→ IMPLEMENT
→ VERIFY
→ REVIEW?          # Risk / Controlが要求する時だけ
→ DELIVER
→ PR_AFTERCARE
→ DONE
```

Human Gate、Incident、Process Learning、Impact Analysis、Security specialist、Finding Dispositionはconditional side path / helper。

## 4. Implementation

writerは原則1体。

Implementationへ渡すpacketは必要十分にする。

- Goal
- Acceptance Criteria
- editable scope
- relevant impact
- Risk / Required Controls
- Verification plan

Issue本文や前工程の長い議論をそのまま再転記しない。

実装中にmaterial spec ambiguity、新しいshared/auth/data/financial/external impact、production/irreversible triggerを発見したらPREPAREへ戻る。

Implementation開始後はtask中のmax observed Riskをcompletion floorとする。

## 5. Verification

品質は「Gate数」ではなくAcceptance CriteriaとRequired ControlsのEvidenceで証明する。

- R0: targeted static / behavior-preserving check
- R1: changed/directly affected tests + scopeable static checks +必要なfunctional E2E
- R2: affected scope + shared caller regression
- R3: affected scopeのnormal/boundary/error/auth denial/partial failure等
- R4: R3 + recovery evidence

repo-wide full checks / regression E2Eはlatest contentのCI Aftercareを正本にできる。同じfull suiteをlocal/CIで理由なく重複しない。

test gapは共通 `findings[]` にstable IDで記録し、解消するまでVerification PASS不可。

## 6. REVIEW

independent Reviewは次の場合だけ起動する。

- profileが要求
- Required Controlが要求
- implementation/verificationでmaterial new riskを発見

既定は最大1 reviewer。reviewer同士を討論させず、rootが1回だけ統合する。

Security specialistはSecurity Review Controlが起動した時だけ同じREVIEW stageへ追加する。

findingはすべて共通 `findings[]` にstable IDで記録する。

## 7. Revision binding

Verification / Review / Delivery / AftercareのEvidenceはrevisionへ束縛する。

- commit SHA: revision観測に必須
- tree SHA: previous Evidenceをsame contentとして再利用する時に必須

previous/current双方の非空tree SHAが一致する場合だけsame contentとしてEvidenceを再利用できる。

tree identityを証明できない、またはcontentが変わった場合はdelta Verification / Reviewを行い、protected behavior / AC / Risk / Controlsが変わるかdeltaをboundできない場合はaffected-scope full rerunへ戻る。

## 8. Delivery / PR Aftercare

PR作成はcheckpoint。

Delivery前に:

- C1/C2
- Workspace Preflight PASS / documented exception
- Acceptance Criteria PASS
- corresponding Verification Evidence
- required Controls / Review
- blocking findingなし
- required Human Gate approval

を確認する。

```text
DELIVERY
→ PR_AFTERCARE
   latest commit/tree
   required CI
   actionable findings
   requested changes
   required approval
   conflict / mergeability
→ merge_ready
```

merge-ready PASS直前に、PR current headとobserved revision、checks/review/approval/conflict/mergeabilityが同じrevisionに束縛されていることを確認する。

required approvalがある場合はapproval PASSまで完了扱いにしない。pending / queued / in_progressはPASSではない。

## 9. Finding Ledger

review / verification / CI / human findingは `task-state.findings[]` だけを正本にする。

各findingはstable IDを持ち、cycleごとに同じentryを更新する。

最低限:

- id
- source
- observed revision
- status / disposition
- evidence

を保持する。

`resolved` はresolution、verified revision、Verification Evidenceが揃ってPASSした場合だけ。

protected findingを `accept_with_human_gate` にする場合はapprover / approved_at / scope / evidenceを含む完全なapproval recordが必要。test gapはHuman Gateで迂回できない。

## 10. Process Learning

Process Learningは**完全event-driven**。

定義済みLearning Eventが1つ以上ある場合だけ起動する。

例:

- human correction
- unexpected Gate / CI / E2E failure
- actionable review finding
- repeated retry / Incident
- scope / impact miss
- delivery / aftercare miss
- process enforcement不足の発見

Risk R3/R4という理由だけでは起動しない。

Eventなしなら:

```text
Learning event: none
Status: NOT_REQUIRED
```

で終了する。

DONE条件ではLearning Eventの判定だけを必須とし、full Process Learning自体は必須にしない。

## 11. Task Transition

Task Transitionは通常のDONE条件ではない。

次の場合だけ軽量helperとして使う。

- 同じsessionで次taskへ進む
- 前taskの一部contextだけをcarryする
- branch / PR / Issue identityを切り替える

単発task終了のためだけに独立reasoning phaseを追加しない。

## Failure routing

- Spec ambiguity / conflict → PREPARE / Human Gate
- Impact拡大 → PREPAREでRisk / Controls更新
- code/test defect → Implementation → required Verification/Review
- unknown/repeated failure → Incident
- human-only production/irreversible step → Human Gate

## 完了条件

- Spec Confidence C1/C2
- Risk / Required Controls記録済み
- Acceptance Criteria verified
- required Review完了
- blocking findingなし
- Delivery target到達
- PR Aftercare terminal
- Learning Event判定済み（`none` 可）

Task Transitionは通常のDONE条件に含めない。
