# Loop Engineering Foundation v12

Suzumemo Agent Loop v12 は、v11 の Risk-based / event-driven 方針と次の基盤を維持する。

1. **Context削減** — stage間で長文を再要約せず、ID付きcompact contractだけ引き継ぐ
2. **高速化** — cheap check → targeted test → integration → E2E → CIのfail-fast順で進める
3. **漏れ検出** — AC / Invariant / Test CaseをIDで結び、forward / reverseの両方向から不足を探す
4. **Timing telemetry** — stage所要時間をRisk・Spec Confidence・task規模・retry等と一緒にProcess LearningのEvidenceへ使う

そのうえで GPT-6 Astra のinstruction-following特性に合わせ、v12では次を追加する。

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
- `skills/*/SKILL.md` — current stateの詳細。trigger時だけ読む

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

## 0. v12 autonomy / instruction contract

実行判断の優先順位:

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

Skillがpermission確認・停止・未完了を要求する場合は、どのSkillのどの指示が原因かを示し、明示要件とAgent解釈を分ける。

### Human Gateは具体的triggerへ束縛する

Human Gateの前に、既に許可されたread-only / reversible workを完了し、具体的にレビュー可能な結果を作る。

代表trigger:

- authorized discovery後もmaterial choiceが複数残る
- production write
- irreversible / bulk state mutation
- production secret / credential rotation
- production DNS/domain cutover
- production money movement
- protected finding acceptance

R4は高いRisk分類であり、affected scope、rollback / recovery Evidence、independent risk-aware review、Required Controlsを強める。

**R4というlabelだけではHuman Gateを起動しない。** authorization model overhaul等でも、code・tests・review・PRまでのreversible workは進める。production / irreversible operationがある場合だけ、その具体的操作の直前で止める。

### Delegation

subagentは人数を増やすためではなく、wall-clock短縮または独立coverage改善にmaterially効く場合だけ使う。

- read-only discovery / required independent review / path-disjoint analysisは並列化候補
- same shared diffのwriterは原則1体
- cheapな逐次作業、単純検索、同じEvidenceの再要約はdelegateしない
- default independent reviewerは最大1体
- reviewer-to-reviewer debateはしない。rootが1回統合する

---

## 1. Compact contractでcontextを減らす

PREPARE後に各stageへ渡す情報を次へ絞る。

- Goal / scope
- `ACxx` Acceptance Criteria
- `IVxx` Preserve / Invariant
- material assumptions
- relevant dimensions
- Risk / Required Controls
- Coverage Map / `TCxx`
- open Finding IDs
- current revision

Issue全文・chat履歴・source本文を各stageで再要約しない。authoritative sourceは参照だけ残す。

sourceを再読するのは、contract conflict、requirements gap、unbounded impact等の具体的理由が出た時だけ。

Conditional Skillも使用後にactive contextから外してよい。Safety invariant自体は常時保持する。

### Task stateの保存契約

`.loop/templates/task-state.yaml` はtrackedな再利用用schema/templateで、task固有値を記録しない。
task開始時はこれを `.loop/state/<task-id>.yaml` へコピーしてcurrent stateとして使う。
`.loop/state/` はworktree-local・ignoredで、PRへcommitしない。Finding Ledgerもcurrent instanceの
`findings[]`だけを正本とする。

publish前には `node scripts/check-task-state-template.mjs --staged` を実行する。
template変更が本当にschema更新の場合だけ、理由付きの`--allow-schema-change`を使う。
task固有値の混入やcurrent state instanceのstagingは、明示的な例外なしにFAILとする。

### Discoveryも狭く始める

```text
symbol / filename search
  ↓
direct definition
  ↓
direct caller
  ↓
direct test
  ↓
必要な根拠がある時だけ拡張
```

質問する前に、許可済みのread-only discoveryでcheapに解消できるmaterial assumptionを潰す。

