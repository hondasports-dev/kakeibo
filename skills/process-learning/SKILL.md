---
name: process-learning
description: PR Aftercare後、Learning EventがあるtaskまたはR3/R4 taskで失敗・訂正・review修正を振り返り、再利用可能な改善候補へ変換する。R0-R2でEventが無い場合はfast none pathを使う。
license: Apache-2.0
---

# Process Learning

## 方針

Process Learningは重要だが、**全taskで毎回full Root Cause分析をしない**。

### fast none path

R0-R2で次のEventが1つも無ければ:

```text
PROCESS_LEARNING
Status: PASS
Mode: fast_none_path
Events: none
Candidates: none
```

で終了する。

### full path

次の場合だけfull analysisを行う。

- Risk R3 / R4
- human correction
- Gate / CI / E2E failure
- actionable review finding
- retry / incident
- scope / impact miss
- delivery / aftercare / task-transition miss

## 実行タイミング

- required PR Aftercareがterminalになった後
- Task Transitionの前

PR作成直後には行わない。Aftercare中のfailure / review findingもLearning Eventへ含める。

## Full analysis

### 1. Event抽出

事実だけを集める。

- human correction
- Gate failure / BLOCKED
- CI / E2E
- review finding
- retry回数
- Incident
- stale head / delivery miss
- task boundary miss

### 2. Root Cause

```text
Observed problem:
Immediate cause:
Process cause:
Why existing enforcement did not catch it:
Earlier detection / prevention condition:
```

### 3. Generalize

Issue固有名を外して再利用可能なruleへする。

### 4. Duplicate Check

優先確認:

- scripts / code
- CI / Gate
- skills
- AGENTS.md
- runbook/docs

既存ルールがあったのに破ったなら、文章追加より強制力の昇格を優先する。

### 5. Target

優先順位:

1. Script / Code
2. CI / Gate
3. Skill
4. AGENTS.mdの短いPolicy
5. Runbook / Docs
6. Task Context

## 現在PRとの境界

Learningで新しい改善を見つけても、現在taskのscopeに含まれなければ同じPRへ混ぜない。

ユーザーが現在PRへの反映を明示した場合だけ同PRへ入れ、変更後は必要なRisk/Profile GateとAftercareを再実行する。

## 出力

```text
PROCESS_LEARNING
Status: PASS
Mode: fast_none_path | full
Risk level:
Events reviewed:
Candidates:
Duplicate status:
Proposed target:
Human Gate required:
Evidence:
```
