---
name: process-learning
description: Learning Eventが実際に発生したtaskだけ、成果物の問題とループ中の無駄・誤判断を振り返り、再利用可能な改善候補へ変換する。Risk R3/R4だけを理由に起動しない。
license: Apache-2.0
---

# Process Learning

## 完全event-driven

次のEventが1つ以上ある時だけ起動する。

- human correction
- unexpected Gate / CI / E2E failure
- actionable review finding
- repeated retry / Incident
- scope / impact miss
- delivery / aftercare miss
- process rule / enforcement不足が明確になった

Risk R3/R4という理由だけでは起動しない。

Eventなし:

```text
Learning event: none
Status: NOT_REQUIRED
```

で十分。

## 分析

```text
Observed problem:
Immediate cause:
Process cause:
Why existing enforcement did not catch it:
Earlier detection / prevention:
Reusable rule:
```

## ループ効率・判断品質の振り返り

Learning Event が発生したtaskでは、成果物の原因分析に加えて、実行したループ自体を短く振り返る。目的は次の3点だけとする。

- context window使用量の削減
- 必須品質を維持したloop所要時間の短縮
- 判断・scope・verification・delivery精度の向上

新たに全ログや会話を読み直さない。task-state、Finding、Verification evidence、既に得たtool結果など、現在contextにある証跡だけを使う。

原則として影響の大きいものを最大3件まで抽出する。

- **無駄な判断・行動**: 結果に寄与しなかった再読込、重複検証、早すぎるSkill/tool/agent起動、不要なfull rerun、細かすぎる逐次poll、scope外探索
- **間違った判断**: 誤った前提・scope・Risk・Control・コマンド・検証範囲・Delivery判定と、修正が遅れた判断
- **維持すべき判断**: context・時間・リスクを実際に減らした再利用可能な判断。改善で削らないため、必要な場合だけ記録する

各所見は hindsight だけで言えるものと、当時の証拠から回避可能だったものを区別する。回避可能だった所見だけを改善候補にする。

改善は「手順を追加する」より先に、削除・統合・遅延ロード・順序変更・evidence再利用・cheap deterministic checkを検討する。品質GateやRequired Controlを速度のために弱めない。

各改善候補には、次回から何を変えるかと、次のどれを改善するかを明示する。

- `context`: 読み込む情報・保持する状態・重複説明を減らす
- `speed`: tool round-trip、待機、重複実行、手戻りを減らす
- `precision`: 誤判定、scope miss、test gap、false completionを減らす

細かな試行錯誤、既に自動テストで閉じたtask固有の修正、再利用性のない好みは候補にしない。改善候補がなければ `none` とする。

## Target priority

1. Script / code
2. CI / deterministic enforcement
3. Skill
4. AGENTS.mdの短いpolicy
5. Runbook/docs

既存ruleを破っただけなら、文章追加よりenforcement改善を優先する。

## Result persistence

再利用可能な候補を会話上の報告だけで完了させない。候補ごとに次を記録する。

- observed problem / process cause
- reusable rule
- `context` / `speed` / `precision` の改善軸
- proposed target
- disposition
- evidence

dispositionは次のいずれかとする。

- `applied`: loop artifactへ反映済み。locationとverification evidenceを必須とする
- `follow_up`: current task scope外。永続的なIssue / task / PRのtype・reference、target、rationaleを必須とする
- `no_change`: 既存enforcementで充足済み、または再利用不能。rationaleとevidenceを必須とする

候補があるのにdispositionが`pending`、または会話上の提案だけで永続的な反映先が無い場合、Process LearningはPASSではない。

task-stateの`learning` record全体を判定する。`event: none`の場合だけ`status: not_required`と空の`candidates`を許可する。Eventがある場合は`status: pass`と`candidates`配列を明示し、欠落・未知shape・空白だけのevidenceをfail-closedに扱う。

## Scope

Learningで見つけた改善がcurrent task scope外なら同じPRへ混ぜない。

ユーザーが同PRへの反映を明示した場合のみ実装し、全候補を`applied`にして変更deltaに必要なVerification/Review/Aftercareを行う。

## 出力

```text
PROCESS LEARNING
Status: PASS | NOT_REQUIRED
Events:
Loop retrospective:
  Unnecessary decisions/actions:
  Incorrect decisions:
  Decisions to retain:
  Next-loop adjustments:
Candidates:
  Observed problem:
  Process cause:
  Reusable rule:
  Improvement axes:
  Proposed target:
  Disposition:
  Location / persistent follow-up:
  Verification evidence:
Evidence:
```
