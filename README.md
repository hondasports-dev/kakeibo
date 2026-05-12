# 仮想ソフト開発会社エージェント

## これは何か

Codexにソフトウェア開発を依頼するとき、企画、設計、実装、QA、レビュー、リリースを役割分担して進めるためのエージェント指示書です。

実行時に常駐するエージェントではなく、Codexへ渡すための役割別プロンプト集として使います。

## まず読むファイル

- `COMPANY.md`: 全体構成と役割分担
- `OPERATING_MANUAL.md`: 実際の使い方
- `agents/00-company-coordinator.md`: 依頼を分解する司令塔

初めて使う場合は、まず `agents/00-company-coordinator.md` を指定してください。

## 基本の使い方

Codexに次のように依頼します。

```text
virtual-software-company-agents/agents/00-company-coordinator.md を使って、
「作りたいものや解決したい課題」を、企画、設計、実装、QA、レビュー、リリースに分解して。
必要なエージェントごとの依頼文も作って。
```

例:

```text
virtual-software-company-agents/agents/00-company-coordinator.md を使って、
「個人開発で作れる習慣化アプリ」を、企画、設計、実装、QA、レビュー、リリースに分解して。
必要なエージェントごとの依頼文も作って。
```

## 市場調査から開発まで自動で進めたい場合

アプリ案がまだ決まっていない場合は、`workflows/market-to-build.md` を使います。

このワークフローは、市場調査と壁打ちを先に行い、ユーザーが「この案で進める」と明示するまで実装に進みません。承認後に、開発用エージェントへ作業を分解します。

```text
virtual-software-company-agents/workflows/market-to-build.md を使って進めて。

興味領域:
個人開発で作れるWebアプリ

制約:
1人で開発、まずは2週間でMVP、できれば課金余地があるもの

まず市場調査と壁打ちから始めて。
私が「この案で進める」と言うまで実装には進まないで。
```

作る案が決まったら、次のように伝えます。

```text
この案で進める。
Tech Lead、必要ならUX/UI Designer、Implementer、QA Agent、Reviewer、Release Managerを使って、
開発からリリース準備まで進めて。
```

## 市場調査から始める

アプリ案がまだ曖昧な場合は、Product Lead と市場調査スキルを使います。

```text
virtual-software-company-agents/agents/01-product-lead.md と
$research-current-market を使って、
2026年時点で個人開発しやすいアプリ市場を調べて。
上位3案と、最初に作るべき1案を出して。
```

## 要件定義から始める

作りたいものが決まっている場合は、Product Lead に要件を整理させます。

```text
virtual-software-company-agents/agents/01-product-lead.md を使って、
「AI日記アプリ」の対象ユーザー、解く課題、MVP機能、作らない機能、成功指標を整理して。
```

## 技術設計に進める

要件が固まったら、Tech Lead に設計へ落とし込ませます。

```text
virtual-software-company-agents/agents/02-tech-lead.md を使って、
Product Lead が整理したMVP要件を、技術構成、DB設計、画面構成、実装タスク、テスト方針に分解して。
```

## 実装を依頼する

設計がある場合は、Implementer に担当範囲を明確に渡します。

```text
virtual-software-company-agents/agents/03-implementer.md を使って、
Tech Lead の設計に基づいて実装して。
担当範囲はログイン不要のMVP画面とローカル保存まで。
```

## QAを依頼する

実装後に、仕様どおり動くか確認させます。

```text
virtual-software-company-agents/agents/04-qa-agent.md を使って、
今回の変更が要件どおりに動くか確認して。
不具合があれば再現手順つきで報告して。
```

## レビューを依頼する

コード品質、保守性、セキュリティを確認させます。

```text
virtual-software-company-agents/agents/05-reviewer.md を使って、
今回の変更差分をレビューして。
バグ、セキュリティ、保守性、テスト不足を優先して見て。
```

## リリース準備を依頼する

QAとレビューが通ったら、Release Manager にまとめさせます。

```text
virtual-software-company-agents/agents/06-release-manager.md を使って、
今回の変更について、リリースノート、デプロイ手順、リリース前後チェック、ロールバック方針を作って。
```

## UIが重要な場合

画面体験が重要なアプリでは、任意でUX/UI Designerを追加します。

```text
virtual-software-company-agents/agents/optional-ux-ui-designer.md を使って、
このアプリのユーザーフロー、画面構成、UI状態、コンポーネント方針を設計して。
```

## おすすめの進め方

新規アプリなら、次の順番が基本です。

1. `Company Coordinator`: 依頼を分解する
2. `Product Lead`: 要件とMVPを決める
3. `Tech Lead`: 技術設計に落とす
4. `Implementer`: 実装する
5. `QA Agent`: 仕様どおり動くか確認する
6. `Reviewer`: 品質とリスクを確認する
7. `Release Manager`: リリース準備をする

小さい修正なら、全部使う必要はありません。実装だけなら `Implementer`、レビューだけなら `Reviewer`、市場調査だけなら `Product Lead` と `$research-current-market` から始めてください。

## 注意

- 役割を増やしすぎると、調整コストが増えます。
- 最初は `Company Coordinator` に分解させ、必要なエージェントだけ使ってください。
- 実装担当に曖昧な要件を渡すと、手戻りが増えます。
- QAは仕様どおり動くか、Reviewerはコード品質を見る役割です。
