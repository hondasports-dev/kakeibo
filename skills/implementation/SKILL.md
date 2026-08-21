---
name: implementation
description: PREPAREで確定したAcceptance Criteria、Risk、Required Controls、Verification planに従って、one-writerで最小差分を実装する。
license: Apache-2.0
---

# Implementation

## 前提

- Spec Confidence C1/C2
- PREPARE PASS
- repository changeならWorkspace Preflight PASS / documented exception
- Risk / Required Controls / Verification plan記録済み
- required Human Gateがimplementation前に必要なら承認済み

前工程を長く再要約しない。PREPARE packetを参照する。

## Writer境界

- same shared diffのwriterは原則1体
- 複数writerはpath-disjointを証明できる時だけ
- 他taskの差分を混ぜない
- secret / `.env.local` / local artifactをcommitしない

## 実装

- Acceptance Criteriaに必要な最小変更
- scope外refactorを混ぜない
- behavior change / bug fixでは必要ならRED/GREEN
- kakeibo固有の既存patternを尊重する

## 新しい発見

実装中に次を見つけたら勝手にscopeだけ広げない。

- material spec ambiguity → PREPAREへ
- shared caller / provider impact → Risk/Controls再評価
- auth/data/financial/external impact → Controls追加・Risk再評価
- production / irreversible effect → R4/Human Gate

Implementation開始後はmax observed Riskがcompletion floor。

## 終了確認

- intended filesのみ
- ACと差分が対応
- design deviationは説明済み
- newly observed riskはPREPAREへ反映
- Verification planを更新済み
- unrelated dependency/refactorなし
- secret/local-only artifactなし

## 出力

```text
IMPLEMENTATION
Status: PASS | FAIL | BLOCKED
Changed files:
Design deviations:
Newly observed risk:
Controls changed:
Verification plan changed:
Evidence:
```
