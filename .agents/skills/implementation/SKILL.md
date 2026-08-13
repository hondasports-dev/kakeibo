---
name: implementation
description: RequirementsとImpact Analysis PASS後、scope内で最小差分をTDD中心に実装する。RED/GREEN、差分整合性、無関係変更防止を扱う。
---

# Implementation

## 目的

確定仕様と影響範囲に従い、必要最小限の変更でAcceptance Criteriaを満たす。

旧 `tdd-implement` から、RED/GREEN、scope契約、無関係変更の禁止、失敗原因切り分け、実装後integrity checkを継承する。旧Implementerロールやモデル指定は継承しない。

## 前提

- `REQUIREMENTS: PASS`
- `IMPACT_ANALYSIS: PASS`
- 作業branch / worktreeが対象タスク用に分離されている
- Convex変更前は `convex/_generated/ai/guidelines.md` を確認済み

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

実装中に契約を変える必要が出た場合、勝手にscopeを拡大せず `requirements` または `impact-analysis` へ戻す。

## TDD

振る舞い変更・バグ修正では原則として次を使う。

1. 望ましい振る舞いを証明する最小テストを追加・更新する
2. 対象テストを実行し、期待した理由で失敗することを確認する（RED）
3. 最小の本体変更を入れる
4. 対象テストを再実行して成功を確認する（GREEN）
5. 必要に応じてリファクタし、再度GREENを確認する

テスト追加が不適切な変更（docsのみ、振る舞い不変の機械的変更など）は理由を記録する。

## 実装中のルール

- 無関係なリファクタを混ぜない。
- 依存追加は必要性を説明できる場合だけ行う。
- caller/calleeやauth境界に新たな影響を発見したらImpact Analysisを更新する。
- Issue本文にない設計でも既存規約から一意なら自律判断してよいが、ユーザー価値や認可等を変える判断はRequirementsへ戻す。
- secret、`.env.local`、認証情報をコミット・ログ出力しない。
- E2Eや全体検証を「実装できた証拠」と混同しない。最終判定はVerificationで行う。

## 失敗の初期切り分け

テストや実行が失敗したら、最低限次を分ける。

- 実装コード
- テスト自体
- test data / fixture
- auth / authorization
- env / secret
- network / external service
- 既存flaky / base側失敗

同じ失敗を2回繰り返したら `incident` を使う。

## Implementation Integrity Check

実装終了時に差分全体を見て次を確認する。

- scope外ファイルの変更がない
- untrackedファイルを見落としていない
- Design Decisionsと矛盾しない
- Acceptance Criteriaと実装が対応している
- 無関係な依存・リファクタがない
- Impact Analysisで想定した回帰対策が実装またはVerification計画へ反映されている

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