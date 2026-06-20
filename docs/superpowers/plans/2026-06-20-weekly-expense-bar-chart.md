# 週別支出推移 BarChart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 週次サマリーの日別折れ線グラフを、対象週と直前2週間を比較できるMUI X ChartsのBarChartへ置き換える。

**Architecture:** 既存の `getFourWeeksSummary` queryを再利用し、4週分の合計を純粋関数で表示用3週へ変換する。計算と文言生成はutilityへ寄せ、`WeeklyTrendChart` は要約、状態表示、BarChart描画だけを担当する。

**Tech Stack:** React 19、TypeScript、MUI 9、`@mui/x-charts`、Vitest、Testing Library、Playwright

---

### Task 1: 週別表示データの生成

**Files:**
- Create: `src/features/weekly-summary/utils/weeklyExpenseChartData.ts`
- Create: `src/features/weekly-summary/utils/weeklyExpenseChartData.test.ts`

- [ ] **Step 1: 失敗するデータ整形テストを書く**

`buildWeeklyExpenseChartData` の望ましいAPIを先にテストへ記述する。4週を古い順で渡し、戻り値が新しい3週だけであること、現在週ラベル、前週差、直前2週平均比、Tooltip文言を検証する。

```ts
const result = buildWeeklyExpenseChartData({
  currentWeekStartDate: "2026-06-15",
  targetWeekStartDate: "2026-06-15",
  weeks: [
    { weekStartDate: "2026-05-25", totalAmountYen: 8_000 },
    { weekStartDate: "2026-06-01", totalAmountYen: 10_000 },
    { weekStartDate: "2026-06-08", totalAmountYen: 12_000 },
    { weekStartDate: "2026-06-15", totalAmountYen: 15_000 },
  ],
});

expect(result.map((item) => item.label)).toEqual(["2週前", "先週", "今週"]);
expect(result[2]).toMatchObject({
  amount: 15_000,
  previousDiff: 3_000,
  averageDiff: 4_000,
  averageRate: 36,
});
expect(formatWeeklyExpenseTooltip(result[2])).toContain("6/15〜6/21");
expect(formatWeeklyExpenseTooltip(result[2])).toContain("前週差 +3,000円");
```

- [ ] **Step 2: REDを確認する**

Run: `pnpm test --run src/features/weekly-summary/utils/weeklyExpenseChartData.test.ts`

Expected: moduleまたはexportが存在しない理由でFAIL。

- [ ] **Step 3: 最小実装を書く**

次の公開型と関数を実装する。

```ts
export type WeeklyExpenseChartItem = {
  weekStartDate: string;
  weekEndDate: string;
  label: string;
  amount: number;
  previousDiff: number | null;
  averageDiff: number | null;
  averageRate: number | null;
};

export function buildWeeklyExpenseChartData(args: {
  weeks: Array<{ weekStartDate: string; totalAmountYen: number }>;
  targetWeekStartDate: string;
  currentWeekStartDate: string;
}): WeeklyExpenseChartItem[];

export function formatWeeklyExpenseTooltip(item: WeeklyExpenseChartItem): string;
```

平均は対象週より前の最大2週から計算し、平均0円なら `averageDiff` と `averageRate` を `null` にする。過去週閲覧時は全ラベルを `M/D週` にする。

- [ ] **Step 4: GREENと境界値を確認する**

Run: `pnpm test --run src/features/weekly-summary/utils/weeklyExpenseChartData.test.ts`

Expected: PASS。追加で、4週未満、全週0円、過去週ラベル、平均0円を個別テストにする。

- [ ] **Step 5: utilityをコミットする**

```bash
git add src/features/weekly-summary/utils/weeklyExpenseChartData.ts src/features/weekly-summary/utils/weeklyExpenseChartData.test.ts
git commit -m "feat: 週別支出の比較値を一貫して算出する"
```

