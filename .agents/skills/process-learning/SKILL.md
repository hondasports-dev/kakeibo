---
name: process-learning
description: タスク完了前に人間の訂正、失敗、再試行、見落とし、Delivery漏れを振り返り、再利用可能なLearning Candidateと最適な反映先を作る。
---

# Process Learning

## 目的

個別タスクの失敗を「次は気をつける」で終わらせず、**次回のループそのものを改善する入力**へ変換する。

ただし、1回の出来事からAGENTS.mdやSkillを無制限に肥大化させない。まずCandidateとして評価する。

## 実行タイミング

- Delivery target到達後、DONE判定前に必ず実行
- Incident解消後は必ず対象に含める
- 人間から差し戻しがあった場合は必ず対象に含める

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
- `manual_check_repetition`: 人間が毎回同じ「本当に実行した？」確認をしている

## Step 1: Event抽出

タスク中の次をEvidenceとして見る。

- 人間の訂正・追加指示
- Gate FAIL / BLOCKED
- Incident
- Review findings
- CI / E2E failure
- 作業順序のやり直し
- 「追加した」vs「実行した」の食い違い
- PR作成後の不足

## Step 2: Root Cause

症状ではなく、**なぜ現行プロセスで防げなかったか**まで分析する。

```text
Observed problem:
Immediate cause:
Process cause:
Why existing gate/skill did not catch it:
What condition would detect/prevent it earlier:
```

例:

- NG: `E2Eが失敗した`
- Better: `E2E必須変更なのに、環境同期成功をVerificationの前提Gateとして強制していなかった`

## Step 3: Generalize

そのIssue固有の名前を外して、再利用可能な条件にする。

良いgeneralized rule:

- `required test added != required test executed and passed`
- `shared auth/provider changes require caller impact scan before edit`
- `delivery completion requires PR existence and required checks, not push success`

悪いgeneralized rule:

- `Issue #NNでは○○を忘れない`
- `次回は注意する`

## Step 4: Duplicate Check

次を検索する。

- `AGENTS.md`
- `.agents/skills/**`
- `.loop/process.yaml`
- `scripts/**`
- `.github/workflows/**`
- 関連runbook/docs

判定:

- `duplicate`: 既に同じ仕組みがある → 新規追加しない。なぜ既存仕組みが効かなかったかを分析
- `overlaps`: 部分的に存在 → 既存仕組みを強化候補
- `unique`: 新しいCandidate

既存ルールがあったのに破った場合、文書を増やすより**より強い反映先へ昇格**することを優先する。

## Step 5: 反映先を選ぶ

可能な限り上から選ぶ。

1. **Script / Code**
   - 機械的に実行・検知できる
   - 例: env preflight、変更file coverage、状態check
2. **CI / Gate**
   - 違反時に次工程を止めたい
   - 例: required test / lint / security scan
3. **Skill**
   - 複数stepの判断手順として再利用する
   - 例: Impact Analysis、Incident切り分け
4. **AGENTS.md Policy**
   - 全タスク共通の短い不変条件
   - 詳細手順は書かない
5. **Runbook / Docs**
   - 低頻度の障害・環境固有操作
6. **Task Context**
   - 今回固有で一般化不要

**reminderよりenforcementを優先する。**

## Step 6: Candidateを作る

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

Candidate作成のためだけに毎回ファイルをcommitする必要はない。永続化が必要と判断した場合に適切な場所へ保存する。

## Step 7: Human Gate

次の永続変更は、原則として人間の採用判断を経る。

- AGENTS.md変更
- Skill新設 / 大幅変更
- CI Gate追加・強化
- 自動修正Script
- destructive / production関連policy

Candidate提示時は「何が起きたか」だけでなく、**どの仕組みに昇格させれば再発防止できるか**を示す。

## Step 8: Effectiveness Observation

採用したルールは追加して終わりにしない。

後続タスクで:

- 同種EventがGateより前で防げた → `effective`
- 同種Eventが再発 → `recurred`

再発時の代表的な昇格:

```text
Task Context / Runbook
        ↓
      Skill
        ↓
    Script / CI Gate
```

使われない・重複したルールは統合・降格・削除対象にする。

## 出力

```text
PROCESS_LEARNING
Status: PASS
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

このGateを通って初めてDONE判定へ進む。