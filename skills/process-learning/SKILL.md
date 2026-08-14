---
name: process-learning
description: PR Aftercareが要求された終了点まで収束した後、DONEや次taskへの遷移前に、人間の訂正、失敗、再試行、CI・レビュー修正、Delivery漏れを振り返り、再利用可能なLearning Candidateと最適な反映先を作る。
license: Apache-2.0
---

# Process Learning

## 目的

個別タスクの失敗を「次は気をつける」で終わらせず、**次回のループそのものを改善する入力**へ変換する。

1回の出来事からAGENTS.mdやSkillを無制限に肥大化させず、まずCandidateとして評価する。

## 実行タイミング

- `PR_AFTERCARE: PASS` またはユーザー明示による根拠付き `NOT_REQUIRED` の後
- `TASK_TRANSITION` の前
- Incident解消があったtaskでは必ずIncidentを振り返る
- 人間から差し戻しがあったtaskでは必ず差し戻しを振り返る

PR公開直後には実行しない。CI、review、conflict、approval、追加修正まで含めたAftercare全体をLearning Eventの対象にする。

ユーザーが振り返りだけ後回しにした場合は、本Gateを開始しない。PR Aftercareは止めない。Aftercareがterminalになったら、保留を恒久スキップに読み替えず本Gateを実行する。`stop_after_publish` や Aftercare `NOT_REQUIRED` にはしない。

Learning Eventが無い場合も `none` と判定してGateを閉じる。

## Learning Event

代表例:

- `human_correction`: 人間が仕様・手順・完了判定を訂正した
- `missing_evidence`: 実行していないことを完了扱いした
- `repeated_retry`: 同じ失敗・同じ修正を繰り返した
- `escaped_defect`: Review/Verification後に不具合が見つかった
- `ci_or_e2e_failure`: CI/E2Eで初めて不足が判明した
- `impact_miss`: caller/shared state/auth等の影響を見落とした
- `delivery_step_miss`: PR/CI/review/merge/cleanupを飛ばした
- `aftercare_miss`: PR公開後の監視・指摘対応・最新head確認を省略した
- `task_transition_miss`: 前taskを閉じず別taskへ移った
- `session_scope_leak`: 前taskのIssueやcontextが別taskへ混入した
- `manual_check_repetition`: 人間が毎回同じ確認をしている

## Step 1: Event抽出

次をEvidenceとして見る。

- 人間の訂正・追加指示
- Gate FAIL / BLOCKED
- Incident
- local Verification結果
- CI / E2E failure
- human / bot review findings
- requested changes
- conflict対応
- Aftercare cycle数とhead更新
- 作業順序のやり直し
- 「追加した」vs「実行した」の食い違い
- PR作成後の不足
- task切替時のsource / branch / PR混線

## Step 2: Root Cause

症状ではなく、なぜ現行プロセスで防げなかったかまで分析する。

```text
Observed problem:
Immediate cause:
Process cause:
Why existing gate/skill did not catch it:
What condition would detect/prevent it earlier:
```

## Step 3: Generalize

Issue固有名を外して再利用可能な条件にする。

良い例:

- `required test added != required test executed and passed`
- `PR created != merge ready`
- `pending check != delivery complete`
- `new task requires explicit task transition`

悪い例:

- `Issue #NNでは忘れない`
- `次回は注意する`

## Step 4: Duplicate Check

次を検索する。

- `AGENTS.md`
- `skills/**`
- `.loop/process.yaml`
- `scripts/**`
- `.github/workflows/**`
- 関連runbook/docs

判定:

- `duplicate`: 同じ仕組みがある。追加せず、なぜ効かなかったか分析
- `overlaps`: 部分的に存在。既存仕組みの強化候補
- `unique`: 新しいCandidate

既存ルールがあったのに破った場合、文書追加より強い反映先への昇格を優先する。

## Step 5: 反映先

可能な限り上から選ぶ。

1. **Script / Code**: 機械的に実行・検知できる
2. **CI / Gate**: 違反時に次工程を止めたい
3. **Skill**: 複数stepの判断手順
4. **AGENTS.md Policy**: 全task共通の短い不変条件
5. **Runbook / Docs**: 低頻度の障害・環境固有操作
6. **Task Context**: 今回固有

**reminderよりenforcementを優先する。**

## Step 6: Candidate

`.loop/templates/learning-candidate.yaml` の形式を使う。

必須:

- trigger / event type
- observed problem
- evidence
- root cause
- generalized rule
- recurrence risk
- impact
- deterministic
- duplicate result
- proposed target / reason

## Step 7: 現在PRとの境界

ユーザーが現在task内での適用を明示していない恒久process改善は、原則として**現在の機能PRへ後付けしない**。Candidateとして記録し、必要なら次taskへ引き継ぐ。

ユーザーが現在PRへ含めるよう求めた場合は、Candidate記録や `not_applied` のままでは `learning_gate` を PASS にしない。観測可能な enforcement を同じ Delivery PR へ入れ、Merge-ready Evidenceが無効になるため必要な `REQUIREMENTS → ... → PR_AFTERCARE` を再実行する。

適用要求は chat 推測ではなく、recorded flag / CLI で渡す。

```bash
node scripts/check-loop-evidence.mjs --learning --user-requested-apply true --candidates-json '[{"applicationStatus":"applied","location":"scripts/check-loop-evidence.mjs"}]'
```

`--user-requested-apply false` のとき、未適用 Candidate は PASS する（既定の defer を維持する）。適用済み Candidate が混ざると FAIL する。

## Step 8: Human Gate

次の永続変更は原則として採用判断を経る。

- AGENTS.md変更
- Skill新設 / 大幅変更
- CI Gate追加・強化
- 自動化Script
- 高影響なprocess policy

## Step 9: Effectiveness Observation

採用したルールは後続taskで観測する。

- 同種Eventを早いGateで防げた → `effective`
- 同種Eventが再発 → `recurred`

再発時は `Task Context / Runbook → Skill → Script / CI Gate` のように強制力を上げる。

## 出力

```text
PROCESS_LEARNING
Status: PASS
Aftercare cycles reviewed:
Events reviewed:
Candidates:
  - trigger:
    root cause:
    generalized rule:
    duplicate status:
    proposed target:
    reason:
Human Gate required:
Existing rule effectiveness issues:
```

Candidateが無い場合:

```text
Candidates: none
Reason: no reusable process failure/correction observed
```

このGateを通った後、`TASK_TRANSITION` へ進む。
