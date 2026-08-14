# 開発プロセス

このドキュメントはkakeiboの開発運用を定義する。目的は、`main` / `preview` を安定させつつ、**変更リスクに見合うだけの工程を使って速度と品質を両立すること**。

Agent固有の正本は `AGENTS.md`、`.loop/process.yaml`、`skills/*/SKILL.md`。

## 目的

- `main` をビルド可能・リリース可能に保つ。
- `preview` で開発統合する。
- PRで変更をレビュー可能にする。
- 低リスク変更へ不要なmulti-agent reviewやfull verificationを課さない。
- auth、Convex、data、production等の高リスク変更は十分なGateを通す。

## ブランチ / worktree運用

- `main` は保護対象。
- 開発統合は `preview`。
- 変更taskは原則、最新 `preview` からtask専用worktreeを作る。
- `main` へ直接pushしない。

preview用worktree:

```bash
git fetch origin preview
git worktree add ../kakeibo-worktrees/preview preview
# 既存の場合
git -C ../kakeibo-worktrees/preview pull
```

### `.env.local` 正本

`../kakeibo-worktrees/preview/.env.local` をローカルE2Eの正本とする。

初回に無ければclone元の`.env.local`からbootstrapする。どちらにも無ければ環境未準備なので復旧するまで進めない。

```bash
if [ ! -f ../kakeibo-worktrees/preview/.env.local ]; then
  if [ ! -f .env.local ]; then
    echo ".env.local がありません。ローカル開発用 .env.local を復旧してください。" >&2
    exit 1
  fi
  cp .env.local ../kakeibo-worktrees/preview/.env.local
fi
```

Task worktree:

```bash
git worktree add ../kakeibo-worktrees/<branch-name> -b <branch-name> origin/preview
cp ../kakeibo-worktrees/preview/.env.local ../kakeibo-worktrees/<branch-name>/.env.local
cd ../kakeibo-worktrees/<branch-name>
```

## Workspace Preflight

コード、設定、process policy変更では最初の編集前に:

```bash
node scripts/check-task-worktree.mjs --require-clean
```

`WORKSPACE_PREFLIGHT status: PASS` まで編集しない。

確認対象:

- registered task worktree
- `main` / `preview`ではないtask branch
- canonical worktreeではない
- clean baseline

`docs/`、`README.md`、`CHANGELOG.md`だけの純粋な文書変更は理由を記録して例外にできる。`AGENTS.md`、`.loop/`、`skills/`、`scripts/`、設定ファイルは文書例外に含めない。

## ローカルGit hook

commit前はHusky / lint-stagedで`oxlint`と`oxfmt --check`を実行する。

確認:

```bash
pnpm install
git config --get core.hooksPath
```

Markdown等は必要に応じて:

```bash
git diff --check
```

で補う。

---

# Issue運用

次の変更は原則Issueを作る。

- 機能追加
- バグ修正
- architecture変更
- schema / index / auth / migration
- user/data影響が不明な変更

Issue任意:

- typo
- pure docs
- behavior不変の小refactor
- runtime behaviorを変えない低リスク依存更新

Issueには最低限、目的・背景・期待結果・完了条件を書く。

Issue / PRのAgent作成部分は原則日本語。コード、コマンド、固有名詞、ログ引用は原文可。

## Issueが薄い場合

Issueの情報量だけでRiskをHighにしない。先に**Spec Confidence**を判定する。

- `C2 confirmed`: 明確
- `C1 reconstructed`: docs/tests/patternからほぼ一意に補完可能
- `C0 unclear`: 複数の妥当な成果物がある
- `C0 conflicted`: desired stateについてsourceが矛盾

C0は実装禁止。

確認source:

1. 現在のユーザー指示
2. 最新の承認spec / ADR / decision
3. 現在taskのIssue / comment
4. canonical docs
5. tests
6. implementation / existing pattern

Issueが「現在BをAへ変える」と明記している場合、実装Bとの差はexpected deltaであってConflictではない。

