---
name: requirements
description: PREPAREを所有し、Spec Confidence、scope、ID付きAcceptance Criteria/Invariant、Risk、Required Controls、Coverage Mapを一度だけ確定する。許可済みdiscoveryを先に使い、不要な確認停止と長文再読を避ける。
license: Apache-2.0
---

# PREPARE / Requirements

## 目的

実装前に「何を作るか」「何を守るか」「何を証明するか」を一度だけ決める。

このSkillは次を所有する。

- Goal / In scope / Out of scope
- ID付き Acceptance Criteria（`ACxx`）
- ID付き Preserve / Invariant（`IVxx`）
- relevant requirement dimensions
- material assumptions
- Spec Confidence
- Risk / max observed Risk
- Required Controls
- compact Coverage Map
- Verification plan / Test Case（`TCxx`）
- 必要十分な Impact summary

`C0` のままImplementationへ進まない。

## Instruction / autonomy

優先順位は `AGENTS.md` / `.loop/process.yaml` に従う。current explicit user instructionはこのSkillの一般ガイドより優先する。ただしnon-bypassable safetyは維持する。

ユーザーへ質問する前に、現在の依頼から既に許可されているread-only discoveryを実施する。

- repository / docs / tests / existing patternをcheapに確認する
- material assumptionをsourceから一意に解消できるならC1として進める
- routineな実装detailは既存patternから合理的に補う
- reversibleな準備作業を止めない

Human Gateへ送るのは、authorized discovery後も**成果物をmaterially変える妥当な選択肢が複数残る場合**だけ。質問時は、確認済み事実・具体的な選択肢・差分を示す。

R4 classificationだけではHuman Gateを起動しない。production / irreversible operationの承認は、実装・検証・review等のreversible作業を終えた後、具体的操作の直前に扱う。

このSkillが原因でpermission確認・停止・未完了が必要になる場合は、該当する指示を明示し、Skillの明示要件とAgent解釈を分ける。

## Context discipline

PREPAREでsourceを読んだ後、後工程へ長文を再コピーしない。

保持するのは短いcontractと参照だけ。

- authoritative sourceはURL / path / Issue comment等の参照を残す
- 同じsource本文をtask-stateや各stage outputへ複製しない
- AC / IV / TCはIDで参照する
- unchangedなGoal / scope / Risk / Controlsを後stageで再要約しない

探索はまずcheapに絞る。

1. code search / symbol / filenameでdefinition・direct caller・direct test候補を出す
2. 直接関係する箇所だけ読む
3. material assumption、shared impact、source conflictを解消できない時だけ範囲を広げる

「漏れが怖いから全repoを読む」はdefaultにしない。

## Workspace Preflight

repository fileを変更するtaskでは、最初の編集前に `skills/workspace-preflight/SKILL.md` を適用する。

これは独立した長いreasoning Gateではなく、PREPARE内のcheap deterministic control。

## Spec Confidence

### C2 confirmed

目的・期待結果・主要ACが明確でmaterial conflictなし。

### C1 reconstructed

不足はあるが、authoritative docs / tests / existing patternからmaterial product choiceなしに復元できる。

### C0 unclear

複数の妥当な成果物があり、選択でUX・data意味・権限・課金・完了条件等がmaterially変わる。

→ Requirements Discoveryを先に行う。解消しなければHuman Gate。

### C0 conflicted

desired stateについてauthoritative source同士が矛盾する。

→ Source reconciliationを行う。解消しなければHuman Gate。

## Source priority

1. current explicit user instruction
2. latest explicitly approved spec / ADR / decision
3. current task Issue / comments
4. canonical docs
5. tests
6. current implementation / existing pattern

Issueが「現在BをAへ変える」と明示している場合、Bとの差はexpected deltaでありconflictではない。

既存testは重要なEvidenceやが、現在の明示仕様と矛盾する場合にtestを仕様へ昇格させない。

## Mid-turn steering

PREPARE後に新しいユーザー指示が来た場合、全contractを作り直さない。

- 新しい指示を最優先sourceへ追加する
- 影響するGoal / scope / AC / IV / TC / Risk / Controlsだけ更新する
- unaffected contract / source ref / Evidenceは維持する
- material choiceが新たに生じた時だけC0へ戻す

## Material assumptions

記録するのは、間違うと実装結果がmaterially変わる推測だけ。

- cheapに確認できる → Implementation前に確認
- sourceから一意に復元できる → C1として根拠を残す
- 複数の妥当な選択肢が残る → C0

細かい実装推測を大量にledger化せず、product behavior / data / auth / caller / completion条件に効くものだけ残す。

