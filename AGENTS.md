# Suzumemo Agent Loop

このファイルは、このリポジトリで変更を伴う作業を進めるための**ループの入口と実行契約**である。
詳細な実行手順は `.agents/skills/**/SKILL.md`、状態遷移の正本は `.loop/process.yaml` とする。

## 基本原則

- 「やった」という主張ではなく、実行結果・差分・PR・CIなどの **Evidence** で Gate を判定する。
- 必須 Gate が `FAIL` / `BLOCKED` のまま次工程へ進まない。
- テストを追加したことと、テストを実行して成功したことを分ける。
- 変更前に影響範囲を調べ、変更後に独立したコードレビューとセキュリティレビューを行う。
- PR作成だけで完了扱いにせず、要求された範囲の CI / review / merge-ready / merge / 後始末まで Delivery に含める。
- 人間の訂正、失敗、再試行、見落としを Process Learning の入力にする。
- `roles/` は使わない。モデルや担当ロールではなく、状態・Skill・Gate・Evidenceでループを制御する。

## 必須ループ

リポジトリの変更を伴うタスクは、原則として次の順序で進める。

```text
REQUIREMENTS
    ↓
IMPACT_ANALYSIS
    ↓
IMPLEMENTATION
    ↓
VERIFICATION
    ↓
CODE_REVIEW
    ↓
SECURITY_REVIEW
    ↓
DELIVERY
    ↓
PROCESS_LEARNING
    ↓
DONE
```

どの工程でも失敗・実行不能・同じ失敗の反復が発生した場合は `INCIDENT` へ入り、原因を特定してから失敗した Gate へ戻る。

## 各工程と Skill

| 状態 | 必須 Skill | 目的 |
| --- | --- | --- |
| `REQUIREMENTS` | `.agents/skills/requirements/SKILL.md` | 要求・Issue・既存実装を統合し、仕様・受け入れ条件・やらないことを確定する |
| `IMPACT_ANALYSIS` | `.agents/skills/impact-analysis/SKILL.md` | caller/callee、共有状態、認証・認可、データ、テスト、デプロイ影響を調べる |
| `IMPLEMENTATION` | `.agents/skills/implementation/SKILL.md` | 確定した仕様と影響範囲内で最小差分を実装する |
| `VERIFICATION` | `.agents/skills/verification/SKILL.md` | unit/integration/coverage/E2E/build/browser確認をEvidence付きで実行する |
| `CODE_REVIEW` | `.agents/skills/code-review/SKILL.md` | 正しさ、回帰、保守性、テスト妥当性を独立観点でレビューする |
| `SECURITY_REVIEW` | `.agents/skills/security-review/SKILL.md` | 認証、認可、データ境界、入力、secret、外部サービスなどを独立レビューする |
| `INCIDENT` | `.agents/skills/incident/SKILL.md` | 失敗を止め、事実→仮説→Root Cause→修正→再Gateを行う |
| `DELIVERY` | `.agents/skills/delivery/SKILL.md` | commit、push、PR、CI、レビュー対応、merge-ready、merge、後始末を管理する |
| `PROCESS_LEARNING` | `.agents/skills/process-learning/SKILL.md` | 人間の訂正や失敗からLearning Candidateを抽出し、反映先を提案する |

**各状態へ入る前に対応する Skill を読むこと。** Skillを読まずに経験則だけで工程を代替しない。

## Gate と戻り先

### REQUIREMENTS FAIL

仕様・受け入れ条件に成果物を左右する曖昧さが残る場合は実装へ進まない。既存コード・Issue・docsで解消できなければ Human Gate へ戻す。

### IMPACT_ANALYSIS FAIL

影響範囲が不明なまま実装へ進まない。特に認証・認可・共有状態・データ移行・既存利用箇所の不明点は解消する。

### VERIFICATION FAIL

`INCIDENT` で原因を切り分ける。実装不備なら `IMPLEMENTATION` へ戻り、修正後に `VERIFICATION` を最初から再実行する。

### CODE_REVIEW FAIL

`IMPLEMENTATION → VERIFICATION → CODE_REVIEW` を再実行する。レビュー修正だけ入れて検証を飛ばさない。

### SECURITY_REVIEW FAIL

`IMPLEMENTATION → VERIFICATION → CODE_REVIEW → SECURITY_REVIEW` を再実行する。

### DELIVERY FAIL

- CI / E2E / reviewでコード修正が必要: `IMPLEMENTATION` へ戻す。
- 環境、競合、認証、外部サービス等の問題: `INCIDENT` へ入る。
- approval待ちなど人間しか解消できない: `BLOCKED` とし、完了扱いにしない。

## Evidence First

各 Gate には、少なくとも次のいずれかのEvidenceを残す。

- 読んだIssue / docs / 関連実装と、そこから確定した判断
- 変更ファイル・diff・影響範囲
- 実行したコマンドと終了結果
- テスト名・件数・coverage結果
- browser / runtime確認結果
- Review findings と closure 状態
- PR URL、CI checks、review、merge状態

`未実行だが通るはず`、`追加したのでOK`、`CIに任せる` は Evidence ではない。

## Human Gate

人間への確認を使うのは主に次の場合とする。

- ユーザー価値・データ保持・認可・課金など、複数の妥当な仕様から選択が必要
- production、secret、billing、domain、不可逆操作など高リスクな変更
- 必要approvalなど自動解消できないブロッカー
- Learning Candidateを永続ルール・Skill・Script・CIへ昇格させる判断

既存規約・コードから一意に決められる細部まで毎回質問しない。

## Process Learning

タスク終了前に必ずLearning Eventを確認する。

対象例:

- 人間からの訂正・差し戻し
- Agentが完了報告した後に不足が発見された
- 同じ失敗を繰り返した
- 変更影響を見落とした
- 必須テストを追加しただけで実行しなかった
- PR / CI / merge / cleanupの工程を飛ばした
- 障害やCI失敗の原因が再利用可能な知識になった

Learning Candidateは即座にAGENTS.mdへ追記しない。`.agents/skills/process-learning/SKILL.md` に従い、`Script → CI/Gate → Skill → AGENTS.mdの短いPolicy → Runbook → Task Context` の順で最も強制力の高い反映先を検討する。

## DONE条件

次をすべて満たすまで `DONE` と報告しない。

- 仕様とAcceptance Criteriaが確定している
- Impact Analysisが完了している
- 実装が仕様・scope内である
- 必須Verificationが実行済みかつPASS
- Code ReviewがPASS
- Security ReviewがPASSまたは明確に`not_required`で根拠がある
- 要求されたDelivery範囲が完了している
- 必須BLOCKED項目が残っていない
- Learning Eventを評価し、Candidateを記録したか `none` と明示できる

読み取り・調査だけの依頼では、変更後工程を無理に実行せず、該当するSkillとGateだけを使う。