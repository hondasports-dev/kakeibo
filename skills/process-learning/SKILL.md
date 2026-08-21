---
name: process-learning
description: Learning Eventが実際に発生したtaskだけ振り返り、再利用可能な改善候補へ変換する。Risk R3/R4だけを理由に起動しない。
license: Apache-2.0
---

# Process Learning

## 完全event-driven

次のEventが1つ以上ある時だけ起動する。

- human correction
- unexpected Gate / CI / E2E failure
- actionable review finding
- repeated retry / Incident
- scope / impact miss
- delivery / aftercare miss
- process rule / enforcement不足が明確になった

Risk R3/R4という理由だけでは起動しない。

Eventなし:

```text
Learning event: none
Status: NOT_REQUIRED
```

で十分。

## 分析

```text
Observed problem:
Immediate cause:
Process cause:
Why existing enforcement did not catch it:
Earlier detection / prevention:
Reusable rule:
```

## Target priority

1. Script / code
2. CI / deterministic enforcement
3. Skill
4. AGENTS.mdの短いpolicy
5. Runbook/docs

既存ruleを破っただけなら、文章追加よりenforcement改善を優先する。

## Scope

Learningで見つけた改善がcurrent task scope外なら同じPRへ混ぜない。

ユーザーが同PRへの反映を明示した場合のみ実装し、変更deltaに必要なVerification/Review/Aftercareを行う。

## 出力

```text
PROCESS LEARNING
Status: PASS | NOT_REQUIRED
Events:
Candidates:
Proposed target:
Evidence:
```
