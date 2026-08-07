# 仮想ソフト開発会社エージェント構成

## 結論

小規模なアプリ開発では、常設エージェントは6体で十分です。役割を増やしすぎると、成果物より調整コストが大きくなります。

Codex Plan モードでは Main が `00-company-coordinator.md` と `02-tech-lead.md` を参照して司令塔と技術判断を兼務し、実作業は必要な役割へ分担します。

| エージェント | 主な責務 | 利用条件 |
| --- | --- | --- |
| Product Lead | 市場、ユーザー、要件、MVPの整理 | `full` で必須、`light` で省略 |
| Tech Lead | 技術選定、設計、タスク分解 | Mainが兼務し `full` / `light` とも必須 |
| Implementer | 実装、修正、テスト追加 | 実装がある場合 |
| QA Agent | 論理read-onlyでのE2E設計・結果確認、不具合整理 | `full` / `light` とも必須 |
| Reviewer | コードレビュー、保守性、セキュリティ確認 | 実装差分のレビュー時 |
| Release Manager | リリース準備、変更点、ロールバック方針 | release / deploy / rollback / 本番影響がある場合のみ |

UI変更を含む作業だけ `optional-ux-ui-designer.md` を追加で使います。

## 標準フロー

1. Main が Company Coordinator として `full` / `light` を決め、必要な役割を選ぶ。
2. `full` では Product Lead A/B/C が要件を評価する。`light` では省略する。
3. UI変更時だけ UX/UI Designer が評価する。
4. QA Agent がE2E方針を評価する。
5. そのmodeで必須の対象Roleがすべて `approved` になった後、Main が Tech Lead として設計、実装方針、Implementation Handoff を作る。
6. 原則1体の Implementer がコード変更とテスト追加を行う。
7. Main が Handoff と実差分の integrity check を行い、違反時は同じ Implementer へ返す。
8. QA Agent が受け入れ条件、画面、API、回帰を確認する。
9. 論理 read-only の Reviewer が差分をレビューし、重大リスクを指摘する。
10. 問題があれば Implementer、Main、Product Lead の適切な担当に戻す。
11. release / deploy / rollback / 本番影響がある場合だけ Release Manager を使う。

## 使わない方がよい常設役割

| 役割                  | 理由                                              |
| --------------------- | ------------------------------------------------- |
| Scrum Master          | Codex中心の依頼では進行管理が重くなりやすい       |
| 専任UX Researcher     | 初期MVPでは Product Lead に統合できる             |
| 専任Security Engineer | 高リスク領域以外は Reviewer に統合できる          |
| 専任SRE               | 本番運用が重くなるまでは Release Manager で足りる |
| Data Analyst          | KPI設計や分析基盤が必要になるまで不要             |
| Documentation Writer  | Product Lead と Release Manager で分担できる      |

## 運用ルール

- 各エージェントは、自分の責務外の作業を抱え込まず、必要な引き継ぎを明示する。
- 実装担当は、設計や要件に曖昧さがある場合、勝手に広げず Main（Tech Leadロール）へ返す。ユーザー価値の判断が必要ならMainがProduct Leadまたはユーザー確認へ戻す。
- QAとReviewerは論理read-onlyとし、同じ観点を重複させない。QAは仕様通り動くかとE2Eで確認すべき範囲、Reviewerは品質と保守性を見る。
- リリース前には、未解決リスク、未実施テスト、ロールバック方法を必ず確認する。
- `.codex/agents/*.toml` は使わず、役割と手順は `AGENTS.md`、`.agents/skills/**`、`.agents/roles/**` を正本とする。
