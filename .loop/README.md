# Loop Engineering Foundation

このディレクトリは、エージェントごとの役割や固定プロンプトではなく、タスクを安全に前進させるための**状態・Gate・Evidence・学習**を正本として管理する。

## 目的

- 「実装した」ではなく「検証できた」を完了条件にする
- 失敗時に作業を先へ進めず、失敗したGateへ戻す
- 人間の差し戻しをプロセス改善の入力として扱う
- 学習結果を無条件に文書へ追加せず、最も強制力の高い反映先を選ぶ
- Agent固有のroles / skillsを先に固定せず、実際の作業ログから必要な仕組みを育てる

## Main Loop

```text
INTAKE
  ↓
DISCOVER
  ↓
SPECIFY
  ↓
IMPACT_ANALYSIS
  ↓
IMPLEMENT
  ↓
VERIFY
  ↓
REVIEW
  ↓
DELIVER
  ↓
POST_CHECK
  ↓
LEARN
  ↓
DONE
```

### 1. INTAKE

要求、Issue、制約、完了条件を受け取る。

### 2. DISCOVER

既存コード、関連ドキュメント、依存関係、現在のGit/CI状態を調査する。推測だけで設計・実装へ進まない。

### 3. SPECIFY

要求を実装可能な仕様へ収束させる。曖昧さや選択肢が成果物へ大きく影響する場合のみHuman Gateを使う。

### 4. IMPACT_ANALYSIS

変更対象だけでなく、呼び出し元、呼び出し先、共有状態、認証・認可境界、既存テスト、デプロイ影響を確認する。

### 5. IMPLEMENT

確定した仕様と影響範囲に基づいて最小差分を実装する。

### 6. VERIFY

必要な静的解析、unit/integration/E2E、coverage、build等を実行する。テスト追加とテスト成功は別状態として扱う。

### 7. REVIEW

差分を独立した観点で再確認する。機能、回帰、セキュリティ、データ境界、テスト不足を確認し、指摘があればIMPLEMENTへ戻す。

### 8. DELIVER

commit / push / PR / CI / review / mergeable 等、タスクで必要な配送状態を確認する。途中状態をDONEとして扱わない。

### 9. POST_CHECK

統合後または対象環境で、期待した状態になっていることを確認する。

### 10. LEARN

人間の訂正、失敗、再試行、障害、見落としをLearning Candidateとして抽出する。

## Evidence First

各Gateは主張ではなくEvidenceで判定する。

```text
Claim
  ↓
Evidence
  ↓
Gate判定
  ├─ FAIL / BLOCKED → 原因調査へ
  └─ PASS → 次状態へ
```

例:

- 「テストを書いた」だけではVERIFY PASSにしない
- 実行コマンドと結果が必要
- 「CIは通るはず」ではDELIVER PASSにしない
- PR、check、merge状態を実データで確認する

## Failure / Incident Loop

どの状態でも失敗した場合は次へ進まない。

```text
FAIL / BLOCKED
  ↓
事実とEvidence収集
  ↓
再現または失敗条件の特定
  ↓
Root Cause
  ↓
影響範囲確認
  ↓
修正
  ↓
失敗したGateから再実行
```

環境要因を理由に検証を省略して完了扱いにはしない。解決不能な場合はBLOCKEDとして残し、未検証事項を明示する。

## Process Learning Loop

Learning Eventの例:

- 人間からの訂正・差し戻し
- Agentが完了と報告した後の不足発見
- 同じ原因での再試行
- CI/E2E/本番相当環境での障害
- 変更影響範囲の見落とし
- PRやmergeなど配送工程の抜け

流れ:

```text
Learning Event
  ↓
Learning Candidate作成
  ↓
Root Cause
  ↓
一般化
  ↓
既存ルールとの重複確認
  ↓
最適な反映先を選択
  ↓
Human Gate
  ↓
反映
  ↓
後続タスクで効果観測
  ↓
再発したら強制力を上げる
```

### 反映先の優先順位

可能な限り上から選ぶ。

1. **Code / Script** — 機械的に実行・判定できる
2. **CI / Gate** — 守らない場合に次工程へ進ませたくない
3. **Skill** — 複数ステップの判断手順として再利用価値がある
4. **Policy** — 全タスク共通の短い不変ルール
5. **Runbook** — 特定障害や低頻度運用時だけ必要
6. **Task Context** — 今回だけの判断で一般化不要

この初期版ではSkillやPolicyを先に増やさない。Learning Candidateの実績が蓄積してから昇格させる。

## Rule Lifecycle

```text
Task Context / Runbook
        ↓ 再発
      Skill
        ↓ なお再発
   Script / CI Gate
```

逆に、使われないルールや重複ルールは降格・削除対象とする。

## Human Gate

人間は常時交通整理をするのではなく、次の箇所へ徐々に限定する。

- 仕様上の重要な選択
- 高リスク変更の承認
- Learning Candidateの採用・棄却
- 自動化すると危険な不可逆操作

## Files

- `process.yaml` — 状態・Gate・遷移の機械可読な正本
- `templates/task-state.yaml` — 1タスクの状態とEvidenceの記録形式
- `templates/learning-candidate.yaml` — プロセス学習候補の記録形式

この土台自体も完成形ではない。実際のセッションからLearning Candidateを採取し、必要性が確認されたものだけをScript / CI / Skill / Policy / Runbookへ昇格させる。
