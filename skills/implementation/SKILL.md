---
name: implementation
description: RequirementsとImpact AnalysisがPASSした後、確定したscope内で最小差分を実装し、RED/GREENと差分整合性を確認する。振る舞い変更やバグ修正を実装するときに使う。
license: Apache-2.0
---

# Implementation

## 目的

確定仕様と影響範囲に従い、必要最小限の変更でAcceptance Criteriaを満たす。

## 前提

- `REQUIREMENTS: PASS`
- `IMPACT_ANALYSIS: PASS`
- 常時必須Skillを適用済み
- 作業branch / worktreeが対象タスク用に分離されている
- Convex変更前はリポジトリ内の `convex/_generated/ai/guidelines.md` を確認済み

## 実装契約

実装開始前に最低限これを固定する。

```text
Goal:
Design decisions:
Editable / expected paths:
Out of scope:
Acceptance Criteria:
Constraints / prohibited operations:
Test plan:
Verification plan:
```

Issue本文は判断材料であって、そのまま実装契約とはみなさない。RequirementsとImpact Analysisを統合した契約を使う。

実装中に契約を変える必要が出た場合、勝手にscopeを拡大せず `requirements` または `impact-analysis` へ戻す。

## Writer境界

- 同一差分のwriterは原則1つにする
- 複数に分ける場合は編集pathを明確に分離する
- branch / worktree / stage / commit / pushの対象を混同しない
- 他タスクの未commit変更を取り込まない

## TDD

振る舞い変更・バグ修正では原則として次を使う。

1. 望ましい振る舞いを証明する最小テストを追加・更新する
2. 対象テストを実行し、期待した理由で失敗することを確認する（RED）
3. 最小の本体変更を入れる
4. 対象テストを再実行して成功を確認する（GREEN）
5. 必要に応じてリファクタし、再度GREENを確認する

テスト追加が不適切な変更（docsのみ、振る舞い不変の機械的変更など）は理由を記録する。

REDは「何か失敗した」では不十分。**追加・変更した仕様をまだ満たしていない理由で失敗していること**を確認する。

## 実装中のルール

- 無関係なリファクタを混ぜない。
- 依存追加は必要性を説明できる場合だけ行う。
- caller/calleeやauth境界に新たな影響を発見したらImpact Analysisを更新する。
- Issue本文にない設計でも既存規約から一意なら自律判断してよいが、ユーザー価値や認可等を変える判断はRequirementsへ戻す。
- secret、`.env.local`、認証情報をコミット・ログ出力しない。
- E2Eや全体検証を「実装できた証拠」と混同しない。最終判定はVerificationで行う。
- 実装契約外の設計変更を発見したら、先に契約を更新する。

## 失敗の初期切り分け

- 実装コード
- テスト自体 / assertion / locator
- test data / fixture
- auth / authorization
- env / secret
- network / external service
- browser / tool / dependency
- 既存flaky / base側失敗

正確なエラー、失敗test名、行、再現条件を確認してから修正する。

同じ失敗を2回繰り返したら `incident` を使う。

## Implementation Integrity Check

実装終了時にtracked / untrackedを含む差分全体を見て次を確認する。

- scope外ファイルの変更がない
- untrackedファイルを見落としていない
- Design Decisionsと矛盾しない
- Acceptance Criteriaと実装が対応している
- 無関係な依存・リファクタがない
- Impact Analysisで想定した回帰対策が実装またはVerification計画へ反映されている
- secret / local-only file / generated artifactを誤って含めていない

違反があればVerificationへ進まず修正する。

## 出力

```text
IMPLEMENTATION
Status: PASS | FAIL | BLOCKED
Changed files:
RED evidence:
GREEN evidence:
Design deviations:
Impact changes discovered:
Unresolved items:
Integrity check:
```

PASS後 `verification` へ進む。
