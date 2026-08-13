---
name: task-transition
description: PR AftercareとProcess Learningの完了後、現在taskを閉じ、次taskへ引き継ぐ情報だけを明示的に再束縛する。別taskへ移る前の境界管理に使う。
license: Apache-2.0
---

# Task Transition

現在taskのDeliveryと振り返りがterminalになるまで次taskを開始しない。

1. task ID、source、branch、worktree、PR、Delivery結果、Learning結果を記録する。
2. current taskに未完了のAftercareがないことを確認する。
3. 次taskが無ければsessionをreleaseしてDONEへ進む。
4. 次taskがある場合は新しいtask packetを作り、必要なcontextだけを引き継いでWORKSPACE_PREFLIGHTへ戻る。
5. 前taskのIssue、review、CI結果を暗黙に次taskへ持ち越さない。

詳細なGate条件は `.loop/process.yaml` を正本とする。
