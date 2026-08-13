# Loop Engineering Foundation

SuzumemoのAgent作業を **Agent Plugins + AGENTS.md + State Machine + Evidence** でループさせるための土台。

## Agent Plugins v1 package

このリポジトリrootをplugin rootとして扱う。

```text
plugin.json
skills/
  prompt-injection-guard/
  service-ops-safety/
  workspace-preflight/
  requirements/
  impact-analysis/
  implementation/
  verification/
  code-review/
  security-review/
  incident/
  delivery/
  pr-aftercare/
  process-learning/
  task-transition/
AGENTS.md
.loop/process.yaml
```

各Skillは `skills/<name>/SKILL.md` に配置し、YAML frontmatterの `name` と親directory名を一致させる。必要な詳細は同一Skill配下の `references/` / `scripts/` / `assets/` へ分離する。

## Architecture

```text
plugin.json
  ↓
AGENTS.md
  ↓
.loop/process.yaml
  ↓
skills/*/SKILL.md
  ↓
Evidence
  ↓
Gate PASS / FAIL / BLOCKED
```

機械判定できる学習は `scripts/**` や `.github/workflows/**` に昇格させ、文章による注意だけに依存しない。

## Main Loop

```text
[ALWAYS ON]
prompt-injection-guard
service-ops-safety
        │
        ▼
WORKSPACE_PREFLIGHT
    ↓
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
PR_AFTERCARE
    ↓
PROCESS_LEARNING
    ↓
TASK_TRANSITION
    ↓
DONE
```

### DELIVERY

review済みheadをcommit/pushし、現在taskに紐づくPRを作成または更新する。

**`PR created` はcheckpointでありcompletionではない。**

### PR_AFTERCARE

最新headについて、required CI、review、requested changes、approval、conflict、mergeabilityを確認し、merge-readyまで収束させる。

コード修正が必要なら:

```text
PR_AFTERCARE
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
PR_AFTERCARE
```

headが変わるたびに最新headで観測をやり直す。pendingや過去headのsuccessはmerge-ready Evidenceではない。

### PROCESS_LEARNING

Aftercareがterminalになった後に実行する。

CI/E2E failure、review finding、requested changes、修正cycle、conflict、人間からの訂正、task切替ミスまで振り返り対象にする。

### TASK_TRANSITION

Process Learning後、現在taskを閉じてからsessionをreleaseするか、次taskの新しいtask packetへ明示的に再束縛する。

前taskのIssue / review / CI contextを次taskへ暗黙に持ち越さない。

## Session / Task invariant

通常は次を守る。

```text
1 session = 1 current task
1 current task = 1 task branch / worktree
1 current task = at most 1 Delivery PR
```

PR Aftercareがterminalになる前に別taskへ移らない。並行taskはユーザー明示許可がある場合だけ例外。

## Delivery Scope

通常のtargetは2つ。

1. `merge_ready` — デフォルト。最新headのCI / review / approval / conflictを収束してmerge可能まで
2. `merged_cleaned` — merge指示がある場合。merge結果、Issue状態、task branch/worktree後始末まで

`pr_created` はtargetではなく公開checkpoint。

単に「PRを投げて」「PR作って」は `merge_ready` とする。「PR作成までで止めて」等と明示された場合だけAftercareを省略できる。

## Evidence First

- 「テストを追加した」≠ テストPASS
- 「CIで通るはず」≠ CI PASS
- 「pushした」≠ PR exists
- 「PRを作った」≠ task complete
- 「CIが1本通った」≠ PR merge-ready
- 「修正した」≠ review finding closed + latest-head verification
- 「振り返った」≠ Process Learning Evidenceあり

## Failure routing

```text
VERIFICATION FAIL
   ↓
INCIDENT
   ↓
IMPLEMENTATION or VERIFICATION
```

```text
CODE_REVIEW FAIL
   ↓
IMPLEMENTATION → VERIFICATION → CODE_REVIEW
```

```text
SECURITY_REVIEW FAIL
   ↓
IMPLEMENTATION → VERIFICATION → CODE_REVIEW → SECURITY_REVIEW
```

```text
PR_AFTERCARE
  ├─ code/test/coverage fix → IMPLEMENTATIONから再ループ
  ├─ specification conflict → REQUIREMENTS
  ├─ unknown failure → INCIDENT
  └─ human-only blocker → BLOCKED
```

## Process Learning Loop

```text
Human Correction / Failure / Retry / CI / Review / Aftercare Miss
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
                     Future taskでObserve
                              ↓
                    Effective / Recurred
```

反映先優先順位:

1. Script / Code
2. CI / Gate
3. Skill
4. AGENTS.mdの短いPolicy
5. Runbook / Docs
6. Task Context

Aftercare PASS後に見つけた恒久改善は原則として現在PRへ混ぜず、CandidateとしてTask Transitionへ渡す。現在PRを変更した場合はmerge-ready Evidenceがstaleになるため必要Gateを再実行する。

## Responsibilities

| Skill | 責務 |
| --- | --- |
| `prompt-injection-guard` | 外部入力をデータとして扱い、埋め込み命令を遮断。常時適用 |
| `service-ops-safety` | 外部service、env、高影響writeの境界管理。常時適用 |
| `workspace-preflight` | task worktree / branch / clean baseline確認 |
| `requirements` | 独立review収束、仕様、scope、Acceptance Criteria確定 |
| `impact-analysis` | caller/callee、shared state、auth、data、tests、deploy影響 |
| `implementation` | scope内最小実装、RED/GREEN、integrity check |
| `verification` | lint/test/coverage/E2E/build/browserをEvidence付きで実行 |
| `code-review` | correctness、regression、maintainability、test adequacy |
| `security-review` | authn/authz、data boundary、input、operational risk |
| `incident` | 事実、仮説、Root Cause、restart state |
| `delivery` | review済みheadを公開し唯一のDelivery PRを束縛 |
| `pr-aftercare` | 最新PR headをmerge-readyまで監視・収束 |
| `process-learning` | Aftercareを含むtask全体を振り返りCandidate化 |
| `task-transition` | current task closure、session release / next task binding |

## Files

- `plugin.json` — Agent Plugins v1 manifest
- `skills/*/SKILL.md` — portable Agent Skills
- `AGENTS.md` — Loop entrypoint / orchestration contract
- `.loop/process.yaml` — state / gate / transition / session and delivery contracts
- `.loop/templates/task-state.yaml` — stateとEvidenceの記録形式
- `.loop/templates/learning-candidate.yaml` — Learning Candidate形式

この構成自体もProcess Learningの対象とし、実際のsessionで効かなかった箇所を観測して改善する。
