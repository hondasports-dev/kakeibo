# Monitoring

各cycleで最新head SHAを記録し、そのheadに対するrequired checks、review、requested changes、競合、承認状態を確認する。

`queued`、`pending`、`in_progress` はPASSではない。状態更新を取得できる環境ではterminalになるまで再確認する。

head SHAが変わった場合、古いheadの成功結果を新しいheadへ流用しない。
