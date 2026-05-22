# 仮想ソフト開発会社エージェント構成

## 結論

小規模なアプリ開発では、常設エージェントは6体で十分です。役割を増やしすぎると、成果物より調整コストが大きくなります。

司令塔として `00-company-coordinator.md` を置き、実作業は以下の6体に分担します。

| エージェント    | 主な責務                                                  | 常時必要 |
| --------------- | --------------------------------------------------------- | -------- |
| Product Lead    | 市場、ユーザー、要件、MVPの整理                           | はい     |
| Tech Lead       | 技術選定、設計、タスク分解                                | はい     |
| Implementer     | 実装、修正、テスト追加                                    | はい     |
| QA Agent        | E2Eテスト設計レビュー、受け入れ確認、回帰確認、不具合整理 | はい     |
| Reviewer        | コードレビュー、保守性、セキュリティ確認                  | はい     |
| Release Manager | リリース準備、変更点、ロールバック方針                    | はい     |

UIが重要なプロダクトだけ `optional-ux-ui-designer.md` を追加で使います。

## 標準フロー

1. Company Coordinator が依頼を分解し、必要なエージェントを選ぶ。
2. Product Lead が目的、対象ユーザー、要件、MVP範囲を決める。
3. Tech Lead が設計、実装方針、作業分解を作る。
4. QA Agent が実装前にE2Eテスト設計をレビューし、必要なら Tech Lead または Product Lead に戻す。
5. Implementer がコード変更とテスト追加を行う。
6. QA Agent が受け入れ条件、画面、API、回帰を確認する。
7. Reviewer が差分をレビューし、重大リスクを指摘する。
8. 問題があれば Implementer、Tech Lead、Product Lead の適切な担当に戻す。
9. Release Manager がリリースノート、デプロイ手順、ロールバックをまとめる。

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
- 実装担当は、設計や要件に曖昧さがある場合、勝手に広げず Tech Lead または Product Lead に戻す。
- QAとReviewerは同じ観点を重複させない。QAは仕様通り動くかとE2Eで確認すべき範囲、Reviewerは品質と保守性を見る。
- リリース前には、未解決リスク、未実施テスト、ロールバック方法を必ず確認する。
