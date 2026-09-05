# Loop Engineering Foundation v12

Suzumemo Agent Loop v12 は、v11の **Context削減 / fail-fast / forward-reverse coverage / event-driven learning** を維持しつつ、GPT-6 Astraのinstruction-following特性へ合わせて「不要に止まらない」「不要に広げない」ことを強化する。

v12の主な変更:

1. **Instruction priority明確化** — current explicit user instructionをgeneral Skill guidanceより優先する
2. **Autonomy強化** — 質問や承認の前に、許可済みのread-only / reversible作業を完了する
3. **Human Gate具体化** — R4分類ではなく、production / irreversible operation等の具体的triggerへ束縛する
4. **Test calibration** — low-impact変更でimplementation detailを鏡写しするtestや重複checkを増やさない
5. **Delegation calibration** — subagentは並列化が速度または独立coverageへmaterialに効く場合だけ使う
6. **Mid-turn steering** — 新しいユーザー指示ではaffected contractだけ更新し、unaffected work/Evidenceを維持する
7. **Instruction surface整理** — workflow/docsは非normativeとし、正本を絞る

正本:

- `AGENTS.md` — 常時保持する短い実行原則
- `.loop/process.yaml` — machine-readable contract
- `.loop/templates/task-state.yaml` — reusable task-state schema/template
- `.loop/state/<task-id>.yaml` — current task instance / Coverage Map / Finding / telemetry（worktree-local・ignored）
- `skills/*/SKILL.md` — current state / triggered helperの詳細

非normativeな運用説明:

- `workflows/*`
- `docs/development-process.md`

矛盾する場合は正本を優先する。

## Design principle

```text
Quality = confirmed contract
        + forward coverage
        + reverse coverage
        + Required Controls
        + Verification Evidence
        + blocking finding = 0
```

Gate数・Agent数・文書量・test実行回数は品質指標にしない。

Default path:

```text
PREPARE → IMPLEMENT → VERIFY → REVIEW? → DELIVER → AFTERCARE → DONE
```

Human Gate / Incident / Process Learning はside path。

---

## 1. Instruction priority

実行判断:

```text
platform / non-bypassable safety
  ↓
current explicit user instruction
  ↓
latest approved task / spec / decision
  ↓
AGENTS.md / process.yaml
  ↓
current or triggered SKILL.md
  ↓
workflow / explanatory docs
```

Skillは、既にユーザーが許可したreversible / read-only / review / fix / PR作業を独自に狭めるものとして扱わない。

Skillがpermission確認・停止・未完了を要求する場合、どのSkillのどの指示が原因かを示し、明示要件とAgent解釈を分ける。

---

## 2. Autonomy / approval boundary

質問前にできることを先にする。

- repository / docs / testsのread-only discovery
- reversible repository edit
- branch作成
- test / review / fix
- 依頼または強く含意されたPR作成・更新
- rollback / recovery案の準備

Human Gateは**具体的な結果をレビュー可能にした後**へ寄せる。

代表trigger:

- authorized discovery後もmaterial choiceが複数残る
- production write
- irreversible / bulk state mutation
- production secret / credential rotation
- production DNS/domain cutover
- production money movement
- protected finding acceptance

### R4との分離

R4は高いRisk分類。

R4では:

- affected scopeを広く検証
- rollback / recovery Evidence
- independent risk-aware review
- Required Controls

を要求できる。

ただし**R4というlabelだけではHuman Gateを起動しない**。例えばauthorization model overhaulでも、code・tests・review・PRまでのreversible workは進められる。production/irreversible operationがある場合だけ、その具体的操作の直前で止める。

---

## 3. Compact contract / context

PREPARE後に各stageへ渡す情報を絞る。

- Goal / scope
- `ACxx`
- `IVxx`
- material assumptions
- relevant dimensions
- Risk / Required Controls
- Coverage Map / `TCxx`
- open Finding IDs
- current revision

Issue全文・chat履歴・source本文を各stageで再要約しない。authoritative sourceは参照だけ残す。

sourceを再読するのはcontract conflict、requirements gap、unbounded impact等の具体的理由が出た時だけ。

Conditional Skillも使用後にactive contextから外してよい。Safety invariantは常時保持する。

### Task state

`.loop/templates/task-state.yaml` はtracked schema/templateで、task固有値を記録しない。

current instanceは `.loop/state/<task-id>.yaml` に置き、PRへcommitしない。Finding Ledgerもcurrent instanceの `findings[]` だけを正本とする。

publish前:

```bash
node scripts/check-task-state-template.mjs --staged
```

schema更新の場合だけ理由付きの `--allow-schema-change` を使う。

