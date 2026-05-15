# 運用マニュアル

## 使い方

Codexでは、まず `$kakeibo-virtual-company` を使って依頼を分解する。

`agents/` 配下はCodexの実行時サブエージェントではなく、役割別プロンプト集である。必要な役割だけを読み、過剰な分業を避ける。

## Codexでの使い方

### 企画から始める場合

```text
$kakeibo-virtual-company を使って、
このアプリ案を企画、設計、実装、QA、レビュー、リリースに分解して。
```

### 市場調査から始める場合

```text
$kakeibo-virtual-company と $research-current-market を使って、
今作るべきアプリ案を調査して。
ユーザーが承認するまで実装には進まないで。
```

### 実装だけ頼む場合

```text
$kakeibo-virtual-company を使って、
次の設計に基づいて実装して。
必要な役割は Implementer を中心にして。
```

### レビューだけ頼む場合

```text
$kakeibo-virtual-company を使って、
この差分をレビューして。
必要な役割は Reviewer を中心にして。
```

## 並列化の方針

- Product Lead と Tech Lead は、要件が曖昧な間は順番に進める。
- 実装タスクが分離できる場合だけ、Implementer を複数に分ける。
- QA Agent と Reviewer は、実装後に並列で走らせてもよい。
- Release Manager は QA と Reviewer の結果がそろってから使う。

## 注意

`agents/` ディレクトリは永続的な指示書であり、Codexの実行時サブエージェントそのものを常駐させるものではない。会話中に役割分担する場合は、`$kakeibo-virtual-company` から必要な指示書だけを参照する。
