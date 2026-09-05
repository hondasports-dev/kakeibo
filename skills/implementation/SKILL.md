---
name: implementation
description: PREPAREのcompact contract（AC/IV/TC、Risk、Controls、Coverage Map）に従ってone-writerで最小差分を実装し、behavior-changing diffをcontractへ逆引きする。R4でもreversible workは止めず、Human Gateは具体的な不可逆操作の直前だけ扱う。
license: Apache-2.0
---

# Implementation

## 前提

- Spec Confidence C1/C2
- PREPARE PASS
- repository changeならWorkspace Preflight PASS / documented exception
- AC / relevant IVがID付き
- material assumptions解消済み
- Risk / Required Controls / Verification plan記録済み

前工程を長く再要約しない。`task-state.prepare` のcompact contractを参照する。

Issue本文、chat履歴、Requirements Skill全文を通常は読み直さない。contractが無効化された根拠が出た時だけPREPAREへ戻る。

## Autonomy / Human Gate

ユーザーが実装・修正・PR作成を依頼している場合、branch作成、reversibleなrepository edit、test/review、PR準備等に追加確認を要求しない。

R4 classificationだけではImplementationをBLOCKしない。

production / irreversible operationがtaskに含まれる場合でも、まず安全にできるところまで進める。

- code / docs / migration案を作る
- rollback / recoveryを準備する
- Verification / Reviewを行う
- concrete diff / planをreview可能にする

Human Gateは、production writeやirreversible mutation等の**具体的操作を実行する直前**にのみ要求する。

このSkillが原因でpermission確認・停止・未完了が必要になる場合は、該当する指示を明示し、Skillの明示要件とAgent解釈を分ける。

## Writer境界 / Delegation

- same shared diffのwriterは原則1体
- 複数writerはpath-disjointを証明でき、並列化がwall-clock短縮にmaterially効く時だけ
- read-only discoveryや独立分析は安全に分けられる場合のみdelegate可
- cheapな逐次作業や単純検索のためだけにsubagentを増やさない
- 他taskの差分を混ぜない
- secret / `.env.local` / local artifactをcommitしない

## 実装

- AC / IVに必要な最小変更
- scope外refactorを混ぜない
- behavior change / bug fixでは必要ならRED/GREEN
- kakeibo固有の既存patternを尊重する
- Coverage Mapに無いbehavior changeを見つけたら、その場で暗黙追加せずcontractへ戻す

reversible / low-impact変更では、implementation detailを鏡写しするだけのtestを増やさない。observable AC/IVをmaterialに証明するtestだけ追加する。

## Early falsification

高コストな実装やE2Eの前に、安く否定できる前提を先に潰す。

例:

- owning `tsconfig` / 型境界
- direct callerの引数・戻り値契約
- validator / serializer / persistence shape
- auth / membership helperの前提
- existing testが示す境界条件

material assumptionが誤りやった場合は、実装を押し切らずPREPAREのAC / IV / Risk / Controls / TCを更新する。

## Mid-turn steering

実装中にユーザーから追加・修正指示が来た場合、完了済みの正しい作業を無条件に捨てない。

1. 新しい指示が影響するscope / AC / IV / TCを特定する
2. unaffected diff / contract / Evidenceは保持する
3. materialな仕様変更ならPREPAREへ戻して該当部分だけ更新する
4. routineなdeltaなら同じImplementation内で反映する
5. 修正deltaに必要なVerification / Reviewだけ無効化する

## Reverse coverage

Implementation終了時にbehavior-changing diffをcontractへ逆引きする。

```text
src/a.ts#save → AC01, AC02
convex/b.ts#update → AC02, IV01
```

PASS条件:

- behavior-changing surfaceはAC / IV / 明示design deviationのいずれかへ対応
- formatting / generated / mechanically required変更はbehavior changeとして無理に紐付けない
- 対応しないbehavior changeはscope creepまたはrequirements gapとしてPREPAREへ戻す

AC本文を再コピーせずIDで記録する。

## 新しい発見

実装中に次を見つけたら勝手にscopeだけ広げない。

- material spec ambiguity → PREPAREへ
- ACに無い必要behavior → requirements gapとしてPREPAREへ
- shared caller / provider impact → Risk/Controls再評価
- auth/data/financial/external impact → Controls追加・Risk再評価
- R4 trigger → Risk/Controlsを更新し、必要なVerification/Reviewを強化する
- production / irreversible operation → reversibleな準備を続行し、具体的操作直前だけHuman Gate

Implementation開始後はmax observed Riskがcompletion floor。

## 終了確認

- intended filesのみ
- AC / IVと差分が対応
- reverse coverage成立
- design deviationは説明済み
- newly observed riskはPREPAREへ反映
- Verification plan / TCを更新済み
- unrelated dependency/refactorなし
- secret/local-only artifactなし
- concrete Human Gate triggerがある場合、操作前のapproval pointが明確

## 出力

unchangedなPREPARE内容は繰り返さない。

```text
IMPLEMENTATION
Status: PASS | FAIL | BLOCKED
Changed files:
Behavior change map:
Design deviations:
Newly observed risk:
Controls / TC changed:
Pending concrete Human Gate operation:
Evidence:
```
