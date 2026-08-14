# 市場調査から開発までのワークフロー v8

## 目的

市場調査・壁打ちから実装へ移る際に、仕様確度と変更リスクに応じて必要な工程だけを使う。

正本は `AGENTS.md`、`.loop/process.yaml`、`skills/*/SKILL.md`。

## フェーズ1: 市場調査と壁打ち

ユーザーが明示的にGoを出すまでは実装しない。

出力:

- 候補
- 推奨案
- 代替案
- 未確認リスク
- MVP候補
- 作らない機能

## Go / No-Go

開発へ進む条件:

- ユーザーが案を明示承認
- MVP範囲が概ね決定
- 作らない機能が明確

Go前の市場不確実性を、開発Risk Levelへそのまま持ち込まない。

## フェーズ2: Spec Confidence

Go後、実装前に次を判定する。

- `C2 confirmed`
- `C1 reconstructed`
- `C0 unclear`
- `C0 conflicted`

C0ならRequirements Discovery / Source reconciliationへ進み、解消しなければHuman Gate。

Issueや企画メモが曖昧でも、既存docs/tests/patternから一意に近く補完できるならC1としてよい。成果物を変える選択は勝手に補完しない。

## フェーズ3: Risk Classification

4軸:

- Blast Radius
- Data / Security
- Reversibility
- Uncertainty

Risk Level:

- R0 trivial
- R1 low / FAST
- R2 medium / STANDARD
- R3 high
- R4 critical

Auth/authz、tenant/data boundary、schema/migration、billing、secret、external write等はR3 floor。
Production不可逆操作等はR4。

## フェーズ4: Requirements / Design

Profileに応じて使うreviewを変える。

| Risk | independent Requirements review | post-synthesis |
| --- | ---: | ---: |
| R0 | 0 | 0 |
| R1 | 0 | 0 |
| R2 | 0 default / 条件付き1 | 0 |
| R3 | 2 | 0 |
| R4 | 3 | 1 |

R2の1 review trigger:

- C1
- material uncertainty
- cross-cutting change
- Mainがmaterial ambiguityを検出

低Riskへレビュー人数を追加して安心感を作るのではなく、事実がRisk上昇を示すならprofile自体を上げる。

## フェーズ5: Implementation

Mainが次を固定してwriterへ渡す。

- Spec Confidence
- Risk/Profile
- Acceptance Criteria
- editable scope
- impact
- verification requirements

writerは原則1体。

## フェーズ6: Verification / Review

### R0

Targeted checkのみ。

### R1

- changed tests
- 必要なlint/build/E2E
- Code + Security quick scanを1 reviewで実施

### R2

- affected scope verification
- Code Review + Security quick scan
- floor trigger発見時はR3へ昇格

### R3/R4

- full affected-scope verification
- independent Code Review
- independent Security Review

R4はrollback/recovery EvidenceとHuman Gateも要求する。

## フェーズ7: Delivery

Riskに関係なくPR作成で止めない。

```text
DELIVERY
→ PR_AFTERCARE
→ merge_ready
```

Aftercareはlatest headのCI、review findings、requested changes、approval、conflict、mergeabilityを確認する。

## フェーズ8: Learning / Transition

R0-R2でLearning Eventが無ければfast none path。
R3/R4またはfailure / correction / review finding等があればfull Process Learning。

最後にTask Transitionでcurrent taskを閉じる。

## Coordinator rules

- 市場調査の不確実性と実装仕様の不確実性を分ける。
- C0で実装へ進まない。
- Riskは変更量ではなく影響で決める。
- 必要なAgentだけを使う。
- multi-agent reviewを常時起動しない。
- Riskが途中で上がったら即時profileを切り替える。
