# 標準デリバリーフロー v12

この文書は**非normativeな運用要約**。実行契約の正本は `AGENTS.md`、`.loop/process.yaml`、`skills/*/SKILL.md`。矛盾する場合は正本を優先する。

## 目的

品質を維持しつつ、低リスク変更へ不要なmulti-agent reviewやfull verificationを課さない。GPT-6 Astraを含む強いinstruction-following modelが、Skillを過剰解釈して不要な確認・test・reviewで停止しないようにする。

v12の追加原則:

- current explicit user instruction > general Skill guidance（non-bypassable safetyを除く）
- authorized read-only / reversible workは確認前に完了する
- R4 classificationだけではHuman Gateを起動しない
- low-impact changeでimplementation detailを鏡写しするtestを増やさない
- subagentは速度または独立coverageへmaterialに効く時だけ使う
- mid-turn instructionはaffected contractだけ更新し、unaffected work/Evidenceを維持する

## 1. PREPARE

最初にSpec Confidenceを `C0 / C1 / C2` で判定する。

- C2: 目的・期待結果・Acceptance Criteriaが明確でmaterial conflictなし
- C1: 不足をauthoritative sourceからmaterial choiceなしに復元可能
- C0: 不明またはConflict。実装禁止

C0でも即質問せず、まず許可済みのRequirements Discovery / Source Reconciliationを行う。authorized discovery後も成果物をmaterially変えるchoiceが複数残る場合だけHuman Gateへ送る。

repository変更では、最初の編集前にWorkspace Preflightを実行する。

```bash
node scripts/check-task-worktree.mjs --require-clean
```

PREPAREは最低限次を確定する。

- Goal / In scope / Out of scope
- AC / relevant IV
- material assumptions
- relevant dimensions
- Spec Confidence
- Risk
- Required Controls
- Coverage Map / Verification plan / TC

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
- Human Gate: unresolved material choice、production/irreversible write、production secret/DNS/money movement、protected finding acceptance

Risk R3/R4という理由だけでRequirements reviewerやSecurity reviewerの人数を増やさない。

**R4 classificationだけではHuman Gateを起動しない。** R4はaffected scope、rollback/recovery Evidence、independent review、Required Controlsを強める。

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
- AC / relevant IV
- editable scope
- relevant impact
- Risk / Required Controls
- Verification TC / plan

Issue本文や前工程の長い議論をそのまま再転記しない。

実装中にmaterial spec ambiguity、新しいshared/auth/data/financial/external impact、production/irreversible triggerを発見したらPREPAREへ戻る。

Implementation開始後はtask中のmax observed Riskをcompletion floorとする。

R4でもreversibleな実装・test・reviewは進める。production / irreversible operationが必要なら、具体的操作の直前までdiff / rollback / Evidenceを準備する。

### Mid-turn steering

作業中に新しいユーザー指示が来た場合:

1. 新指示を最優先sourceとして取り込む
2. affected Goal / scope / AC / IV / TC / Risk / Controlsだけ更新する
3. unaffected work / Evidenceは保持する
4. bounded deltaだけImplementation / Verification / Reviewへ戻す
5. material choiceが新たに発生した時だけPREPARE / Human Gateへ戻す

loop全体を無条件にrestartしない。

## 5. Verification

品質は「Gate数」ではなくAcceptance Criteria / relevant IVとRequired ControlsのEvidenceで証明する。

- R0: targeted static / behavior-preserving check
- R1: changed/directly affected tests + scopeable static checks +必要なfunctional E2E
- R2: affected scope + shared caller regression
- R3: affected scopeのnormal/boundary/error/auth denial/partial failure等
- R4: R3 + recovery Evidence + Required Controls

repo-wide full checks / regression E2Eはlatest contentのCI Aftercareを正本にできる。同じfull suiteをlocal/CIで理由なく重複しない。

### Test calibration

