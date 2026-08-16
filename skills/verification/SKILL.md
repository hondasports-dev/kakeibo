---
name: verification
description: 選択されたRisk Profileに応じて、変更対象テストからfull verificationまで必要十分な検証をEvidence付きで実行する。実装後の実行証拠を得るときに使う。
license: Apache-2.0
---

# Verification

## 目的

「全部実行すれば安全」ではなく、**RiskとAcceptance Criteriaに対応する最小十分な検証**を行う。

テストを追加したことと、実行してPASSしたことは別。

## Profile別

### R0 trivial — targeted

例:

- `git diff --check`
- 対象format / static check
- behavior不変ならruntime testはNOT_REQUIRED根拠を残す

### R1 fast — targeted

原則:

- changed tests
- 変更パスに対してscopeを絞れるlint / type / build
- Acceptance Criteriaで必要な代表E2Eまたはruntime確認

全test / 全coverageをローカルとCIで二重実行しない。CIをauthoritativeにできる全量checkはCIへ寄せる。

### R2 standard — scoped full

- affected unit/component/Convex/integration tests
- scopeを絞れるlint / format / build等の関連static checks（repo-wide必須checkはCIへ委譲）
- changed-file coverageが必要なら実行
- user flow変更なら代表E2E
- shared surfaceなら回帰対象を追加

### R3 high — full for affected scope

- 影響範囲の正常 / 境界 / error / auth拒否 / partial failure
- coverage
- 必要なE2E（下記の3分類に従う。R1の「CIに寄せる」をR3の省略理由に使わない）
- build / runtime / browser
- schema / external service等のreflection or compatibility check

### R4 critical — full + recovery evidence

R3に加え:

- rollback / recovery手順の検証可能性
- destructive / production操作前のdry-run相当Evidence（可能な範囲）
- Human Gateで確認するprecondition

## Verification epoch / rerun policy

検証はファイル単位ではなく、関連する編集をまとめた `verification epoch` 単位で行う。
epochは「直前の検証が対象にした変更範囲」から、次のsource・test・config変更までの編集バッチを指す。

各epochで、最初に変更範囲を分類し、次の順で必要なcheckを選ぶ。

1. 変更したテストと直接影響を受けるテストを実行する
2. 変更パスに対してscopeを絞れるlint / format / type / buildを実行する。repo-wideしか実行できないcheckはCIへ委譲する
3. browser層のAcceptance Criteriaがある場合だけ、対象の機能E2Eを実行する
4. full repository checkや回帰E2Eは、同じheadのCI Aftercareを正本にする

同じheadでCIが必須の全量checkを実行する場合、ローカルで同じ全量checkを重ねることは既定では不要。
ローカル全量を実行する場合は、依存関係・test/build設定変更、影響範囲を絞れない場合、CI障害中の早期診断、
前回失敗の広域切り分け、またはHuman Gateの明示要求のいずれかと、その理由をEvidenceへ記録する。

### Rerunの判断

- 失敗したcheckは原因を分類してから再実行する。原因未確認の盲目的retryはしない
- 実装・テスト・設定を直したら、失敗checkと変更範囲に依存するcheckだけを再実行する
- flaky / infrastructure failureは、同じ条件でのbounded retryを原則1回までとし、再発すればIncidentへ戻す
- push後にheadが変わった場合、古いlocal PASSを最新headのDelivery Evidenceへ流用しない。ただし、同じ全量suiteをローカルで最初からやり直す代わりに、変更範囲のtargeted checkと最新headのCIを使う
- 複数の全量checkを実行した場合は、重複理由をEvidenceへ残す

このルールは、R3/R4の「full for affected scope」をリポジトリ全テストの無条件再実行とは解釈しない。
影響範囲が特定できるなら、その範囲の正常・境界・失敗・認可・partial failureを網羅し、リポジトリ全体のcheckはCIへ委譲する。

### Verification Evidenceの最低形

task-stateの `verification` には、少なくとも次を記録する。

- `verification_epoch` と `evidence_snapshot`
- `affected_scope` と `check_authority`（`local` / `ci` / `runtime`）
- `checks[]` の各 `name` / `authority` / `scope` / `status`
- `reruns[]` の各 `check` / `reason` / `invalidated_by`
- 同じ全量checkを複数回実行した場合の `duplicate_full_check_reason`

Evidenceの形は `node scripts/check-loop-evidence.mjs --verification --file <json>` で検査できる。
checkまたはrerunが失敗・理由なし・未完了のまま、全体をPASSにはしない。

## E2E

E2Eは次の3つに分けて扱う。混ぜない。

| 種類 | 目的 | いつrequiredか | 既定の実行場所 |
| --- | --- | --- | --- |
| 機能E2E | このtaskのAcceptance Criteriaをブラウザで証明する | ACがnavigation / 画面状態 / 認証UI / 保存・削除などブラウザ層を跨ぐとき | ローカル（push前） |
| 回帰E2E | 触っていないWebが壊れていないことを確認する | `src/**` / `e2e/**` を変更したとき、または機能E2Eがrequiredのとき | CI Aftercareを正本にしてよい |
| 実行場所 | ローカルpush前かCI Aftercareか | 機能E2Eはローカル、回帰E2EはCI | 上表 |

代表的な機能E2E required:

- navigation / major user flow
- authentication / authorizationの画面経路
- save / delete
- browserでしか証明できない状態

unit / component / ConvexでACを証明でき、ブラウザ層を跨がないなら機能E2Eは `NOT_REQUIRED` にできる。その場合もEvidenceの `E2E:` 行に `NOT_REQUIRED` と理由を書く。理由なしのskipはVerification未完了であり、PASSにしない。

`src/**` / `e2e/**` の変更だけではローカルE2Eの全量実行理由にならない。browser層のAcceptance Criteriaを持つ変更は対象の機能E2Eをpush前に実行し、
触っていないWebの回帰E2EはCI Aftercareを正本にできる。

環境不足や失敗は、省略理由にはしない。requiredなら復旧またはBLOCKED。

## Shared membership / authz helper

`getGroupMembership`、`resolveActiveGroupForUserId`、`getResolvedMemberships` など、共有のmembership / 認可helperのskip / continue / null扱いを変えたら、そのhelperのcallerテストも回す。feature向けのtargetedテストだけでは足りない。

例: LINEサマリー用にmembership解決を切り出しても、Clerk認証前提のcategories / receipts / expenseEntries / weekSessions等が同じhelperを使うなら、それらもVerification対象に含める。

## Suzumemo E2E environment

E2E対象変更では既存手順を使う。

```bash
pnpm run e2e:env-sync
```

Convex反映が必要なら:

```bash
pnpm exec convex dev --once
```

`.env.local` の正本やsecret値をlogへ出さない。

## Risk escalation

Verification中に想定より広い影響を発見した場合、現在profileのcheckを増やすだけで済ませずRequirements / Impactへ戻してRiskを再判定する。

例:

- local UIだと思ったがshared providerへ影響 → R1→R2
-通常query変更だと思ったがauthorization boundaryへ影響 → R2→R3

## FAIL

- code defect → Implementation
- spec mismatch → Requirements
- unknown / repeated failure → Incident
- required environment unavailable → BLOCKED / Incident

同じ失敗を惰性で繰り返さない。

## Evidence

```text
VERIFICATION
Status: PASS | FAIL | BLOCKED
Risk level:
Profile:
Checks:
Coverage:
E2E:
Runtime/browser:
Skipped checks + reason:
Risk escalation discovered:
Evidence:
```
