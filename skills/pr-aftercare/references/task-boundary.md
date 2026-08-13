# Task boundary

Aftercareがterminalになるまで別taskのbranch、worktree、Delivery PRへ切り替えない。同一taskの修正は既存PRへ積む。

単に「PRを投げて」「PR作って」は停止指示とみなさず、merge-readyまでAftercareを続ける。「PR作成までで止めて」と明示された場合だけ例外を記録できる。
