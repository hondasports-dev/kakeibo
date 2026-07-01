import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { renderWithProviders } from "../../../test/render";
import { ExpenseEntryForm } from "./ExpenseEntryForm";

const { createExpenseEntriesMock, createIncomeEntryMock, aiExpenseDraftsByStatusQueryMock } =
  vi.hoisted(() => ({
    createExpenseEntriesMock: vi.fn(),
    createIncomeEntryMock: vi.fn(),
    aiExpenseDraftsByStatusQueryMock: vi.fn(),
  }));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    expenseEntries: {
      mutations: {
        createExpenseEntries: "expenseEntries.mutations.createExpenseEntries",
        createIncomeEntry: "expenseEntries.mutations.createIncomeEntry",
      },
    },
    aiExpenseDrafts: {
      mutations: {
        deleteDraft: "aiExpenseDrafts.mutations.deleteDraft",
        registerReadyDrafts: "aiExpenseDrafts.mutations.registerReadyDrafts",
      },
      queries: {
        listByStatus: "aiExpenseDrafts.queries.listByStatus",
      },
    },
    users: {
      mutations: {
        acceptReceiptImageExternalApiConsent:
          "users.mutations.acceptReceiptImageExternalApiConsent",
      },
      queries: {
        getReceiptImageConsent: "users.queries.getReceiptImageConsent",
      },
    },
    receiptAnalysisJobs: {
      queries: {
        listJobs: "receiptAnalysisJobs.queries.listJobs",
      },
      mutations: {
        createBatch: "receiptAnalysisJobs.mutations.createBatch",
        retryImageJob: "receiptAnalysisJobs.mutations.retryImageJob",
        cancelImageJob: "receiptAnalysisJobs.mutations.cancelImageJob",
      },
      actions: {
        analyzeImageJob: "receiptAnalysisJobs.actions.analyzeImageJob",
      },
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (functionRef: string) => {
    if (functionRef === "expenseEntries.mutations.createExpenseEntries") {
      return createExpenseEntriesMock;
    }
    if (functionRef === "expenseEntries.mutations.createIncomeEntry") {
      return createIncomeEntryMock;
    }
    if (functionRef === "aiExpenseDrafts.mutations.deleteDraft") {
      return vi.fn().mockResolvedValue({ deleted: true });
    }
    if (functionRef === "aiExpenseDrafts.mutations.registerReadyDrafts") {
      return vi.fn().mockResolvedValue(undefined);
    }
    if (functionRef === "receiptAnalysisJobs.mutations.createBatch") {
      return vi.fn().mockResolvedValue({ batch: { _id: "batch-1" }, jobs: [] });
    }
    if (functionRef === "receiptAnalysisJobs.mutations.retryImageJob") {
      return vi.fn().mockResolvedValue(undefined);
    }
    if (functionRef === "receiptAnalysisJobs.mutations.cancelImageJob") {
      return vi.fn().mockResolvedValue(undefined);
    }
    if (functionRef === "users.mutations.acceptReceiptImageExternalApiConsent") {
      return vi.fn().mockResolvedValue(undefined);
    }
    return vi.fn().mockResolvedValue(undefined);
  },
  useAction: (functionRef: string) => {
    if (functionRef === "receiptAnalysisJobs.actions.analyzeImageJob") {
      return vi.fn().mockResolvedValue(undefined);
    }
    return vi.fn().mockResolvedValue(undefined);
  },
  useQuery: (functionRef: string, args?: unknown) => {
    if (functionRef === "users.queries.getReceiptImageConsent") {
      return { hasAcceptedExternalApiConsent: true, acceptedAt: 1234567890 };
    }
    if (functionRef === "aiExpenseDrafts.queries.listByStatus") {
      return aiExpenseDraftsByStatusQueryMock(args);
    }
    if (functionRef === "receiptAnalysisJobs.queries.listJobs") {
      return [];
    }
    return undefined;
  },
}));

const categories = [
  { _id: "cat-food" as Id<"categories">, name: "食費", color: "#AAB7C4" },
  { _id: "cat-daily" as Id<"categories">, name: "日用品", color: "#A6B28B" },
];