## Requirement completeness scan

runtime behaviorを変えるtaskでは、次を**一度だけ** `relevant` / `not_applicable` に分類する。

- happy path
- boundary
- error / failure
- empty / loading
- auth / ownership
- persistence / state transition
- caller compatibility
- concurrency / idempotency
- navigation / accessibility

`relevant` な観点はACまたはIVとTCへ反映する。

`not_applicable` は短い理由だけ残し、観点ごとの長い定型文を作らない。

### AC

ACは1件1意味で、外から観測できる期待結果を書く。

```text
AC01: 条件Xで操作すると結果Yになる
AC02: 権限なしでは操作できず状態も変わらない
```

### Invariant / Preserve

今回壊してはいけない既存behaviorだけをID化する。

```text
IV01: 既存caller Aの戻り値契約を維持する
```

全部の既存behaviorを列挙しない。

## Coverage Map

runtime behavior変更、Required Controlあり、またはR2以上ではcompact Coverage Mapを作る。

```text
AC01 → implementation: src/a.ts → TC01
AC02 → implementation: convex/b.ts → TC02, TC03
IV01 → implementation: shared/c.ts → TC04
```

AC本文を何度もコピーせずIDだけで繋ぐ。

### Forward coverage

すべてのACとrelevant IVに:

- 1つ以上のVerification case、または
- behavior不変等の明示NOT_REQUIRED理由

があること。

### Reverse coverage

想定するbehavior-changing surfaceがAC / IV / 明示したdesign deviationのどれかへ対応すること。実際のdiffはImplementation終了時に確定する。

## Test Case derivation

TCはAC/IVから導出する。

positive / boundary / negative / failure / regression / functional E2Eを全部機械的に作らず、`relevant` と判定したdimensionだけ作る。

reversible / low-impact変更では、implementation detailを鏡写しするだけのtestを計画しない。何を証明するかをTC IDで短く定義する。

## Independent Spec Review

RiskがR3/R4という理由だけでreviewerを増やさない。

最大1 reviewerを使うのは次だけ。

- C1復元後もmaterial choiceが残る
- 復元した仕様がauth/data/financial等のprotected behaviorを変える

Reviewerには長い会話履歴ではなく、source参照 + Goal/scope + AC/IV + material assumptions + relevance dimensions + TC案を渡す。

Reviewer同士を討論させない。rootが1回統合する。

## Risk

4軸 `0..2`。

- Blast Radius
- Data / Security
- Reversibility
- Uncertainty

目安:

- 0..2 → R1
- 3..4 → R2
- 5..8 → R3

R0 / R4は明示条件。

R4代表:

- production DB/data migration
- bulk / irreversible mutation
- account deletion semantics
- authorization model overhaul
- financial settlement integrity
- production secret rotation
- production DNS/domain cutover

Risk上昇は発見時点で即時。Implementation開始後はmax observed Riskをcompletion floorにする。

**R4は検証・review・recovery要求を強める分類であり、Human Gateそのものではない。**

## Required Controls

Riskとは別に選ぶ。

- `workspace_preflight`
- `security_review`
- `data_model`
- `financial_integrity`
- `destructive_or_stateful`
- `service_ops`
- `human_gate`
- `prompt_injection_guard`

Human Gateを選ぶのは、unresolved material choice、production/irreversible write、production secret/DNS/money movement、protected finding acceptance等の具体的triggerがある時だけ。

authやschemaに触れたという理由だけで全High ceremonyを起動せず、必要なControlを追加する。

## Impact

通常はこのpacketの `impact_summary` で十分。

`skills/impact-analysis/SKILL.md` を別途読むのは:

- cross-cutting
- shared state / callersが多い
- auth/data/schema/financial/external writeの影響が不明
- rollback/deploy impactが不明

## PREPARE PASS条件

- C1 / C2
- authorized discovery実施済み
- unresolved material choiceなし
- material assumptionが解消済み、またはC1根拠あり
- AC / relevant IVがID付き
- runtime behavior変更ならrelevance dimensions分類済み
- required taskではCoverage Map作成済み
- AC / relevant IVごとにVerification caseまたは明示NOT_REQUIRED理由あり
- Risk / Controls / Verification plan確定

## 出力

長文sourceの再要約は不要。

```text
PREPARE
Status: PASS | BLOCKED
Workspace preflight:
Spec confidence:
Source refs:
Material assumptions:
Goal:
In / Out:
AC IDs:
IV IDs:
Relevant dimensions:
Coverage Map:
Risk / max observed:
Controls:
Verification TC IDs:
Independent spec review:
Human Gate trigger:
Evidence:
```
