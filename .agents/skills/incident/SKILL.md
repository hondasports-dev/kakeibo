---
name: incident
description: Verification、Review、CI、E2E、外部サービス等で失敗・BLOCKED・同一失敗の反復が起きたとき、事実からRoot Causeを切り分けて失敗Gateへ戻す。
---

# Incident / Root Cause Loop

## 目的

失敗した状態のまま先へ進むことや、同じ修正を惰性で繰り返すことを防ぐ。

## 前提

AGENTS.mdの常時必須Skillを適用済みであること。

## 自動トリガー

次のいずれかで使う。

- 必須VerificationがFAIL / BLOCKED
- 同じtest / commandが2回同じ理由で失敗
- 同じreview findingが2回再発
- CI / E2E failureの原因が不明
- localとCI / previewで結果が異なる
- runtime障害・回帰が発生
- env / auth / external serviceが原因でGateを進めない

## 重要原則

- `BLOCKED` は `DONE` ではない。
- 「理由をPRに書いて次へ進む」を回避策にしない。
- 失敗ログを読まずに同じcommandを再実行し続けない。
- 修正前に、今回の変更起因かbase側にも存在するかを可能な範囲で切り分ける。
- secret / PIIを調査ログへ転記しない。

## Step 1: 事実を固定する

```text
Goal:
Failed gate:
Observed symptom:
Exact error / failing test / check:
First occurrence:
Reproduction condition:
Changes made before failure:
Attempts and results:
Last known good state:
Known facts:
Unknowns:
```

症状と推測を混ぜない。

## Step 2: Failure domainを分類する

最低限次を検討する。

- implementation
- test itself / locator / assertion
- test data / stale data
- async / race / shared state
- auth / authorization
- `.env.local` / secret mismatch
- Convex deployment / external service
- browser / tool / dependency
- CI-only difference
- base branchに既に存在するfailure
- scope外のcaller / shared module回帰

## Step 3: Base / Controlとの比較

変更起因か不明な場合、可能ならbase (`preview`) または最後の正常状態で同等条件を確認する。

- baseでも失敗 → pre-existing / environmentの可能性
- headだけ失敗 → current changeの可能性

ただしbase失敗を理由に、自分の変更で追加した別のfailureまで無視しない。

## Step 4: 独立仮説を3つ作る

現在の修正方針に固執せず、少なくとも3つの独立仮説を作る。

```text
Hypothesis A:
Evidence for:
Smallest falsifying check:
Reject when:

Hypothesis B:
Evidence for:
Smallest falsifying check:
Reject when:

Hypothesis C (reframe the problem):
Evidence for:
Smallest falsifying check:
Reject when:
```

1つは「そもそもの問題定義・前提が間違っている」可能性を含める。

## Step 5: 最小検証を1つだけ実行する

- 変更量が小さく、結果が明確な検証を優先
- 1回に複数仮説を潰そうとして大規模変更しない
- 仮説が外れたら同じ操作を繰り返さず次の仮説へ
- 原因切り分けのための一時変更は本修正と区別する

## Step 6: Root Causeを確定する

Root Causeは「E2Eが落ちた」のような症状ではなく、**なぜ起き、どの条件で再発するか**まで説明する。

```text
Root cause:
Why it happened:
Why existing gates did not catch it earlier:
Affected scope:
Fix:
Regression evidence needed:
Restart state:
```

Root Causeを確定できない場合は、`explicit blocker` と追加で必要なEvidenceを明示する。

## Step 7: 修正して適切なGateへ戻る

- implementation defect → `IMPLEMENTATION → VERIFICATION ...`
- test defect → testを修正し `VERIFICATION` を再実行
- review修正 → `IMPLEMENTATION → VERIFICATION → CODE_REVIEW`
- security修正 → `IMPLEMENTATION → VERIFICATION → CODE_REVIEW → SECURITY_REVIEW`
- deliveryでcode change → `IMPLEMENTATION` から再ループ
- environment復旧のみ → 失敗したVerification / Delivery Gateから再開
- specification conflict → `REQUIREMENTS`

修正後、失敗した1チェックだけでなく、その変更で無効になった後続Gateも再実行する。

## Escalation

- 3つの独立仮説を検証しても原因を絞れない
- 必要権限・approval・production access等、人間しか解消できない
- 復旧操作自体が高リスクでHuman Gateが必要

この場合は推測で進まず `BLOCKED` とする。

## Learning Event

Incidentが解消したら必ず `process-learning` の入力にする。

特に次はCandidate候補:

- 事前チェックで機械検知できた
- 同じ環境問題が再発しうる
- Impact Analysisで見つけるべきだった
- Verification Gate不足だった
- delivery手順抜けだった
- 人間が同じ確認を繰り返していた

## 出力

```text
INCIDENT
Status: RESOLVED | BLOCKED
Failed gate:
Facts:
Hypotheses tested:
Root cause / blocker:
Affected scope:
Fix:
Regression evidence:
Restart state:
Learning event:
```
