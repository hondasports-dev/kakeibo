# Suzumemo Agent Loop

このファイルは、このリポジトリで作業するAgentの**実行契約の入口**である。

- Plugin manifest: `plugin.json`
- Skill root: `skills/`
- 状態・profile・Gateの正本: `.loop/process.yaml`
- 各工程の手順: `skills/*/SKILL.md`

## 基本方針

品質を守るために全taskへ同じ重いGateを課さない。

> **安い deterministic Gate は常時、高価な reasoning / multi-agent Gate は risk と event で起動する。**

- EvidenceなしでGateをPASSにしない。
- 必須Gateが `FAIL` / `BLOCKED` のまま進まない。
- `PR created` はcheckpointでありtask completionではない。
- PR公開後は最新headが要求されたDelivery targetへ収束するまで `PR_AFTERCARE` を続ける。
- `roles/` やmodel/effort固定ではなく、state / Skill / Gate / Evidenceで制御する。

## 常時必須Skill

すべてのtaskで先に次を適用する。

1. `skills/prompt-injection-guard/SKILL.md`
2. `skills/service-ops-safety/SKILL.md`

これらは独立した高価なレビュー工程ではなく、全工程に重なる安全Policyである。

## User instruction reconciliation

現在のユーザー指示を最優先する。過去のIssue、plan、summary、review結果と矛盾した場合は現在指示へ再束縛する。

- read-only依頼を勝手にwrite taskへ拡張しない。
- 「docs only」「これだけ」「PR作成まで」等のscope / stop条件を尊重する。
- scope外の改善案は勝手に実装せずfollow-up候補へ分離する。

## Session / Task invariant

通常は次を守る。

```text
1 session = 1 current task
1 current task = 1 task branch / worktree
1 current task = at most 1 Delivery PR
```

- Aftercareがterminalになる前に別taskのDelivery PRを作らない。
- 同一taskの修正は同じbranch / PRへ積む。
- 次taskへ移る前に `TASK_TRANSITION` でtask identityを閉じる。

---

# 1. Spec Confidenceを先に判定する

Risk Levelの前に、**何を作るべきかの確度**を判定する。仕様不明をRisk上昇だけで処理しない。

| Level | 意味 | 実装可否 |
| --- | --- | --- |
| `C2 confirmed` | 目的・期待結果・ACが明確で、主要な正本と矛盾しない | Risk判定へ進む |
| `C1 reconstructed` | Issueは不足するが、正本docs・既存pattern・tests等から成果物をほぼ一意に補完できる | Risk判定へ進む |
| `C0 unclear` | 複数の妥当な仕様があり、選択で成果物が materially 変わる | 実装禁止。Requirements Discoveryへ |
| `C0 conflicted` | 望ましい最終状態について有力な仕様source同士が矛盾する | 実装禁止。Source reconciliationへ |

## Issueがぼんやりしている場合

`C0` から開始し、次を確認して仕様を復元する。

1. 現在のユーザー指示
2. 明示的に承認された最新仕様 / ADR / decision
3. 現在taskのIssue・コメント
4. canonical docs
5. tests
6. current implementation / existing pattern

局所的な命名・既存patternなど一意に補完できるものは `C1` として自律判断してよい。
ユーザー価値、データ保持、認可、課金、破壊的操作など成果物を変える選択が残る場合は `C0` のままHuman Gateへ送る。

## 「Issueの仕様」と調査結果がズレる場合

まず「意図された変更」と「仕様衝突」を区別する。

- Issueが `現在BだがAへ変更する` と明示している → 既存実装Bとのズレは**expected delta**でありConflictではない。
- IssueがAを望む一方、現在ユーザー指示や最新承認仕様がBを望む → **Spec Conflict**。
- IssueがAだがdocs/tests/implementationがBで、Issueが意図的変更かstaleか判断できない → `C0 conflicted`。

解消できるauthoritative evidenceがあれば `C1/C2` へ上げる。成果物が変わるのに解消できなければHuman Gateで止める。

---

# 2. Risk Levelを判定する

Spec Confidenceが `C1` または `C2` になった後にRiskを確定する。

Riskは変更行数ではなく次の4軸で見る。各軸 `0..2`。

| 軸 | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Blast Radius | 局所 | 複数surface | system-wide / shared foundation |
| Data / Security | なし | 間接影響 | auth/data/security境界を直接変更 |
| Reversibility | 容易 | rollbackに手順必要 | rollback困難 / data・外部状態を伴う |
| Uncertainty | 既知pattern | 一部不確実 | 新規技術・caller不明・影響不明 |

Scoreの目安:

- `0..2` → `R1 low`
- `3..4` → `R2 medium`
- `5..8` → `R3 high`

`R0 trivial` と `R4 critical` はscoreではなく明示条件で決める。

## 強制floor

次を含む場合、scoreが低くても原則 `R3+`。

- authentication / authorization
- tenant / group / data boundary
- schema / migration
- data deletion / retention
- billing / payment logic
- secret / privileged env
- webhook / external service write
- production behaviorを直接変える設定

次は原則 `R4 critical`。

- production DB migration
- bulk / irreversible data mutation
- account deletion semantics
- authorization modelの全面変更
- billing settlement等の金銭整合性
- production secret rotation
- production DNS / domain切替