reversible / low-impact変更でimplementation detailを鏡写しするだけの新規testを作らない。

新規testはobservable AC/IV、required boundary、Required Control、実在するregression riskをmaterialに証明する場合だけ追加する。

required checksがPASSした後は、content change / material failure / unresolved concern / Required Controlが無い限りcheckを広げたり繰り返したりしない。

test gapは共通 `findings[]` にstable IDで記録し、解消するまでVerification PASS不可。

## 6. REVIEW / Delegation

independent Reviewは次の場合だけ起動する。

- profileが要求
- Required Controlが要求
- implementation/verificationでmaterial new riskを発見

既定は最大1 reviewer。reviewer同士を討論させず、rootが1回だけ統合する。

- R0: 原則なし
- R1: Control要求時のみ
- R2: 1 reviewer
- R3: 1 risk-aware reviewer
- R4: 1 risk-aware reviewer

R4だけを理由にspecialistやreviewerを追加しない。materially distinctなControlが必要な場合だけspecialistを追加する。

Security specialistはSecurity Review Controlが起動した時だけ同じREVIEW stageへ追加する。

subagentはread-only discovery、required independent review、path-disjoint analysisで並列化効果がmaterialな時だけ使う。same shared diffはone writerとする。

findingはすべて共通 `findings[]` にstable IDで記録する。

## 7. Revision binding

Verification / Review / Delivery / AftercareのEvidenceはrevisionへ束縛する。

- commit SHA: revision観測に必須
- tree SHA: previous Evidenceをsame contentとして再利用する時に必須

previous/current双方の非空tree SHAが一致する場合だけsame contentとしてEvidenceを再利用できる。

tree identityを証明できない、またはcontentが変わった場合はdelta Verification / Reviewを行い、protected behavior / AC / Risk / Controlsが変わるかdeltaをboundできない場合はaffected-scope full rerunへ戻る。

mid-turn instructionでも同じ原則を使い、affected contractだけ更新してunaffected Evidenceを維持する。

## 8. Human Gate

Human Gateの前に既に許可されたread-only / reversible workを完了し、具体的な結果をレビュー可能にする。

代表trigger:

- authorized discovery後もmaterial choiceが複数残る
- production deploy / production data mutation
- irreversible / bulk mutation
- production env / secret / key rotation
- DNS/domain cutover
- production money movement
- protected finding acceptance

branch作成、reversible edit、test/review、依頼済みPR作成・更新には追加確認を要求しない。

## 9. Delivery / PR Aftercare

PR作成はcheckpoint。

Delivery前に:

- C1/C2
- Workspace Preflight PASS / documented exception
- Acceptance Criteria PASS
- corresponding Verification Evidence
- required Controls / Review
- blocking findingなし
- concrete Human Gateがtriggerされた場合だけ必要approval

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

## 10. Finding Ledger

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

## 11. Process Learning

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

## 12. Task Transition

Task Transitionは通常のDONE条件ではない。

次の場合だけ軽量helperとして使う。

- 同じsessionで次taskへ進む
- 前taskの一部contextだけをcarryする
- branch / PR / Issue identityを切り替える

単発task終了のためだけに独立reasoning phaseを追加しない。

## Failure routing

- Spec ambiguity / conflict → PREPARE / Human Gate after authorized discovery
- Impact拡大 → PREPAREでRisk / Controls更新
- code/test defect → Implementation → required Verification/Review
- unknown/repeated failure → Incident
- production/irreversible operation → concrete resultを作った後Human Gate

## 完了条件

- Spec Confidence C1/C2
- Risk / Required Controls記録済み
- Acceptance Criteria / relevant IV verified
- required Review完了
- blocking findingなし
- concrete Human Gateがtriggerされた場合だけ必要approval済み
- Delivery target到達
- PR Aftercare terminal
- Learning Event判定済み（`none` 可）

Task Transitionは通常のDONE条件に含めない。