### Task 2: BarChartコンポーネントへ置換

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/features/weekly-summary/components/WeeklyTrendChart.tsx`
- Modify: `src/features/weekly-summary/components/WeeklyTrendChart.test.tsx`

- [ ] **Step 1: 依存を追加する**

Run: `pnpm add @mui/x-charts`

Expected: `package.json` と `pnpm-lock.yaml` にCommunity版が追加される。

- [ ] **Step 2: 失敗するコンポーネントテストを書く**

propsを `items?: WeeklyExpenseChartItem[]` に変更し、次をテストする。

```tsx
renderWithProviders(<WeeklyTrendChart items={items} />);
expect(screen.getByText("対象週の支出")).toBeInTheDocument();
expect(screen.getByText("15,000円")).toBeInTheDocument();
expect(screen.getByText("+3,000円")).toBeInTheDocument();
expect(screen.getByText("+36%")).toBeInTheDocument();
expect(screen.getByRole("img", { name: "週別支出推移グラフ" })).toBeInTheDocument();
```

空配列では `週別の支出データがあると表示されます`、`isLoading` ではSkeletonが表示されることも先にテストする。

- [ ] **Step 3: REDを確認する**

Run: `pnpm test --run src/features/weekly-summary/components/WeeklyTrendChart.test.tsx`

Expected: 旧propsと旧SVG実装のためFAIL。

- [ ] **Step 4: BarChartを最小実装する**

`BarChart` は次の構成にする。

```tsx
<Box aria-label="週別支出推移グラフ" role="img">
  <BarChart
    dataset={items}
    height={220}
    hideLegend
    margin={{ left: 8, right: 8, top: 16, bottom: 8 }}
    series={[{
      dataKey: "amount",
      label: "支出合計",
      valueFormatter: (_value, context) => formatWeeklyExpenseTooltip(items[context.dataIndex]),
    }]}
    skipAnimation
    xAxis={[{ dataKey: "label", scaleType: "band" }]}
    yAxis={[{ valueFormatter: (value: number) => `${Math.round(value / 1000)}千円`, width: 44 }]}
  />
</Box>
```

上部要約はMUI `Stack` と `Typography` で通常テキストとして表示し、平均比較不能時は `比較データなし` とする。

- [ ] **Step 5: GREENを確認する**

Run: `pnpm test --run src/features/weekly-summary/components/WeeklyTrendChart.test.tsx`

Expected: PASS。テスト環境でResizeObserver警告が出る場合は既存test setupへ最小のpolyfillを追加する。

- [ ] **Step 6: コンポーネントをコミットする**

```bash
git add package.json pnpm-lock.yaml src/features/weekly-summary/components/WeeklyTrendChart.tsx src/features/weekly-summary/components/WeeklyTrendChart.test.tsx
git commit -m "feat: 週ごとの支出差を棒グラフで把握できるようにする"
```

### Task 3: 週次サマリーへ接続して日別比較を除去

**Files:**
- Modify: `src/features/weekly-summary/pages/SummaryPage.tsx`
- Modify: `src/features/weekly-summary/components/WeeklySummaryPanel.tsx`
- Modify: `src/features/weekly-summary/components/WeeklySummaryPanel.test.tsx`
- Modify: `src/features/weekly-summary/types/types.ts`
- Delete: `src/features/weekly-summary/components/DailyComparisonDialog.tsx`
- Delete: `src/features/weekly-summary/hooks/useDailyComparison.ts`

- [ ] **Step 1: 失敗する接続テストを書く**

`WeeklySummaryPanel` に `weeklyExpenseTrend={items}` を渡したとき要約とグラフが表示され、`null` ではセクションなし、`undefined` では読込状態になるテストへ更新する。

- [ ] **Step 2: REDを確認する**

Run: `pnpm test --run src/features/weekly-summary/components/WeeklySummaryPanel.test.tsx`

Expected: 新propsが存在しない理由でFAIL。

- [ ] **Step 3: queryと表示を接続する**

`SummaryPage` で次を行う。

```ts
const fourWeeksSummary = useQuery(api.receipts.getFourWeeksSummary, { weekStartDate });
const weeklyExpenseTrend =
  fourWeeksSummary === undefined
    ? undefined
    : buildWeeklyExpenseChartData({
        weeks: fourWeeksSummary.weeks,
        targetWeekStartDate: weekStartDate,
        currentWeekStartDate,
      });