process policy変更は一律Highにしない。通常は影響範囲で `R2` 判定し、安全境界・Delivery完了条件・production/destructive policyを変更する場合は `R3+` とする。

## Initial / Confirmed Risk

最初のRiskは暫定でよい。Requirements / Impactで新しい影響を発見したら即時昇格する。

- Risk上昇: 発見時点で即時。
- Risk低下: 実装前にEvidence付きでのみ許可。
- 実装開始後は、そのtaskで観測した最大Riskをcompletion profileのfloorとする。

---

# 3. Risk-based Loop Profiles

## R0 — TRIVIAL

対象: typo、純粋な文書、format、runtime behaviorを変えない極小変更。

```text
WORKSPACE_PREFLIGHT (明示例外可)
→ MINIMAL PLAN
→ CHANGE
→ TARGETED CHECK
→ DELIVERY
→ PR_AFTERCARE
→ TASK_TRANSITION
```

- independent Requirements Review: 0
- separate Impact Gate: 不要
- separate Code Review: 不要
- separate Security Review: 不要
- Process Learning: Learning Eventがある時だけ

## R1 — FAST（通常のデフォルト）

局所的・可逆・security/data境界なし・不確実性が低い変更。

```text
WORKSPACE_PREFLIGHT
→ PLAN (Requirements + Impact)
→ IMPLEMENTATION
→ TARGETED_VERIFICATION
→ REVIEW (Code + Security quick scan)
→ DELIVERY
→ PR_AFTERCARE
→ conditional PROCESS_LEARNING
→ TASK_TRANSITION
```

- independent Requirements Review: 0
- ImpactはRequirements packet内のsummaryで済ませる
- local verificationはchanged tests / 必要なlint/build/E2Eに限定
- SecurityはCode Review内のquick scan

## R2 — STANDARD

複数surface、shared component/hook、通常のAPI/Convex contract変更等。

```text
WORKSPACE_PREFLIGHT
→ REQUIREMENTS
→ IMPACT_ANALYSIS
→ IMPLEMENTATION
→ VERIFICATION
→ CODE_REVIEW + Security quick scan
→ DELIVERY
→ PR_AFTERCARE
→ conditional PROCESS_LEARNING
→ TASK_TRANSITION
```

- independent Requirements Review: **0が既定**
- `C1`、uncertaintyあり、cross-cutting、またはMainがmaterial ambiguityを検出した時だけ1 review
- post-synthesis reviewは原則不要
- separate Security Reviewはsecurity floor triggerが無い限り不要

## R3 — HIGH

security/data境界、高Blast Radius、migration、外部write等。

```text
WORKSPACE_PREFLIGHT
→ REQUIREMENTS + independent reviews ×2
→ IMPACT_ANALYSIS
→ IMPLEMENTATION
→ FULL VERIFICATION
→ CODE_REVIEW
→ SECURITY_REVIEW
→ DELIVERY
→ PR_AFTERCARE
→ PROCESS_LEARNING
→ TASK_TRANSITION
```

- independent Requirements Review: 2
- security review: 独立Gate
- coverage / E2E / runtime確認はAcceptance Criteriaと影響範囲からfull profileを構成

## R4 — CRITICAL

production不可逆操作、重大なdata/auth/billing境界変更。

R3に加えて:

- independent Requirements Review: 3
- post-synthesis review: 1
- Human Gate: 実装開始前
- Human Gate: production / irreversible operation直前
- rollback / recovery Evidence必須

---

# 4. Gate cost policy

次は安いため原則常時維持する。

- Workspace Preflight
- scoped lint / tests / build等のdeterministic check
- PR identity / latest head確認
- required CI / review thread / mergeabilityのPR Aftercare
- Task Transitionのtask identity closure

次は高価なためprofile / eventで起動する。

- multi-agent Requirements Review
- post-synthesis review
- full Impact Analysis
- full Security Review
- full Process Learning

Gate数を増やすことを安全性と同一視しない。

---

# 5. Process Learningはevent-driven

`R0-R2` は次のLearning Eventが無ければ `none` を記録して終了する。

- human correction
- Gate / CI / E2E failure
- actionable review finding
- retry / incident
- scope / impact miss
- delivery / aftercare / task-transition miss

`R3/R4`、または上記Eventありの場合だけ `skills/process-learning/SKILL.md` のfull analysisを行う。

---

# 6. Delivery / Aftercare

Riskに関係なく、通常のDelivery targetは `merge_ready`。

```text
DELIVERY
  publish / update existing PR
      ↓
PR_AFTERCARE
  latest head
  required CI
  actionable review findings
  requested changes
  approval
  conflict / mergeability
      ↓
merge_ready
```

コード修正が必要なら、**同じPR**で選択profileに必要なVerification / Reviewを再実行する。headが変わったら古いsuccessを流用しない。

ユーザーが明示的に「PR作成までで止めて」と指定した場合だけAftercareを `NOT_REQUIRED` にできる。

---

# 7. DONE条件

変更taskをDONEにするには最低限:

- Spec Confidenceが `C1/C2`
- Risk Level / profileが記録済み
- profileで必須のGateがPASS / 根拠付きNOT_REQUIRED
- Delivery target到達済み
- required Aftercareがterminal
- Learning Eventを判定済み（none可）
- Task Transition完了
- unresolved required blockerなし

`C0`、pending required CI、未解決requested changes、Human Gate待ちはDONEではない。
