# Loop Engineering Foundation

このディレクトリは、SuzumemoのAgent作業を **AGENTS.md + Skills + State Machine + Evidence** でループさせるための土台を管理する。

## Architecture

```text
AGENTS.md
  │  いつ・どの順番で回すか
  ▼
.loop/process.yaml
  │  状態 / Gate / FAIL時の遷移
  ▼
.agents/skills/**/SKILL.md
  │  各工程をどう実行するか
  ▼
Evidence
  │  command / test / diff / PR / CI / review
  ▼
Gate PASS / FAIL / BLOCKED
```

今後、機械判定できる学習は `scripts/**` や `.github/workflows/**` に昇格させ、文章による注意だけに依存しない。

## Main Loop

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

失敗・BLOCKED・同一失敗の反復は横断的に `INCIDENT` へ入る。

```text
Any Gate FAIL/BLOCKED
        ↓
     INCIDENT
        ↓
 Facts / Root Cause / Fix
        ↓
restart state
```

## Why AGENTS.md + Skills

`process.yaml` だけでは状態を記述できても、Agentが毎回そこを入口として工程を実行する契約が弱い。

そのため役割を分ける。

- **AGENTS.md**: 常に読む短いオーケストレーター。必須順序、戻り先、DONE条件を定義
- **process.yaml**: 状態遷移とGateの機械可読な正本
- **Skills**: 各工程の具体的な調査・実装・検証・レビュー・Delivery手順
- **Scripts / CI**: Learningで必要性が確認されたルールを強制する最終反映先

AGENTS.mdへ詳細チェックリストを集約せず、Skillへ分離する。

## Skills

| Skill | 役割 |
| --- | --- |
| `requirements` | 要求・Issue・既存実装から仕様とAcceptance Criteriaを確定 |
| `impact-analysis` | caller/callee、shared state、auth、data、tests、deploy影響を事前調査 |
| `implementation` | scope内の最小実装、RED/GREEN、integrity check |
| `verification` | lint/test/coverage/E2E/build/browserをEvidence付きで実行 |
| `code-review` | 正しさ、回帰、保守性、test adequacyを独立レビュー |
| `security-review` | authn/authz、data boundary、input、secret、external serviceを独立レビュー |
| `incident` | 失敗の事実整理、独立仮説、Root Cause、restart state |
| `delivery` | commit/push/PR/CI/review/merge-ready/merge/cleanup |
| `process-learning` | correction/failureからCandidateを抽出して反映先を選択 |

## 旧Skillから再利用したもの

旧ファイルをそのまま復元せず、再利用可能な知識だけ新しい責務へ移した。

| 旧Skill / 内容 | 新しい反映先 |
| --- | --- |
| `issue-gate-0` | `requirements`: 実装前Go/Stop、Issue補完、Acceptance Criteria、E2E方針 |
| `tdd-implement` | `implementation`: RED/GREEN、scope契約、integrity check |
| `verify-pre-push` | `verification`: 基本check、env同期、Convex反映、失敗時停止 |
| `e2e-author` | `verification`: E2E追加/更新/省略条件、locator品質 |
| `e2e-smoke-run` | `verification`: smoke、shared test user/DB、env sync |
| `browser-verification` | `verification`: console/network/runtime/viewport確認 |
| `code-review` + review checklists | `code-review`: frontend/backend/test review、Must-fix closure |
| `security-checklist` | `security-review`: auth/authz、secret、XSS、data boundary |
| `service-ops-safety` | `security-review`: production/secret/domain等のHuman Gate |
| `prompt-injection-guard` | `security-review`: 外部由来命令とsecret送信の隔離 |
| `stuck-advisor` | `incident`: 同一失敗2回、複数仮説、最小検証 |
| `babysit-pr` | `delivery`: checks、review thread、approval、conflict、merge-ready |
| 旧roles / virtual-company | **復元しない**。役割分担ではなくLoop状態で責務を分離 |

## Review-Fix Loops

### Verification failure

```text
VERIFICATION FAIL
   ↓
INCIDENT
   ↓
IMPLEMENTATION or VERIFICATION
```

### Code Review failure

```text
CODE_REVIEW FAIL
   ↓
IMPLEMENTATION
   ↓
VERIFICATION
   ↓
CODE_REVIEW
```

### Security Review failure

```text
SECURITY_REVIEW FAIL
   ↓
IMPLEMENTATION
   ↓
VERIFICATION
   ↓
CODE_REVIEW
   ↓
SECURITY_REVIEW
```

### PR / CI failure

```text
DELIVERY
  ├─ code fix needed → IMPLEMENTATIONから再ループ
  ├─ unknown/env failure → INCIDENT
  ├─ spec conflict → REQUIREMENTS
  └─ human approval → BLOCKED
```

## Evidence First

PASSは主張ではなくEvidenceで決める。

- 「テストを追加した」≠ テストPASS
- 「CIで通るはず」≠ CI PASS
- 「pushした」≠ PR exists
- 「CIが通った」≠ PR merge-ready
- 「修正した」≠ review finding closed + regression verification

## Delivery Scope

Delivery targetは3段階。

1. `pr_created` — 明示的にPR作成まで
2. `merge_ready` — デフォルト。CI / review / approval / conflictを解消してmerge可能まで
3. `merged_cleaned` — merge指示がある場合。merge結果、Issue状態、task branch/worktree後始末まで

後始末ではtask固有worktreeだけを対象にし、canonical `preview` 作業場所や正本 `.env.local` を勝手に削除しない。

## Process Learning Loop

```text
Human Correction / Failure / Retry / Miss
                    ↓
              Learning Event
                    ↓
                Root Cause
                    ↓
                Generalize
                    ↓
              Duplicate Check
                    ↓
            Strongest Target
                    ↓
                Human Gate
                    ↓
                  Apply
                    ↓
            Observe future tasks
                    ↓
         Effective / Recurred
```

反映先の優先順位:

1. Script / Code
2. CI / Gate
3. Skill
4. AGENTS.mdの短いPolicy
5. Runbook / Docs
6. Task Context

同じ問題が再発するなら文書を増やすのではなく、より強い仕組みへ昇格する。

## Files

- `AGENTS.md` — Loop entrypoint / orchestration contract
- `.loop/process.yaml` — state / gate / transition
- `.loop/templates/task-state.yaml` — stateとEvidenceの記録形式
- `.loop/templates/learning-candidate.yaml` — Learning Candidateの形式
- `.agents/skills/**/SKILL.md` — 各状態の実行方法

この構成自体もProcess Learningの対象とし、実際のセッションで効かなかった箇所を観測して改善する。