```

`WeeklySummaryPanel` は `weeklyExpenseTrend` を `WeeklyTrendChart` へ渡すだけにし、`dailySpendingTrend`、`useDailyComparison`、`DailyComparisonDialog` を除去する。

- [ ] **Step 4: GREENと関連テストを確認する**

Run: `pnpm test --run src/features/weekly-summary/components/WeeklySummaryPanel.test.tsx src/features/weekly-summary/components/WeeklyTrendChart.test.tsx`

Expected: PASS。

- [ ] **Step 5: 接続変更をコミットする**

```bash
git add src/features/weekly-summary
git commit -m "refactor: 週次サマリーを週単位の比較へ切り替える"
```

### Task 4: 正本ドキュメントとE2Eを新仕様へ更新

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/technical-design.md`
- Modify: `docs/ui-ux-design.md`
- Modify: `docs/qa-checklist.md`
- Modify: `e2e/receipt-form.spec.ts`

- [ ] **Step 1: E2Eの期待値を先に変更する**

Issue #47/#82 の日別折れ線、`circle`、比較Dialog前提を削除し、次を確認する。

```ts
await expect(page.getByRole("heading", { name: "週別支出推移" })).toBeVisible();
await expect(
  page
    .getByRole("img", { name: "週別支出推移グラフ" })
    .or(page.getByText("週別の支出データがあると表示されます")),
).toBeVisible();
await expect(page.getByText("対象週の支出")).toBeVisible();
```

- [ ] **Step 2: 正本ドキュメントを更新する**

日別折れ線・クリックDialogの記述を、直近3週間BarChart・対象週要約・Tooltipへ置換する。`getFourWeeksSummary` の4週目は比較計算専用であること、schema・認可変更なしを明記する。

- [ ] **Step 3: 対象E2Eを実行する**

Run: `pnpm exec playwright test e2e/receipt-form.spec.ts --project=chromium --grep "週別支出推移"`

Expected: PASS。環境不足の場合は不足条件と未確認リスクを記録する。

- [ ] **Step 4: docsとE2Eをコミットする**

```bash
git add docs/requirements.md docs/technical-design.md docs/ui-ux-design.md docs/qa-checklist.md e2e/receipt-form.spec.ts
git commit -m "docs: 週別支出グラフの受け入れ条件を新仕様へ揃える"
```

### Task 5: 全体検証とpush前レビュー

**Files:**
- Review: Issue #232 に属する全差分

- [ ] **Step 1: Push前検証を並列実行する**

Run: `pnpm test --run & pnpm run lint & pnpm run format:check & pnpm run build & wait`

Expected: すべてexit code 0。

- [ ] **Step 2: ユーザー導線のE2Eを実行する**

Run: `pnpm exec playwright test e2e/receipt-form.spec.ts --project=chromium --grep "週別支出推移"`

Expected: PASS。

- [ ] **Step 3: 必須レビューを実行する**

`.agents/skills/code-review/SKILL.md` の手順とfrontend/security checklist、QA Agent、`vercel-react-best-practices` を適用する。利用可能な `web-design-guidelines` Skillがない場合は、`docs/ui-ux-design.md` のアクセシビリティ・モバイル基準で代替し、その旨を記録する。

- [ ] **Step 4: Must-fixを0件にする**

Must-fixがあれば修正し、Task 5 Step 1から再実行する。最終差分に `git diff --check` を実行する。

- [ ] **Step 5: pushとドラフトPR作成後にCIを監視する**

ブランチをpushし、Issue #232をcloseするドラフトPRを作成する。push後は対象runを `gh run watch <run_id> --exit-status` で監視し、全必須チェックが成功するまで対応する。
