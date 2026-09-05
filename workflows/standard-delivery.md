# 標準デリバリーフロー v12

この文書は**非normativeな運用要約**。実行契約の正本は `AGENTS.md`、`.loop/process.yaml`、`skills/*/SKILL.md`。矛盾する場合は正本を優先する。

## 目的

品質を維持しつつ、GPT-6 Astraを含む強いinstruction-following modelが不要な確認・過剰test・過剰reviewで停止しないようにする。

v12の追加原則:

- current explicit user instruction > general Skill guidance
- authorized read-only / reversible workは確認前に完了する
- R4 classificationだけではHuman Gateを起動しない
- low-impact changeでimplementation detailを鏡写しするtestを増やさない
- subagentは並列化が速度または独立coverageへmaterialに効く時だけ使う
- mid-turn instructionはaffected contractだけ更新し、unaffected work/Evidenceを維持する

## 1. PREPARE

最初にSpec Confidenceを `C0 / C1 / C2` で判定する。

- C2: 目的・期待結果・Acceptance Criteriaが明確でmaterial conflictなし
- C1: 不足をauthoritative sourceからmaterial choiceなしに復元可能
- C0: 不明またはconflict。実装禁止

C0でも即質問せず、まず許可済みのrepository/docs/tests調査を行う。authorized discovery後も成果物をmaterially変える選択肢が複数残る場合だけHuman Gateへ送る。

repository変更では、最初の編集前にWorkspace Preflightを実行する。

```bash
node scripts/check-task-worktree.mjs --require-clean
```

PREPAREは最低限:

- Goal / In scope / Out of scope
- AC / relevant IV
- material assumptions
- relevant dimensions
- Spec Confidence
- Risk / Required Controls
- Coverage Map / TC

を確定する。

## 2. Risk + Required Controls

RiskはBlast Radius / Data-Security / Reversibility / Uncertaintyで評価する。

目安は `0..2=R1`、`3..4=R2`、`5..8=R3`。R0/R4は明示条件。

Riskと専門Controlを分離する。

代表Control:

- Security Review: auth/authz、tenant/group/user boundary、secret、external write
- Data Model: Convex schema/data contract、shared membership/auth helper、migration/data shape
- Financial Integrity: billing/payment/settlement
- Destructive/Stateful: deletion/retention、rollback、idempotency/state transition
- Service Ops: Clerk/Convex/Vercel/GitHub/OAuth/webhook/env/deploy/DNS等
- Human Gate: unresolved material choice、production/irreversible write、production secret/DNS/money movement、protected finding acceptance

**R4自体はHuman Gate triggerではない。** R4はaffected scope、recovery Evidence、independent review等を強める。

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

Implementationへ渡すpacket:

- Goal / scope
- AC / IV IDs
- relevant impact
- Risk / Required Controls
- TC / Verification plan

Issue全文や前工程の長い議論を再転記しない。

R4でもreversibleな実装・test・reviewを進める。production / irreversible operationが必要なら、その操作直前までconcreteなdiff・rollback・Evidenceを準備する。

作業中に新しいユーザー指示が来た場合、影響するcontractだけ更新し、unaffected diff/Evidenceを保持する。

## 5. Verification

品質は「Gate数」ではなくAC / IV / Required ControlsのEvidenceで証明する。

```text
scopeable static
→ targeted unit / contract
→ affected integration
→ required functional E2E
→ repo-wide regression = CI Aftercare
```

- R0: targeted static / behavior-preserving check
- R1: changed/directly affected tests + scopeable static +必要なfunctional E2E
- R2: affected scope + shared caller regression
- R3: affected scopeのrelevant boundary/error/denial/partial failure
- R4: R3 + recovery Evidence + Required Controls

reversible / low-impact変更でimplementation detailを鏡写しするだけの新規testを作らない。

required checksがPASSした後は、content change / failure / unresolved concern / Required Controlが無い限り、範囲を広げたり繰り返したりしない。

repo-wide full checks / regression E2Eはlatest contentのCI Aftercareを正本にできる。同じfull suiteをlocal/CIで理由なく重複しない。

## 6. REVIEW / Delegation

independent ReviewはprofileまたはRequired Controlが要求する時だけ起動する。

- R0: 原則なし
- R1: Control要求時のみ
- R2: 最大1 reviewer
- R3: 最大1 risk-aware reviewer
- R4: 最大1 risk-aware reviewer

R4だけを理由にspecialistやreviewerを追加しない。materially distinctなControlが必要な場合だけspecialistを追加する。

subagentはread-only discovery、required independent review、path-disjoint analysisで並列化効果がmaterialな時だけ使う。reviewer同士を討論させずrootが1回統合する。

findingはすべて共通 `findings[]` にstable IDで記録する。

## 7. Revision / Mid-turn binding

Verification / Review / Delivery / AftercareのEvidenceはrevisionへ束縛する。

- commit SHA: revision観測に必須
- tree SHA: previous Evidenceをsame contentとして再利用する時に必須

previous/current双方の非空tree SHAが一致する場合だけsame contentとしてEvidenceを再利用できる。

content changeまたは新しいユーザー指示が入った場合:

- affected AC / IV / TC / Risk / Controlsだけ更新
- bounded delta → delta Verification / Review
- protected behavior / AC / Risk / Controlsが変わる、またはdelta unbounded → affected-scope full rerun
- unaffected contract / Evidenceは維持

## 8. Human Gate

Human Gateの前に既に許可された作業を完了し、ユーザーが**具体的な結果**を承認できる状態にする。

Human Gate例:

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
- forward / reverse coverage
- Acceptance Criteria PASS
- Required Controls / Review
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

required approvalがある場合はapproval PASSまで完了扱いにしない。pending / queued / in_progressはPASSではない。

## 10. Finding Ledger / Process Learning

review / verification / CI / human findingは `task-state.findings[]` だけを正本にする。

requirements gapはPREPAREへ戻す。test gapは解消までVerification PASS不可。test gapはHuman Gateで迂回できない。

Process Learningはevent-driven。Risk R3/R4だけでは起動しない。

例:

- human correction
- unexpected Gate / CI / E2E failure
- actionable review finding
- repeated retry / Incident
- scope / impact miss
- delivery / aftercare miss

## 11. Task Transition / DONE

Task Transitionは通常のDONE条件ではない。同じsessionで次taskへcontextを再束縛する必要がある時だけ使う。

DONE最低条件:

- Spec Confidence C1/C2
- Risk / Required Controls記録済み
- AC / IV verified
- required Review完了
- blocking findingなし
- triggered Human Gateがあれば必要approval済み
- Delivery target到達
- PR Aftercare terminal
- Learning Event判定済み（`none`可）
