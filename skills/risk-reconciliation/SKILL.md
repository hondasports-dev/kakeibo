---
name: risk-reconciliation
description: Finding Ledgerの未解決recordにfinal dispositionを付ける条件付きhelper。findingを別residual recordへ転記せず、同じrecordを更新する。
license: Apache-2.0
---

# Finding Disposition Helper

## 使う時

`findings[]` に未解決recordがあり、Delivery前に disposition を決める必要がある時だけ使う。

独立した必須serial Gateではない。

## Source of truth

`task-state.findings[]` だけを使う。

別の:

- residual risk list
- source_finding_ids
- source_fidelity
- material_test_gaps

へコピーしない。

## Disposition

### `fix_now`

現在taskで修正。修正後に同じrecordへ:

- resolution
- verified_revision
- evidence
- disposition: resolved

を追記する。

### `defer_with_evidence`

非protected domainだけ。

最低限:

- なぜcurrent deliveryが安全か
- mitigation
- follow-up issue / task
- current evidence

protected domainはagent単独defer不可。

### `accept_with_human_gate`

protected findingを現在のまま受け入れる必要がある場合。明示承認をrecordする。

`test_gap`には使えない。

### `not_applicable`

現行revisionでは成立しないことをevidenceで示す。

### `resolved`

修正・検証済み。

## Protected

- auth / authentication / authorization
- tenant / group boundary
- data integrity
- financial integrity
- rollback
- idempotency / atomicity / immutability
- privileged boundary
- current scope
- test gap
- `other`（分類されるまで）

## Delivery block

`open` / `fix_now`、未承認Human Gate、evidence不足のdefer/not-applicableが1件でもあればDelivery BLOCKED。

## 出力

```text
FINDING DISPOSITION
Updated finding IDs:
Still blocking:
Human Gate:
Evidence:
```
