# 市場調査から開発までのワークフロー v8

## 目的

アプリ案が曖昧な状態では市場調査と壁打ちに集中し、ユーザーがGoを出した後だけ開発へ移る。開発フェーズでは、すべての変更へ同じ重いGateを課さず、`AGENTS.md` / `.loop/process.yaml` の **Spec Confidence + Risk-based Profile** を使う。

## 正本

- Agent Loop入口: `AGENTS.md`
- state / risk / profile: `.loop/process.yaml`
- 各工程: `skills/*/SKILL.md`

このworkflowが正本と矛盾する場合は上記を優先する。

## 原則

- 市場調査フェーズでは実装しない。
- ユーザーが明示的にGoを出すまで開発Agentを起動しない。
- 調査結果は「作る」「保留」「避ける」に分ける。
- Go後はMVP範囲と作らない機能を固定する。
- 高価なmulti-agent reviewは常時起動せず、Risk/Profileが要求するときだけ使う。
- 同一差分のwriterは原則1体。

---

# フェーズ1: 市場調査と壁打ち

入力:

- ユーザーの関心領域
- 作りたいアプリの方向性
- 技術、予算、期間、個人開発かチーム開発か

実施内容:

- 市場、競合、ユーザー課題、収益化、参入余地を調査する。
- アプリ候補を複数出す。
- 痛みの強さ、頻度、支払い意欲、競争、実装難易度、集客しやすさで比較する。
- 最初に作る候補を1つ推奨する。

出力:

- 候補一覧
- 推奨案 / 推奨理由
- 代替案
- 避けるべき案
- 未確認リスク
- 次にユーザーが決めること

禁止:

- コードを書く
- 技術設計へ進む
- 実装・QA・Reviewを開始する

## Go / No-Go

開発へ進む条件:

- ユーザーが「この案で進める」「これを作る」「Go」等で明示承認
- MVP範囲が概ね決定
- 作らない機能が明確

承認が無ければ追加調査 / 壁打ちへ戻る。

市場調査上の不確実性を、そのまま変更Riskへ読み替えない。Go後に実装仕様の確度を改めて判定する。

---

# フェーズ2: Spec Confidence

開発開始時に `skills/requirements/SKILL.md` に従い、何を作るべきかを判定する。

- `C2 confirmed`: 仕様・ACが明確、material conflictなし
- `C1 reconstructed`: 不足をcanonical docs / tests / existing patternからほぼ一意に補完可能
- `C0 unclear`: 複数の妥当な成果物がある
- `C0 conflicted`: desired stateについて有力sourceが矛盾

`C0` のまま設計・実装へ進まない。

Issueと既存実装が異なっていても、Issueが「現在BをAへ変更する」と明示しているならexpected deltaでありConflictではない。

解消不能なmaterial choice / conflictはHuman Gateへ送る。

---

# フェーズ3: Risk Classification / Requirements

Spec ConfidenceがC1/C2になった後にRiskを確定する。

4軸:

1. Blast Radius
2. Data / Security
3. Reversibility
4. Uncertainty

各0..2点。目安:

- 0..2 → R1
- 3..4 → R2
- 5..8 → R3

R0 / R4は明示condition。

### R3 floor

- authn / authz
- tenant / group / data boundary
- schema / migration
- data deletion / retention
- billing / payment
- privileged secret / env
- webhook / external service write
- production behavior config

### R4 critical

- production DB migration
- bulk / irreversible data mutation
- account deletion semantics
- authorization model overhaul
- financial settlement integrity
- production secret rotation
- production DNS / domain cutover

## Requirements review人数

| Risk | independent Requirements review | post-synthesis review |
| --- | ---: | ---: |
| R0 | 0 | 0 |
| R1 | 0 | 0 |
| R2 | 0 default / 条件付き1 | 0 |
| R3 | 2 | 0 |
| R4 | 3 | 1 |

R2で1 reviewを起動する条件:

- C1
- material uncertainty
- cross-cutting change
- Mainがmaterial ambiguityを検出

