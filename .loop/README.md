# Loop Engineering Foundation v9

SuzumemoのAgent Loopは、すべての変更へ同じ重いGateを課す方式から、**Spec Confidence + Risk-based Profile** へ移行する。

正本:

- `AGENTS.md` — 実行契約の入口
- `.loop/process.yaml` — machine-readable state / profile / gate
- `skills/*/SKILL.md` — 手順
- `.loop/templates/task-state.yaml` — task evidence

## Design principle

```text
Cheap deterministic checks
        → always / broadly applied

Expensive reasoning / multi-agent checks
        → risk or learning event driven
```

品質をGate数で測らない。

## Intake

```text
TASK
 ↓
SPEC CONFIDENCE
 ├ C2 confirmed ─────┐
 ├ C1 reconstructed ─┤
 ├ C0 unclear ─→ Requirements Discovery
 └ C0 conflicted → Source Reconciliation / Human Gate
                      ↓
                 C1 / C2 only
                      ↓
                 RISK CLASSIFICATION
```

仕様が不明な時にRiskをHighへ上げて進めない。`C0` は実装禁止。

## Spec Confidence

- `C2`: 明示仕様・ACが明確でmaterial conflictなし
- `C1`: 不足を既存docs/tests/patternから一意に近く復元可能
- `C0 unclear`: 複数の妥当な成果物がある
- `C0 conflicted`: desired stateについてsourceが矛盾

Issueとcurrent implementationが違うだけではConflictとは限らない。Issueが明示的に「B→A」を要求するならexpected delta。

## Risk model

4軸を0..2で評価する。

1. Blast Radius
2. Data / Security
3. Reversibility
4. Uncertainty

- 0..2 → R1
- 3..4 → R2
- 5..8 → R3
- R0 / R4は明示condition

Security/data/schema/billing/external write等はR3 floor。production不可逆data操作、account deletion、secret rotation、DNS cutover等はR4。

## Profiles

### R0 TRIVIAL

```text
PREFLIGHT → MINIMAL PLAN → CHANGE → TARGETED CHECK → DELIVERY → AFTERCARE
```

高価なreviewは起動しない。

### R1 FAST

```text
PREFLIGHT
→ PLAN (Requirements + Impact)
→ IMPLEMENT
→ TARGETED VERIFY
→ REVIEW (Code + Security quick scan)
→ DELIVERY / AFTERCARE
```

通常の局所変更のデフォルト。

### R2 STANDARD

```text
PREFLIGHT
→ REQUIREMENTS
→ IMPACT
→ IMPLEMENT
→ VERIFY
→ CODE REVIEW + Security quick scan
→ DELIVERY / AFTERCARE
```

Requirements independent reviewは0が既定。C1、material uncertainty、cross-cutting等で1だけ起動する。

### R3 HIGH

```text
PREFLIGHT
→ REQUIREMENTS + independent review x2
→ IMPACT
→ IMPLEMENT
→ FULL VERIFY
→ CODE REVIEW
→ SECURITY REVIEW
→ DELIVERY / AFTERCARE
→ PROCESS LEARNING
```

### R4 CRITICAL

R3 + independent review x3 + post-synthesis review + Human Gate + rollback/recovery evidence。

## Process Learning

R0-R2はevent-driven。

Eventなし:

```text
Events: none
Candidates: none
```

だけで閉じる。

full analysis trigger:

- human correction
- Gate / CI / E2E failure
- actionable review finding
- retry / incident
- scope / impact / delivery / transition miss
- R3 / R4

## Delivery is not simplified away

Risk-basedにしても、PR作成後に止まる問題は再導入しない。

```text
DELIVERY
  ↓
PR_AFTERCARE latest head
  ├ required CI
  ├ actionable review
  ├ requested changes
  ├ approval
  └ mergeability
  ↓
merge_ready
```

AftercareとTask Transitionは主にstate/evidence確認であり、高価な独立LLM reviewとして扱わない。

## Risk changes during work

initial Riskは暫定。

- 影響を発見したら即時昇格
- downgradeは実装前にEvidence付きのみ
- 実装開始後はmax observed riskをcompletion floorにする

これにより、低リスクとして開始して途中でauth/data/shared impactが判明したtaskを軽いprofileのまま完了させない。