---

## 4. Discovery / PREPARE

探索は狭く始める。

```text
symbol / filename search
  ↓
direct definition
  ↓
direct caller
  ↓
direct test
  ↓
具体的根拠がある時だけ拡張
```

ユーザーへ質問する前に、cheapなauthorized discoveryでmaterial assumptionを解消する。

- sourceから一意に復元できる → C1
- 目的・ACが明確 → C2
- discovery後もmaterial choiceが複数 → C0 / Human Gate
- authoritative source conflictが解消しない → C0 / Human Gate

「漏れが怖いから全repoを読む」はdefaultにしない。

---

## 5. Requirements completeness / Coverage Map

runtime behavior変更では、relevantな観点を一度だけ分類する。

- happy path
- boundary
- error / failure
- empty / loading
- auth / ownership
- persistence / state transition
- caller compatibility
- concurrency / idempotency
- navigation / accessibility

全部を毎回testしない。relevantな観点だけAC / IV / TCへ落とす。

### Forward coverage

`AC / relevant IV → Test / Evidence`

### Reverse coverage

`behavior-changing diff → AC / IV / design deviation`

requirements gapはPREPAREへ戻す。test gapはEvidence追加またはRequirements正式変更までVerification PASS不可。

---

## 6. Verification calibration

Fail-fast:

```text
scopeable static / owning tsconfig
  ↓
targeted unit / contract
  ↓
affected integration / Convex
  ↓
required functional E2E
  ↓
repo-wide regression = CI Aftercare
```

### Low-impact policy

reversible / low-impact変更でimplementation detailを鏡写しするだけの新規testを作らない。

新規testはobservable AC/IV、material boundary、Required Control、実在するregression riskを証明する場合だけ追加する。

required checksがPASSした後にtestを広げるのは:

- content change
- material failure
- unresolved concern
- Required Controlの追加Evidence

がある時だけ。

同じfull suiteをlocalとCIで理由なく重複しない。

---

## 7. Review / Delegation

通常のindependent reviewerは最大1体。

R4だけを理由にreviewer / specialistを増やさない。materially distinctなRequired Controlが別専門性を要求する場合だけspecialistを追加する。

subagentは:

- read-only discovery
- required independent review
- path-disjoint analysis

が安全に並列化でき、wall-clock短縮または独立coverage改善にmaterially効く場合だけ使う。

same shared diffのwriterは原則1体。reviewer同士を討論させずrootが1回統合する。

Reviewはomission-first。

- contractに実装/Evidenceが無い
- diffがcontractに対応しない
- relevant dimensionのTCが無い
- 必要なboundary / denial / failureが抜ける
- Preserve経路を壊す
- scope外behavior change

具体的不足が見つかった時だけsource探索を広げる。

---

## 8. Mid-turn steering

作業中にユーザーから修正・追加指示を受けた場合:

1. 新しい指示を最優先sourceとして取り込む
2. affected Goal / scope / AC / IV / TC / Risk / Controlsだけ更新
3. unaffected contract / work / Evidenceを維持
4. bounded deltaだけImplementation / Verification / Reviewへ戻す
5. material choiceが新たに発生した時だけPREPARE / Human Gateへ戻す

loop全体を無条件にrestartしない。

same tree/contentならEvidenceを再利用する。content changedならdelta Verification / Review、protected behaviorやRisk/Controlsが変わる、またはdelta unboundedならaffected scopeをfull rerunする。

---

## 9. Finding Ledger / Learning

Verification / Review / CI / residual decisionを別構造へコピーしない。

`.loop/state/<task-id>.yaml` の `findings[]` が唯一の正本。

Process Learningはevent-driven。

Learning Event例:

- human correction
- unexpected Gate / CI / E2E failure
- actionable review finding
- repeated retry / Incident
- scope / impact / delivery miss

R3/R4だけを理由に起動しない。

Timing telemetryは改善Evidenceに使うが、telemetry自体を新Gateにしない。

---

## 10. Quality invariants kept

軽量化しても削らない。

- C0で実装しない
- repository changeのWorkspace Preflight
- shared diffはone writer
- max observed Risk floor
- Required Controls
- forward / reverse coverage
- required Verification / Review
- protected findingのagent-only defer禁止
- test gapのHuman Gate迂回禁止
- production / irreversible operationのHuman Gate
- latest `preview` PR contentがmerge-readyになるまでAftercare

v12の狙いは**品質を下げることではなく、確認・test・Agent・再読を必要な根拠へ束縛し、強いinstruction-following modelが不要に止まったり広げたりする余地を減らすこと**や。