低Riskへreview人数だけ追加して安心感を作らない。新しい事実がRisk上昇を示すならprofile自体を上げる。

出力:

- Spec Confidence
- Goal / MVP scope / Out of scope / Preserve
- Acceptance Criteria
- Test Strategy
- Risk axes / score / floor trigger
- Risk Level / selected profile

---

# フェーズ4: 技術設計 / Impact

### R0 / R1

別Impact Gateは原則起動しない。Requirements packetのimpact summaryへ:

- direct change
- shared surface
- auth/data boundary
- external/deployment
- regression tests

を記録する。

### R2–R4

`skills/impact-analysis/SKILL.md` を独立Gateとして実行する。

- caller / callee
- shared state
- auth / data / schema
- affected user flow
- tests
- external / deploy
- rollback / recovery

新しい影響を発見したらRiskを即時昇格する。

---

# フェーズ5: 実装

MainがImplementation Handoffを固定し、原則1 writerへ渡す。

Handoff:

- Spec Confidence
- Risk / Profile
- Acceptance Criteria
- editable scope
- impact summary / Impact Analysis
- required Verification

Issue本文だけをwriterへの仕様にしない。

実装中にmaterial ambiguityやR3/R4 triggerを発見したらRequirements / Impactへ戻る。

---

# フェーズ6: Verification / QA / Review

## R0 TRIVIAL

- targeted static check
- separate Code / Security Reviewは原則不要

## R1 FAST

- changed tests
- 必要なlint / build / representative E2E
- 1回のCode ReviewでSecurity quick scanも実施

## R2 STANDARD

- affected scopeのtests / coverage / E2E
- Code Review + Security quick scan
- quick scanでauth/data/secret/external/destructive triggerを発見したらR3へ昇格

## R3 HIGH

- full affected-scope Verification
- Code Review
- Security Reviewを独立Gate化

## R4 CRITICAL

R3に加えて:

- rollback / recovery Evidence
- implementation前Human Gate
- production / irreversible operation直前Human Gate

E2Eはユーザー導線や複数層を跨ぐAcceptance Criteriaの証明に必要な場合だけ使う。全テスト・全coverageをローカルとCIで無条件に二重実行しない。

---

# フェーズ7: 修正ループ

- spec漏れ / conflict → Requirements
- impact拡大 → Risk再分類
- code/test defect → Implementation → profile-required Verification / Review
- security floor trigger → R3+
- unknown / repeated failure → Incident
- human-only high-impact step → Human Gate

修正後にheadが変わったら旧headのEvidenceを流用しない。

---

# フェーズ8: Delivery / PR Aftercare

PR作成はcheckpoint。

```text
DELIVERY
  ↓
PR_AFTERCARE
  latest head
  ├ required CI
  ├ actionable review findings
  ├ requested changes
  ├ approval
  └ conflict / mergeability
  ↓
merge_ready
```

同一taskの修正は同じbranch / PRへ積む。

ユーザーが明示的に「PR作成までで止めて」と指定した場合だけAftercareを省略できる。

---

# フェーズ9: Process Learning / Task Transition

R0–R2はevent-driven。

Learning Eventが無ければ:

```text
Events: none
Candidates: none
```

で閉じる。

full Process Learning:

- R3 / R4
- human correction
- Gate / CI / E2E failure
- actionable review finding
- retry / Incident
- scope / impact / delivery / transition miss

最後にTask Transitionでcurrent taskを閉じ、前taskのIssue / PR / CI contextを次taskへ暗黙に持ち越さない。

---

# リリース準備

merge後またはrelease対象が確定した時点で必要に応じて:

- リリースノート
- deploy手順
- release前後check
- rollback方針
- residual risk

をまとめる。

## Coordinator rules

- 市場調査の不確実性と実装仕様の不確実性を分ける。
- C0で実装へ進まない。
- Riskは変更量ではなく影響で決める。
- 必要なAgentだけを使う。
- multi-agent reviewを常時起動しない。
- Riskが途中で上がったら即時profileを切り替える。
- PR作成でsessionを終了せず、required Aftercareまで同じtaskを保持する。
