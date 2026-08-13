---
name: requirements
description: 要求・Issue・既存実装・docsを統合し、実装前に仕様、受け入れ条件、scope、テスト方針を確定する。リポジトリ変更タスクの最初に使う。
---

# Requirements / Specification

## 目的

Issue本文だけをそのまま実装せず、ユーザー要求と既存システムを踏まえて**検証可能な仕様**へ収束させる。

旧 `issue-gate-0` のうち再利用価値が高かった「実装前のGo/Stop」「Issueが薄い場合の補完」「Acceptance Criteria」「UI状態/E2E方針」を継承する。旧ロール分担は使わない。

## 入力

- 現在のユーザー要求
- Issue / PR / コメント（該当時）
- 関連docs
- 既存コード・既存テスト

## 手順

1. **要求を要約する**
   - 解く問題
   - 期待するユーザー価値 / 振る舞い
   - 明示された制約
   - 完了時にユーザーが確認できる状態
2. **既存状態を調査する**
   - 同等・類似機能
   - 既存UI / API / schema / authパターン
   - 関連テスト
   - 関連Issue / docs
3. **仕様の穴を探す**
   - 正常系だけでなく、空・読込・エラー・権限不足・存在しないデータ・境界値
   - UI変更ならdesktop/mobile、初期状態、操作後状態
   - 日付なら月末・年跨ぎ・タイムゾーン
   - データ変更なら既存データとの互換性
4. **scopeを確定する**
   - in scope
   - out of scope
   - 変更しない既存挙動
5. **Acceptance Criteriaを検証可能な形にする**
   - `〜できる` だけでなく、どの入力・状態で何が観測できればPASSかを書く
6. **テスト方針を決める**
   - unit / component / Convex / integration / E2Eのどこで証明するか
   - E2E追加・更新・省略を決め、省略には要件上の理由を持つ
   - 環境不足や実行失敗をE2E省略理由にしない
7. **Go / Stopを判定する**

## Issueが薄い場合

情報不足だけで即停止しない。次の順で補完する。

1. 現在のユーザー要求
2. Issue本文・コメント
3. 関連docs
4. 既存コード・既存テスト
5. リポジトリの既存パターン

命名や既存パターンから一意に決められることは自律判断してよい。

次はHuman Gate対象:

- ユーザー価値が変わる
- データ保持・削除方針が変わる
- 認可・権限が変わる
- 課金や外部契約に影響する
- 複数案でscope / cost / UXが大きく変わる
- 不可逆な変更

## ハードストップ

次が未確定なら `REQUIREMENTS PASS` にしない。

- Acceptance Criteriaが検証不能
- 依存Issueがブロッカー
- UI変更なのに主要な空/読込/エラー状態が未定
- schema変更の移行・互換性方針が必要なのに未定
- 認可変更の期待挙動が不明
- E2Eが必要か判断できない

## 出力

```text
REQUIREMENTS
Status: PASS | BLOCKED
Goal:
Current behavior:
Expected behavior:
In scope:
Out of scope:
Acceptance Criteria:
Edge / error states:
Test strategy:
Material decisions:
Open blockers:
Evidence:
```

`PASS` の後だけ `impact-analysis` へ進む。