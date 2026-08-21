---
name: task-transition
description: 次taskへcontextを持ち越す必要がある時だけ使う軽量session cleanup helper。通常taskのcompletion Gateにはしない。
license: Apache-2.0
---

# Task Transition Helper

## 方針

Task Transitionは通常のDONE条件ではない。

単発taskを閉じるためだけに独立reasoning phaseを追加しない。

## 使う時

- 同じsessionで次taskへ進む
- 前taskの一部contextだけを安全にcarryする必要がある
- branch / PR / Issue identityを切り替える必要がある

## Closure packet

必要最小限:

```text
Closing task:
Delivery result:
Branch / PR:
Relevant unresolved follow-up:
```

## Next task packet

```text
Next task ID / source:
Objective:
Carry:
Do not carry:
```

前taskのreview/CI/branch/PRを暗黙に新taskへ流用しない。

新taskのrepository changeは改めてWorkspace Preflightを行う。

## 出力

```text
TASK TRANSITION
Closing task:
Next task: none | bound
Carried context:
```
