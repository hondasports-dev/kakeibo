# 運用マニュアル

## 使い方

まず `agents/00-company-coordinator.md` を読み、依頼を分解する。その後、必要なエージェントの指示書を読み、役割ごとに作業を委譲する。

## Codexでの使い方

### 企画から始める場合

```text
virtual-software-company-agents/agents/00-company-coordinator.md を使って、
このアプリ案を企画、設計、実装、QA、レビュー、リリースに分解して。
```

### 市場調査から始める場合

```text
virtual-software-company-agents/agents/01-product-lead.md と
$research-current-market を使って、今作るべきアプリ案を調査して。
```

### 実装だけ頼む場合

```text
virtual-software-company-agents/agents/03-implementer.md を使って、
次の設計に基づいて実装して。
```

### レビューだけ頼む場合

```text
virtual-software-company-agents/agents/05-reviewer.md を使って、
この差分をレビューして。
```

## 並列化の方針

- Product Lead と Tech Lead は、要件が曖昧な間は順番に進める。
- 実装タスクが分離できる場合だけ、Implementer を複数に分ける。
- QA Agent と Reviewer は、実装後に並列で走らせてもよい。
- Release Manager は QA と Reviewer の結果がそろってから使う。

## 注意

このディレクトリは永続的な指示書です。Codexの実行時サブエージェントそのものを常駐させるものではありません。会話中にサブエージェントを使う場合は、ここにある各エージェント指示書をプロンプトとして渡します。
