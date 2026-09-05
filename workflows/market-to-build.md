# 市場調査から開発までのワークフロー v12

この文書は**非normativeな運用要約**。実行契約の正本は `AGENTS.md`、`.loop/process.yaml`、`skills/*/SKILL.md`。

## 目的

アプリ案が曖昧な状態では市場調査と壁打ちに集中し、ユーザーがGoを出した後だけ開発へ移る。Go後はv12のSpec Confidence + Risk + Required Controlsを使い、不要な確認・multi-agent review・full verificationを増やさない。

## フェーズ1: 市場調査 / Go-NoGo

市場調査では実装しない。

調査対象:

- 市場 / 競合
- ユーザー課題
- 支払い意欲 / 収益化
- 参入余地
- 実装難易度 / 集客しやすさ

出力:

- 候補一覧
- 推奨案 / 推奨理由
- 代替案
- 避ける案
- 未確認リスク

開発へ進む条件:

- ユーザーが「この案で進める」「Go」等で明示
- MVP範囲が概ね決定
- 作らない機能が明確

市場調査上の不確実性を、そのままimplementation Riskへ読み替えない。

## フェーズ2: PREPARE / Spec Confidence

Go後は `skills/requirements/SKILL.md` に従う。

- C2: 仕様・ACが明確
- C1: authoritative sourceからmaterial choiceなしに復元可能
- C0 unclear: 複数のmaterialな成果物がある
- C0 conflicted: desired stateについて有力sourceが矛盾

C0で即質問しない。まず許可済みのrepository/docs/tests調査を行い、cheapに解消できるassumptionを潰す。

authorized discovery後も成果物をmaterially変える選択肢が複数残る場合だけHuman Gateへ送る。

## フェーズ3: Risk / Required Controls

Riskは4軸で評価する。

1. Blast Radius
2. Data / Security
3. Reversibility
4. Uncertainty

目安:

- 0..2 → R1
- 3..4 → R2
- 5..8 → R3
- R0 / R4 → 明示condition

R4代表:

- production DB migration
- bulk / irreversible data mutation
- account deletion semantics
- authorization model overhaul
- financial settlement integrity
- production secret rotation
- production DNS / domain cutover

**R4 classificationだけではHuman Gateを起動しない。** R4はVerification / recovery / independent review要求を強める。

Human Gateは具体的なtriggerへ束縛する。

- unresolved material choice after discovery
- production / irreversible write
- production secret / credential rotation
- production DNS/domain cutover
- production money movement
- protected finding acceptance

## フェーズ4: Impact / Delegation

通常はRequirements packetのimpact summaryで十分。

別Impact Analysisを使うのは:

- cross-cutting
- shared callersがunbounded
- auth/data/schema/financial/external write impactが不明
- rollback/deploy impactが不明

subagentは並列化がwall-clock短縮または独立coverage改善にmaterially効く場合だけ使う。

- read-only discovery → 並列候補
- required independent review → 委譲候補
- path-disjoint analysis → 並列候補
- same shared diff → writer原則1体
- reviewer-to-reviewer debate → 禁止

Riskだけを理由にreviewer数を増やさない。independent reviewerは通常最大1体。

## フェーズ5: Implementation

Mainがcompact Handoffを固定し、原則1 writerへ渡す。

- Goal / scope
- AC / IV IDs
- relevant impact
- Risk / Required Controls
- Verification TC

R4でもreversibleな実装・test・reviewは止めない。production / irreversible operationが必要なら、具体的操作の直前までdiff / rollback / Evidenceを準備する。

## フェーズ6: Verification / Review

Verificationはfail-fast。

```text
scopeable static
→ targeted unit / contract
→ affected integration
→ required functional E2E
→ repo-wide regression = CI Aftercare
```

Profile:

- R0: targeted static
- R1: changed/directly affected tests
- R2: affected scope + shared caller regression
- R3: affected scopeのrelevant boundary/error/denial等
- R4: R3 + rollback/recovery Evidence + Required Controls

reversible / low-impact変更でimplementation detailを鏡写しするだけの新規testを作らない。

required checksがPASSした後は、新しい変更・failure・unresolved concernが無い限りcheckを広げたり繰り返したりしない。

Review:

- R0: 原則なし
- R1: Control要求時のみ
- R2/R3/R4: 最大1 independent reviewer
- specialist: materially distinctなRequired Controlがある時だけ

R4だけを理由にHuman Gateや追加reviewerを入れない。

## フェーズ7: Mid-turn steering / 修正ループ

作業中に新しいユーザー指示が来た場合:

1. 新指示を最優先sourceとして反映
2. affected Goal / scope / AC / IV / TC / Risk / Controlsだけ更新
3. unaffected work / Evidenceは保持
4. bounded deltaだけImplementation / Verification / Reviewへ戻す
5. material choiceが発生した時だけPREPARE / Human Gateへ戻す

Failure routing:

- spec漏れ / conflict → PREPARE
- impact拡大 → Risk / Controls再分類
- code/test defect → Implementation → required Verification/Review
- unknown / repeated failure → Incident
- production / irreversible operation → concrete resultを作った後Human Gate

## フェーズ8: Delivery / PR Aftercare

PR作成はcheckpoint。

```text
DELIVERY
  ↓
PR_AFTERCARE
  latest head/tree
  ├ required CI
  ├ actionable review findings
  ├ requested changes
  ├ required approval
  └ conflict / mergeability
  ↓
merge_ready
```

同一taskの修正は同じbranch / PRへ積む。

ユーザーが明示的に「PR作成まで」と指定した場合だけAftercareを省略できる。

branch作成、reversible repository edit、test/review、依頼済みPR作成・更新には追加確認を要求しない。

## フェーズ9: Process Learning / Task Transition

Process Learningはevent-driven。

Learning Event例:

- human correction
- unexpected Gate / CI / E2E failure
- actionable review finding
- retry / Incident
- scope / impact / delivery miss

Risk R3/R4だけでは起動しない。

Task TransitionはDONE条件ではない。同じsessionで次taskへcontextをcarryする時だけ使う。

## Coordinator rules

- 市場調査の不確実性と実装仕様の不確実性を分ける
- C0で実装へ進まない
- 質問前にauthorized discoveryを行う
- Riskは変更量ではなく影響で決める
- R4だけでHuman Gateを起動しない
- 必要なAgentだけを使う
- same shared diffはone writer
- low-impact変更へ過剰testを要求しない
- mid-turn変更ではaffected deltaだけ再処理する
- PR作成でsessionを終了せずrequired Aftercareまで同じtaskを保持する
