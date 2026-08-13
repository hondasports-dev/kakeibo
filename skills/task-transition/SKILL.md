---
name: task-transition
description: PR AftercareとProcess Learningの完了後、現在taskを閉じ、sessionを解放するか次taskへ必要な情報だけを明示的に再束縛する。別taskへ移る前の境界管理に使う。
license: Apache-2.0
---

# Task Transition

## 目的

前taskを未完了のまま次taskへ持ち込まない。

## 前提

- PR AftercareがPASS、またはユーザー明示の例外がある
- Process LearningがPASS
- 必須BLOCKEDが残っていない

## Current task closure

次を記録する。

```text
Task ID / source
Objective
Branch / worktree
Delivery PR
Delivery target / result
Final head SHA
PR Aftercare result
Process Learning result
```

`pr_created` checkpointだけではterminalとみなさない。

## 次taskなし

current task bindingをreleaseし、Evidenceを残してDONEへ進む。

## 次taskあり

新しいtask packetを作り、`WORKSPACE_PREFLIGHT` へ戻る。

```text
Next task ID / source
Objective
Relevant carried context
Explicitly excluded prior context
```

前taskのIssue、review、CI結果、branch、PRを暗黙に引き継がない。新taskに必要なcontextだけを明示的にcarryする。

## Session invariant

通常は1 sessionにつきcurrent taskは1つ、1 taskにつきDelivery PRは最大1つとする。並行taskはユーザーが明示的に許可した場合だけ例外。

## FAIL / BLOCKED

- Aftercare未完了 → PR_AFTERCARE
- Process Learning未完了 → PROCESS_LEARNING
- task identity / sourceが不明 → 新taskを開始せずBLOCKED
- 前taskの未完了を発見 → 対応Gateへ戻る

## 出力

```text
TASK_TRANSITION
Status: PASS | BLOCKED
Closing task:
Next task: none | bound
Next task packet:
Session released: yes | no
Evidence:
```