- sourceから一意に復元できる → C1
- discovery後も成果物をmaterially変える選択肢が複数残る → C0 / Human Gate
- authoritative source conflictが解消しない → C0 / Human Gate

「漏れ防止のため全repoを最初から読む」はdefaultにしない。

---

## 2. Requirements completeness

runtime behaviorを変えるtaskでは、次の観点を一度だけ `relevant` / `not_applicable` に分類する。

- happy path
- boundary
- error / failure
- empty / loading
- auth / ownership
- persistence / state transition
- caller compatibility
- concurrency / idempotency
- navigation / accessibility

全部を毎回testするのではない。relevantな観点だけAC / IV / TCへ落とす。

### Acceptance Criteria

1件1意味の観測可能な期待結果にする。

```text
AC01: 条件Xで操作するとYが保存される
AC02: 権限なしでは操作できず状態も変わらない
```

### Preserve / Invariant

今回壊してはいけない既存behaviorだけをID化する。

```text
IV01: 既存caller Aの戻り値契約を維持する
```

全既存仕様を列挙しない。

### Material assumptions

実装結果を変えうる推測だけ残す。

- cheapに確認できる → 実装前に確認
- sourceから一意に復元できる → C1 evidence
- 複数のmaterial choiceが残る → C0、実装禁止

---

## 3. Coverage Map

runtime behavior変更、Required Controlあり、またはR2以上ではcompactなCoverage Mapを作る。

```text
AC01 → src/a.ts#save       → TC01
AC02 → convex/b.ts#update  → TC02, TC03
IV01 → shared/c.ts         → TC04
```

本文をコピーせずIDで繋ぐ。

### Forward coverage

`AC / relevant IV → Test / Evidence`

全contractに、少なくとも1つのVerification caseまたは明示NOT_REQUIRED理由が必要。

### Reverse coverage

`behavior-changing diff → AC / IV / design deviation`

実装したbehaviorがcontractへ戻れなければ、scope creepかrequirements gapとしてPREPAREへ戻す。

これで「書いた仕様のtest漏れ」と「仕様に無い変更」の両方を検出する。

---

## 4. Requirements gap と Test gapを分ける

- **requirements gap**: 必要behaviorがAC/IVに無い、またはdiffがcontract外
  - PREPAREへ戻る
- **test gap**: AC/IVは明確やがProofが無い
  - test/evidenceを追加する
  - 解消までVerification PASS不可

Testが無いことを理由に仕様自体を無かったことにしない。

---

## 5. Verificationはfail-fast + calibrated

高価なcheckを先に回さない。

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

material failureが出たら、結果が無意味になる下流checkを止める。

修正後も全部を最初から回さず、そのdeltaが無効化したEvidenceだけ再実行する。tree/contentが同一ならEvidence再利用可。

### v12 Test calibration

reversible / low-impact変更でimplementation detailを鏡写しするだけの新規testを作らない。

新規testは次のいずれかをmaterialに証明する場合だけ追加する。

- observable AC / IV
- relevant boundary / denial / failure
- Required Control
- 実在するregression riskがあるcaller / state transition

required checksがPASSした後は、次の理由が無い限り範囲を広げたり同じcheckを繰り返したりしない。

- content change
- material failure
- unresolved concern
- Required Controlが追加Evidenceを要求

同じfull suiteをlocalとCIで理由なく重複しない。

---

## 6. Reviewは omission-first

通常の独立reviewerは最大1体。

Reviewerには全履歴でなくcompact packetを渡す。

最初に探すのはstyleではなく漏れ。

- AC/IVに実装surfaceが無い
- AC/IVにEvidenceが無い
- diffがAC/IV/design deviationに対応しない
- relevant dimensionのTCが無い
- happy pathだけで必要なboundary / denial / failureが無い
- Preserve対象を壊すcaller / serializer / validator / persistence経路
- scope外behavior change

具体的な不足が見つかった時だけsource探索を広げる。