IssueがA、docs/tests/implementationがBで、Issueが新仕様かstaleか判断できない場合はC0 conflictとしてHuman Gateへ送る。

---

# Risk-based Agent Loop

## Riskの4軸

各0..2:

- Blast Radius
- Data / Security
- Reversibility
- Uncertainty

Score目安:

- 0..2 → R1
- 3..4 → R2
- 5..8 → R3

R0/R4は明示condition。

### R3 floor

- authn/authz
- tenant/group/data boundary
- schema/migration
- data delete/retention
- billing/payment
- secret/privileged env
- webhook/external write
- production behavior config

### R4

- production DB migration
- bulk/irreversible data mutation
- account deletion semantics
- authorization model overhaul
- financial settlement integrity
- production secret rotation
- production DNS/domain cutover

process policyは一律Highにしない。通常R2。safety boundary、Delivery completion、production/destructive policy変更はR3+。

## Profiles

| Risk | Profile | Requirements review | Impact | Review | Learning |
| --- | --- | ---: | --- | --- | --- |
| R0 | TRIVIAL | 0 | folded | separate reviewなし | event時のみ |
| R1 | FAST | 0 | Requirementsへ統合 | Code + Security quick scan | event時のみ |
| R2 | STANDARD | 0 default / 条件付き1 | separate | Code + Security quick scan | event時のみ |
| R3 | HIGH | 2 | separate | Code + Security separate | full |
| R4 | CRITICAL | 3 + post-synthesis 1 | separate | Code + Security separate | full |

R2の1 reviewはC1、material uncertainty、cross-cutting、Mainがmaterial ambiguityを検出した場合だけ起動する。

R4はimplementation前とproduction/irreversible operation直前にHuman Gateを要求する。

## Riskの再評価

- initial Riskは暫定。
- Requirements / Impact / Reviewで新しい影響を見つけたら即時昇格。
- downgradeはimplementation前にEvidence付きのみ。
- implementation開始後はtask中のmax observed riskをcompletion floorとする。

---

# 実装 / Verification / Review

Implementation Handoffには:

- Spec Confidence
- Risk / Profile
- Acceptance Criteria
- editable scope
- impact
- required verification

を含める。

## Verification

- R0: targeted check
- R1: changed tests +必要なlint/build/E2E
- R2: affected scope tests/coverage/E2E
- R3: full affected-scope verification
- R4: R3 + recovery evidence

全test/coverageをローカルとCIで無条件に二重実行しない。

E2E対象では既存の環境同期を使う。

```bash
pnpm run e2e:env-sync
```

Convex反映が必要なら:

```bash
pnpm exec convex dev --once
```

required E2Eが環境不足で実行できない場合、理由だけ記録して先へ進まない。

## Review

- R0: separate Code/Security Review原則不要
- R1/R2: Code Review内でSecurity quick scan
- R3/R4: Code ReviewとSecurity Reviewを独立Gate化

quick scanでauth/data/secret/external/destructive triggerを発見したらRiskをR3+へ上げる。

---

# Delivery

PR作成はcompletionではない。

```text
DELIVERY
→ PR_AFTERCARE
   latest head
   required CI
   actionable findings
   requested changes
   approval
   conflict / mergeability
→ merge_ready
```

修正は同一taskの同一PRへ積む。headが変わったら新headで必要なVerification / Review / Aftercareを再実行する。

ユーザーが明示的に「PR作成までで止めて」と指示した時だけAftercareを省略できる。

---

# Process Learning / Task Transition

R0-R2はevent-driven。

Eventなしなら`Events: none / Candidates: none`で閉じる。

full Learning trigger:

- R3/R4
- human correction
- Gate/CI/E2E failure
- actionable review finding
- retry/incident
- scope/impact/delivery/transition miss

最後にTask Transitionでcurrent task identityを閉じる。前taskのIssue/PR/CI contextを次taskへ暗黙に持ち越さない。

## DONE

- C1/C2
- Risk/Profile記録済み
- profile必須Gate PASS
- Delivery target到達
- PR Aftercare terminal
- Learning Event分類済み
- Task Transition完了
- required blockerなし
