# Loop Engineering Foundation v10

Suzumemo の Agent Loop v10 は、Re:Me で洗練した Loop v2 の原則を取り込みつつ、Suzumemo 固有の `preview` delivery、worktree 強制、Convex / Clerk / Vercel、家計・課金境界を維持する。

正本:

- `AGENTS.md` — 実行契約の入口
- `.loop/process.yaml` — Risk / Controls / state の機械可読な正本
- `.loop/templates/task-state.yaml` — task state / Finding Ledger
- `skills/*/SKILL.md` — current state と条件付き helper

## 表記ルール

`.loop/process.yaml` は Agent が読む実行契約である一方、`task-state.yaml` や各 Skill から参照される安定した識別子も持つ。

そのため、以下のルールで記述する。

- YAML の key は英語のまま維持する。
- `prepare` / `verification` / `r2_medium` / `c0_unclear` / `fix_now` / `merge_ready` などの state ID・Risk ID・Spec Confidence ID・enum・action ID は英語のまま維持する。
- Skill path、file path、field name、command など機械的に参照される値は変更しない。
- 原則、trigger、required condition、blocking rule、完了条件など Agent が意味として読む自然言語は日本語で記述する。
- 既存の機械識別子を日本語へ置き換えて、`task-state.yaml` や Skill との対応関係を壊さない。

## Design principle

```text
Quality = Acceptance Criteria
        + Required Controls
        + Verification Evidence
        + unresolved finding = 0
```

Gate 数や Agent 数そのものを品質指標にしない。

Default path:

```text
PREPARE
  ↓
IMPLEMENT
  ↓
VERIFY
  ↓
REVIEW?          # Risk / Control が要求する時だけ
  ↓
DELIVER
  ↓
PR AFTERCARE
  ↓
DONE
```

`Human Gate`、`Incident`、`Process Learning` は side path。Impact Analysis、Security Review、Finding disposition、Task Transition は必要時だけ読む helper とする。

## PREPARE

PREPARE で次を一度だけ決める。

- Goal / In scope / Out of scope
- Acceptance Criteria / Preserve
- Spec Confidence
- Risk
- Required Controls
- Verification plan
- 必要十分な Impact summary

repository file を変更する task では、最初の編集前に `skills/workspace-preflight/SKILL.md` を適用する。Suzumemo では `main` / `preview` を直接編集せず、`node scripts/check-task-worktree.mjs --require-clean` を通す。

### Spec Confidence

- `C2 confirmed`: 明示仕様・ACが明確で material conflict なし
- `C1 reconstructed`: docs / tests / pattern から material choice なしに復元できる
- `C0 unclear`: 複数の妥当な成果物がある
- `C0 conflicted`: desired state について authoritative source が矛盾する

`C0` は実装禁止。Risk を上げて曖昧さを隠さない。

Independent Requirements Review は Risk の高さでは増やさない。C1 復元に material choice が残る、または protected behavior を仕様復元で変える時だけ最大1 reviewer。

## Risk と Required Controls を分ける

Risk は変更の影響度・不確実性を表す。

4軸を `0..2` で評価する。

1. Blast Radius
2. Data / Security
3. Reversibility
4. Uncertainty

目安:

- 0..2 → R1
- 3..4 → R2
- 5..8 → R3
- R0 / R4 は明示条件

ただし auth / group boundary / Convex schema / billing に触れたという理由だけで、すべての高価な Gate を起動しない。代わりに必要な Control を追加する。

代表 Control:

- `workspace_preflight`
- `security_review`
- `data_model`
- `financial_integrity`
- `destructive_or_stateful`
- `service_ops`
- `human_gate`
- `prompt_injection_guard`

R4 は production DB/data、不可逆 mutation、account deletion、authorization model overhaul、financial settlement integrity、production secret rotation、DNS cutover 等。

Risk は途中で昇格できる。Implementation 開始後は `max observed Risk` を completion floor とし、後から軽い Risk に戻して強い Verification / Review を回避しない。

## Finding Ledger

Verification gap、Code/Security Review finding、CI finding、残存 Risk を別々の構造へ転記しない。

`.loop/templates/task-state.yaml` の `findings[]` を唯一の source of truth とする。

```text
F001
source: review
category: security
finding: ...
affected AC / invariant: ...
evidence: ...
disposition: open | fix_now | defer_with_evidence
             | accept_with_human_gate | not_applicable | resolved
```

同じ finding を別 Gate へコピーしない。解決したら同じ record に resolution と verified revision を追記する。

Delivery を block するもの:

- `open`
- `fix_now`
- test gap
- protected domain の未承認 accept
- evidence 不足の defer / not-applicable

auth、authorization、group/data boundary、financial/data integrity、rollback、idempotency、atomicity、immutability、privileged boundary、current scope、test gap は protected。`other` も分類されるまでは protected とする。

## REVIEW

通常の独立 reviewer は最大1体。

- R0: 原則なし
- R1: 原則なし。Control が要求した時だけ
- R2: 1 independent reviewer
- R3: 1 independent risk-aware reviewer
- R4: 1 independent reviewer + Human Gate。必要なら materially distinct specialist を追加

Security は通常 REVIEW rubric に含め、security control が起動した時だけ `skills/security-review/SKILL.md` を追加する。

Reviewer 同士を討論させない。必要なら独立・並列に所見を出し、root が1回だけ統合する。

