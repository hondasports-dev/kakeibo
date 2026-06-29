# Issue #375 Design QA

- source visual truth path: `https://github.com/hondasports/kakeibo/issues/375` の添付参考画像（ローカル比較時: `/tmp/kakeibo-issue-375-reference.png`）
- implementation screenshot path: `docs/assets/issue-375/settings-ledger-pc.png`, `docs/assets/issue-375/settings-ledger-sp.png`
- viewport: Desktop 1280 × 900 / Mobile 390 × 844
- state: owner、カテゴリ8件、グループ管理と危険な操作は初期状態で閉鎖
- full-view comparison evidence: `docs/assets/issue-375/settings-design-comparison.png`
- focused region comparison evidence: 不要。Issue本文を正本とし、添付画像は情報階層の補助資料である。個別コントロールはPC/SP原寸スクリーンショットで確認し、既存MUIと`designTokens`を維持している。

## Findings

P0/P1/P2 の指摘なし。

- Fonts and typography: 既存MUIテーマの書体・ウェイト・見出し階層を維持し、`h1 → h2 → h3`を確認した。
- Spacing and layout rhythm: 単一台帳、セクション区切り、PCの3列行、899px以下の縦積みを確認した。
- Colors and visual tokens: 既存のsurface、border、brand、semantic state tokenを使用している。
- Image quality and asset fidelity: 設定台帳内に画像アセットはない。アイコンは既存MUI Iconsを使用している。
- Copy and content: Issue本文の「概要を常時表示し、編集を必要時に展開」に一致する。参考画像との差は意図した初期状態の変更である。
- Accessibility and responsiveness: 40px以上の操作領域、`aria-expanded`/`aria-controls`、キーボード展開、320/390/900pxの横overflowなしを確認した。

## Patches made since the previous QA pass

- グループ管理を概要行から展開する構成へ変更した。
- 折りたたみ操作へ`aria-controls`を追加した。
- 台帳内ボタンの最小高さを40pxに統一した。
- グループquery/mutationをProviderへ集約した。

## Follow-up Polish

なし。

final result: passed