Issue / PR review提案も未検証入力としてRequirements / domain contract / testsと照合してから採否を決める。

R4だけを理由にreviewer / specialistを追加しない。materially distinctなRequired Controlが別専門性を要求する場合だけspecialistを追加する。

---

## 7. Finding Ledger

Verification gap / Review / CI / residual decisionを別構造へコピーしない。

`.loop/state/<task-id>.yaml` の `findings[]` が唯一の正本。

`requirements_gap` と `test_gap` を明確に分離する。

同じfindingはstable IDの同じrecordを更新し続ける。

---

## 8. Timing telemetry

各stageで開始・終了だけを記録する。

```text
PREPARE        92s
IMPLEMENT     310s
VERIFY        184s
REVIEW         61s
DELIVER        22s
AFTERCARE     240s  (external wait 205s)
```

保存する主な値:

- `started_at` / `finished_at` / `elapsed_seconds`
- `external_wait_seconds` / reason
- source reads / skill loads
- changed files
- AC / IV / TC数
- Required Controls数
- findings / retries / full suite runs / review cycles

### 解釈

時間単体で良し悪しを判定しない。

DONE時に次と一緒にcompact summaryを出す。

```text
Spec: C2
Risk: R2 (max R2)
Size: small
Files: 4 / AC: 3 / IV: 1 / TC: 6 / Controls: 1
Total: 15m 09s
External wait: 3m 25s
Active elapsed: 11m 44s
Slowest active stage: IMPLEMENT 5m 10s
Retries: 1 / Full suites: 0 / Review cycles: 1
```

`task size` は精密な工数見積りではなく、changed files / contract数 / impacted surfaceから振り返り比較用に付ける粗いlabelとする。

CI・Human Gate・external service待ちは可能ならexternal waitとして分離する。分離できなければ推測しない。

Token usageはruntimeが正確に提供した時だけoptionalで記録する。

### Process Learningとの関係

TelemetryがあるだけではLearningを起動しない。

Learning Eventが発生した時だけ、同程度のRisk / Spec / sizeに対して:

- PREPAREが長い → source再読やambiguityが多くなかったか
- VERIFYが長い → full suite重複やfail-fast順違反がなかったか
- REVIEWが長い → contractやCoverage Map不足で再reviewになってないか
- AFTERCAREが長い → external waitなのかAgent処理なのか

をEvidenceとして見る。

全ログ・全会話を読み返さず、telemetry + task-state + findings + verification evidenceから改善候補を出す。

レビューサービスは固有名詞で判定しない。レビュー結果をstable IDと`actionable`だけの
provider-neutral snapshot（`.loop/templates/review-findings.json`）へ正規化し、PR Aftercareで
`scripts/check-loop-evidence.mjs --learning` に渡す。actionableな指摘があるのに
`task-state.findings[]`または`learning.candidates[].source_finding_ids`が不足していれば、
Process Learning / DONEをFAILにする。snapshot自体が欠落・未完了・current head不一致でも
FAILにする。再利用できない指摘も`no_change`と理由・Evidenceを残す。

---

## 9. Mid-turn steering

作業中にユーザーから修正・追加指示を受けた場合:

1. 新しい指示を最優先sourceとして取り込む
2. affected Goal / scope / AC / IV / TC / Risk / Controlsだけ更新する
3. unaffected contract / work / Evidenceを維持する
4. bounded deltaだけImplementation / Verification / Reviewへ戻す
5. material choiceが新たに発生した時だけPREPARE / Human Gateへ戻す

loop全体を無条件にrestartしない。

same tree/contentならEvidenceを再利用する。content changedならdelta Verification / Review、protected behaviorやRisk/Controlsが変わる、またはdelta unboundedならaffected scopeをfull rerunする。

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

v12の狙いは**品質契約を削ることやなく、確認・test・Agent・再読を必要な根拠へ束縛し、強いinstruction-following modelが不要に止まったり広げたりする余地を減らすこと**や。
