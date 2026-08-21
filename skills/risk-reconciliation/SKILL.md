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

同じfindingはstable IDを維持し、別recordを作らず同じentryを更新する。

## Disposition

### `fix_now`

現在taskで修正する。修正後も即`resolved`にはしない。

同じrecordへ:

- resolution
- verified_revision.commit_sha
- verified_revision.tree_sha
- Verification evidence

を追記し、必要なVerificationがPASSしてから `status: resolved` / `disposition: resolved` へ遷移する。

上記のいずれかが欠落している場合はresolved扱いせずBLOCKED。

### `defer_with_evidence`

非protected domainだけ。

最低限:

- なぜcurrent deliveryが安全か
- mitigation
- follow-up issue / task
- current evidence

protected domainはagent単独defer不可。

### `accept_with_human_gate`

protected findingを現在のまま受け入れる必要がある場合。明示承認を**同じfinding record**へ記録する。

Human Gate approval recordは次をすべて必須とする。

- `human_approval.status: approved`
- `approver`
- `approved_at`
- `scope`
- `evidence`

1つでも欠ける場合は承認済みとみなさずBLOCKED。

`test_gap`には使えない。

### `not_applicable`

現行revisionでは成立しないことをevidenceで示す。根拠がない場合はBLOCKED。

### `resolved`

修正・検証済みを意味する。

遷移には次をすべて必須とする。

- non-empty `resolution`
- `verified_revision.commit_sha`
- `verified_revision.tree_sha`
- non-empty Verification evidence
- 検証結果PASS

証跡不足のrecordを`resolved`へ変更してDelivery blockを回避しない。

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

次が1件でもあればDelivery BLOCKED。

- `status: open`
- `disposition: open` / `fix_now`
- 不完全または未承認のHuman Gate record
- evidence不足のdefer / not_applicable
- resolution / verified revision / Verification evidenceが不足したresolved record

## 出力

```text
FINDING DISPOSITION
Updated finding IDs:
Still blocking:
Human Gate:
Evidence:
```