describe("ExpenseEntryForm", () => {
  beforeEach(() => {
    createExpenseEntriesMock.mockReset();
    createExpenseEntriesMock.mockResolvedValue(undefined);
    createIncomeEntryMock.mockReset();
    createIncomeEntryMock.mockResolvedValue(undefined);
    aiExpenseDraftsByStatusQueryMock.mockReset();
    aiExpenseDraftsByStatusQueryMock.mockReturnValue([]);
  });

  describe("支出・収入切替", () => {
    it("収入では支出専用項目を隠してカテゴリなしで保存する", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.click(screen.getByRole("tab", { name: "収入" }));
      expect(screen.queryByLabelText("店舗名 / 支払先")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "レシートを追加" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "カテゴリ別の内訳を追加" }),
      ).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("金額"), "320000");
      await user.type(screen.getByLabelText("収入の内容・メモ"), "給与");
      await user.click(screen.getByRole("button", { name: "保存して次へ" }));

      await waitFor(() =>
        expect(createIncomeEntryMock).toHaveBeenCalledWith({
          date: "2026-06-02",
          amountYen: 320000,
          title: "給与",
        }),
      );
    });

    it("収入金額のカンマ区切りを正しく保存する", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.click(screen.getByRole("tab", { name: "収入" }));
      await user.type(screen.getByLabelText("金額"), "320,000");
      await user.type(screen.getByLabelText("収入の内容・メモ"), "給与");
      await user.click(screen.getByRole("button", { name: "保存して次へ" }));

      await waitFor(() =>
        expect(createIncomeEntryMock).toHaveBeenCalledWith({
          date: "2026-06-02",
          amountYen: 320000,
          title: "給与",
        }),
      );
      expect(await screen.findByText("収入を保存しました")).toBeInTheDocument();
    });

    it("種別を往復してもそれぞれの未保存入力を保持する", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.click(screen.getByRole("tab", { name: "収入" }));
      await user.type(screen.getByLabelText("収入の内容・メモ"), "賞与");
      await user.click(screen.getByRole("tab", { name: "支出" }));
      expect(screen.getByLabelText("店舗名 / 支払先")).toHaveValue("スーパー北浜");
      await user.click(screen.getByRole("tab", { name: "収入" }));
      expect(screen.getByLabelText("収入の内容・メモ")).toHaveValue("賞与");
    });

    it("収入保存が失敗しても入力値を保持する", async () => {
      createIncomeEntryMock.mockRejectedValueOnce(new Error("保存に失敗しました"));
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "収入" }));
      await user.type(screen.getByLabelText("金額"), "50000");
      await user.type(screen.getByLabelText("収入の内容・メモ"), "立替精算");
      await user.click(screen.getByRole("button", { name: "保存して次へ" }));

      expect(await screen.findByText("保存に失敗しました")).toBeInTheDocument();
      expect(screen.getByLabelText("金額")).toHaveValue("50000");
      expect(screen.getByLabelText("収入の内容・メモ")).toHaveValue("立替精算");
    });
  });

  // ---------------------------------------------------------------------------
  // 単一支出項目モード
  // ---------------------------------------------------------------------------

  describe("単一支出項目モード（デフォルト）", () => {
    it("初期状態で単一モードのフォームが表示される", () => {
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );
      expect(screen.getByLabelText("店舗名 / 支払先")).toBeInTheDocument();
      expect(screen.getByLabelText("合計金額")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "保存して次へ" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "カテゴリ別の内訳を追加" })).toBeInTheDocument();
    });

    it("店舗名・金額・カテゴリを入力して単一項目を保存できる", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.type(screen.getByLabelText("合計金額"), "4280");
      // 食費はデフォルト選択済みのため "食費 選択中" として取得
      await user.click(screen.getByRole("option", { name: /食費/ }));
      await user.click(screen.getByRole("button", { name: "保存して次へ" }));

      await waitFor(() => {
        expect(createExpenseEntriesMock).toHaveBeenCalledWith(
          expect.objectContaining({
            date: "2026-06-02",
            items: [
              expect.objectContaining({
                categoryId: "cat-food",
                amountYen: 4280,
                title: "スーパー北浜",
              }),
            ],
          }),
        );
      });
    });

    it("店舗名が空の場合、保存せずエラーを表示する", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("合計金額"), "1000");
      await user.click(screen.getByRole("button", { name: "保存して次へ" }));

      expect(createExpenseEntriesMock).not.toHaveBeenCalled();
      expect(await screen.findByText("店舗名 / 支払先は必須です")).toBeInTheDocument();
    });

    it("金額が空の場合、保存せずエラーを表示する", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.click(screen.getByRole("button", { name: "保存して次へ" }));

      expect(createExpenseEntriesMock).not.toHaveBeenCalled();
      expect(await screen.findByText("金額は必須です")).toBeInTheDocument();
    });

    it("保存成功後、店舗名・金額をクリアして次の入力へ進める", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.type(screen.getByLabelText("合計金額"), "2000");
      await user.click(screen.getByRole("option", { name: /食費/ }));
      await user.click(screen.getByRole("button", { name: "保存して次へ" }));

      await waitFor(() => {
        expect(screen.getByLabelText("店舗名 / 支払先")).toHaveValue("");
        // 金額はクリア後に "" になる
        const amountInput = screen.getByLabelText("合計金額") as HTMLInputElement;
        expect(amountInput.value).toBe("");
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 複数支出項目モード
  // ---------------------------------------------------------------------------

  describe("複数支出項目モード", () => {
    it("「カテゴリ別の内訳を追加」ボタンで複数項目モードに切り替わる", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.type(screen.getByLabelText("合計金額"), "5000");
      await user.click(screen.getByRole("button", { name: "カテゴリ別の内訳を追加" }));

      expect(screen.getByText("入力元合計")).toBeInTheDocument();
      expect(screen.getByText("5,000")).toBeInTheDocument();
      expect(screen.getByLabelText("差額")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "項目を追加" })).toBeInTheDocument();
    });

    it("複数支出項目を入力して保存できる", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      // 入力元情報
      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.type(screen.getByLabelText("合計金額"), "5000");
      await user.click(screen.getByRole("button", { name: "カテゴリ別の内訳を追加" }));

      // 複数項目モード: 項目1（タイトルはhookがshopNameを引き継ぐので上書き）
      const item1 = screen.getByTestId("expense-item-0");
      await user.clear(within(item1).getByLabelText("内容"));
      await user.type(within(item1).getByLabelText("内容"), "食料品");
      await user.type(within(item1).getByLabelText("金額"), "3000");
      // デフォルト選択済みの場合 /食費/ でマッチ
      await user.click(within(item1).getByRole("option", { name: /食費/ }));

      // 項目追加
      await user.click(screen.getByRole("button", { name: "項目を追加" }));

      // 項目2
      const item2 = screen.getByTestId("expense-item-1");
      await user.type(within(item2).getByLabelText("内容"), "日用品");
      await user.type(within(item2).getByLabelText("金額"), "2000");
      await user.click(within(item2).getByRole("option", { name: /日用品/ }));

      // 差額0円を確認して保存
      expect(screen.getByLabelText("差額")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "保存して次へ" }));

      await waitFor(() => {
        expect(createExpenseEntriesMock).toHaveBeenCalledWith(
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ categoryId: "cat-food", amountYen: 3000, title: "食料品" }),
              expect.objectContaining({
                categoryId: "cat-daily",
                amountYen: 2000,
                title: "日用品",
              }),
            ]),
          }),
        );
      });
    });

    it("差額がマイナスの場合、保存ボタンが無効化される", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.type(screen.getByLabelText("合計金額"), "3000");
      await user.click(screen.getByRole("button", { name: "カテゴリ別の内訳を追加" }));

      const item1 = screen.getByTestId("expense-item-0");
      await user.clear(within(item1).getByLabelText("内容"));
      await user.type(within(item1).getByLabelText("内容"), "食料品");
      await user.type(within(item1).getByLabelText("金額"), "5000");
      await user.click(within(item1).getByRole("option", { name: /食費/ }));

      // 差額がマイナスのため保存ボタンが無効
      const saveButton = screen.getByRole("button", { name: "保存して次へ" });
      expect(saveButton).toBeDisabled();
      expect(screen.getByText(/超過/)).toBeInTheDocument();
    });

    it("差額がプラスの場合、確認ダイアログが表示される", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.type(screen.getByLabelText("合計金額"), "5000");
      await user.click(screen.getByRole("button", { name: "カテゴリ別の内訳を追加" }));

      const item1 = screen.getByTestId("expense-item-0");
      await user.clear(within(item1).getByLabelText("内容"));
      await user.type(within(item1).getByLabelText("内容"), "食料品");
      await user.type(within(item1).getByLabelText("金額"), "3000");
      await user.click(within(item1).getByRole("option", { name: /食費/ }));

      // 差額500円プラス → 確認ダイアログ
      await user.click(screen.getByRole("button", { name: "保存して次へ" }));

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toBeInTheDocument();
      // ダイアログ内に「未配分」が少なくとも1件存在することを確認
      expect(within(dialog).getAllByText(/未配分/).length).toBeGreaterThan(0);
    });

    it("確認ダイアログで「このまま保存」を選ぶと保存される", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.type(screen.getByLabelText("合計金額"), "5000");
      await user.click(screen.getByRole("button", { name: "カテゴリ別の内訳を追加" }));

      const item1 = screen.getByTestId("expense-item-0");
      await user.clear(within(item1).getByLabelText("内容"));
      await user.type(within(item1).getByLabelText("内容"), "食料品");
      await user.type(within(item1).getByLabelText("金額"), "3000");
      await user.click(within(item1).getByRole("option", { name: /食費/ }));

      await user.click(screen.getByRole("button", { name: "保存して次へ" }));
      await screen.findByRole("dialog");
      await user.click(screen.getByRole("button", { name: "このまま保存" }));

      await waitFor(() => {
        expect(createExpenseEntriesMock).toHaveBeenCalledTimes(1);
      });
    });

    it("項目を削除できる", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.type(screen.getByLabelText("合計金額"), "5000");
      await user.click(screen.getByRole("button", { name: "カテゴリ別の内訳を追加" }));
      await user.click(screen.getByRole("button", { name: "項目を追加" }));

      // 2項目存在する
      expect(screen.getByTestId("expense-item-0")).toBeInTheDocument();
      expect(screen.getByTestId("expense-item-1")).toBeInTheDocument();

      // 2項目目を削除
      await user.click(
        within(screen.getByTestId("expense-item-1")).getByRole("button", { name: "削除" }),
      );

      // 1項目だけ残る
      expect(screen.getByTestId("expense-item-0")).toBeInTheDocument();
      expect(screen.queryByTestId("expense-item-1")).not.toBeInTheDocument();
    });

    it("保存後に複数項目モードが解除されて通常モードに戻る", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ExpenseEntryForm
          weekStartDate="2026-06-02"
          weekEndDate="2026-06-08"
          categories={categories}
        />,
      );

      await user.type(screen.getByLabelText("店舗名 / 支払先"), "スーパー北浜");
      await user.type(screen.getByLabelText("合計金額"), "2000");
      await user.click(screen.getByRole("button", { name: "カテゴリ別の内訳を追加" }));

      const item1 = screen.getByTestId("expense-item-0");
      await user.clear(within(item1).getByLabelText("内容"));
      await user.type(within(item1).getByLabelText("内容"), "食料品");
      await user.type(within(item1).getByLabelText("金額"), "2000");
      await user.click(within(item1).getByRole("option", { name: /食費/ }));

      await user.click(screen.getByRole("button", { name: "保存して次へ" }));

      await waitFor(() => {
        // 複数項目モードが解除され、通常フォームに戻る
        expect(screen.queryByText("入力元合計")).not.toBeInTheDocument();
        expect(screen.getByLabelText("店舗名 / 支払先")).toHaveValue("");
      });
    });
  });
});
