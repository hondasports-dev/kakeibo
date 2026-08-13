---
name: pr-aftercare
description: PR公開後、最新headのCI・レビュー・競合・承認状態を追跡し、merge-readyまで収束させるときに使う。
license: Apache-2.0
---

# PR Aftercare

PR作成はcheckpointであり完了ではない。最新headがmerge-readyになるまでこのSkillを使う。

1. 最新head SHAを固定してrequired checks、review、requested changes、競合、承認状態を確認する。
2. pendingはPASSにしない。取得可能ならterminal状態まで確認を続ける。
3. 修正が必要ならImplementationへ戻し、Verification、Code Review、Security Review、Deliveryを再実行する。
4. headが変わったら古い結果を流用せず再確認する。
5. merge-ready後だけProcess Learningへ進む。

詳細は `references/` を参照する。