Issue / PR review の提案は未検証入力である。指摘を修正へ採用する前に、現在のRequirements、domain contract、既存testと照合する。提案どおり変更したことではなく、確認済みの契約を満たしたことをfinding解決のevidenceとする。

## Verification

ローカルでは Acceptance Criteria と affected scope に必要な最小十分な check を実行する。

- changed / directly affected tests
- scopeable lint / type / build
- browser AC がある場合の functional E2E
- Convex / auth / shared membership change の caller / denial test

TypeScript の変更が複数の project / `tsconfig` に分かれる場合は、root build が全projectを覆うと仮定しない。変更ファイルを所有する `tsconfig` を特定し、そのscopeのtypecheckを広いbuildより先に実行する。

optionalな更新fieldが永続化境界をまたぐ場合は、UIの関数引数だけで完了判定しない。`omitted`、`explicit clear`、`value` の3状態をUI → serializer → validator → handler → persistenceの境界で定義し、affected testで証明する。

Suzumemo E2E は既存手順を使う。

```bash
pnpm run e2e:env-sync
pnpm exec convex dev --once   # Convex reflection が必要な時だけ
```

required environment が無いことを skip 理由にしない。復旧できなければ BLOCKED / Incident。

repo-wide regression check は同一 content の CI Aftercare を正本にできる。理由なく同じ full suite を local と CI で重複しない。

## Revision / revalidation

SHA が変わっただけで全 Evidence を破棄しない。

- same tree / content: previous evidence を再利用可能
- content changed: delta verification
- REVIEW が必要だった task: delta review
- protected behavior / AC coverage / Risk / Controls が変わる、または delta を安全に bound できない: affected scope の full rerun

rebase 等で commit SHA だけ変わり tree が同じなら、全量 check をゼロから繰り返さない。

## Conditional Skill loading

常時 context に置くのは:

- `AGENTS.md`
- `.loop/process.yaml`
- current state の Skill

以下は trigger 時だけ読む。

- workspace preflight
- prompt injection guard
- service ops safety
- impact analysis
- security review
- finding disposition
- incident
- process learning
- task transition

Safety 自体を弱めるのではなく、短い invariant を常時保持し詳細手順だけ遅延ロードする。

## Process Learning

完全 event-driven。

Trigger:

- human correction
- unexpected CI / E2E / Gate failure
- actionable review finding
- retry / incident
- scope / impact miss
- delivery / aftercare miss
- process rule が不足していたことが明確になった時

R3 / R4 という理由だけでは full learning を起動しない。

Learning Event があった場合、再利用可能な候補を最も影響の大きい3件まで抽出し、`context` / `speed` / `precision` の改善軸を付ける。候補は会話上の報告だけで完了させず、次のいずれかへ必ず disposition する。

- `applied`: 優先順位に従って script / code、CI、Skill、`AGENTS.md`、runbook/docs へ反映し、location と verification evidence を残す
- `follow_up`: current task のscope外なら永続的な Issue / task / PR のtype・referenceと proposed targetを残す
- `no_change`: 既存enforcementで充足済み、または再利用可能な変更でないことをevidence付きで残す

ユーザーがcurrent PRへの反映を明示した場合は、候補を `applied` にしてdelta Verification / Review / Aftercareを行う。scope外の候補を暗黙に同じPRへ混ぜない。

task-stateの`learning` record全体を判定対象とする。Eventが`none`の時だけ`NOT_REQUIRED`と空候補を許可し、Eventがある時は`PASS`と候補配列を必須にする。欠落・未知shape・空白だけのevidenceはfail-closedに扱う。

### Issue #673 loopから昇格した運用ルール

- **所有 `tsconfig` を先に確認する**: rootのtypecheck/buildが別projectを覆うと仮定せず、変更scopeのtypecheckを早期に実行する。`speed` と `precision` の手戻りを減らす。
- **optional updateを3状態で検証する**: omitted、explicit clear、valueをtransportからpersistenceまで通して確認し、型上のoptionalだけで保存契約を判断しない。`precision` を上げる。
- **review提案をdomain contractと照合する**: 外部reviewの修正案をそのまま採用せず、Requirements・domain rule・testを正本として判断する。誤修正と再reviewを減らし、`speed` と `precision` を上げる。

## Delivery / Aftercare

Suzumemo の通常 base は `preview`。

`PR created` は checkpoint であり completion ではない。

```text
DELIVER to preview
  ↓
PR AFTERCARE
  ├ latest PR content
  ├ required CI
  ├ actionable review / requested changes
  ├ conflict
  └ mergeability
  ↓
merge_ready
```

修正は同じ branch / PR へ積む。PR head が変わったら content delta に応じた Verification / Review を行い、最新 content の CI を確認する。

ユーザーが明示的に「PR作成まで」と指定した場合だけ Aftercare を省略できる。

## Task Transition

Task Transition は通常の completion Gate ではない。

次 task へ context を持ち越す必要がある時だけ、closing summary と最小の next-task packet を作る。単発 task の終了時に独立 reasoning phase を追加しない。

## Quality invariants kept

軽量化しても次は削らない。

- C0 で実装しない
- repository change の worktree preflight
- shared diff は one writer
- Acceptance Criteria 対応 Verification
- required independent Review
- protected finding の agent-only defer 禁止
- test gap の Human Gate 迂回禁止
- max observed Risk floor
- production / irreversible operation の Human Gate
- `preview` PR の latest content が merge-ready になるまで Aftercare
