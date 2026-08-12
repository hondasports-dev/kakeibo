import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { getCurrentMonth } from "../../../../lib/domain/common/month";
import { renderWithProviders } from "../../../test/render";
import { MonthlySummaryPage } from "./MonthlySummaryPage";

const useQueryMock = vi.hoisted(() => vi.fn());
const useMutationMock = vi.hoisted(() => vi.fn(() => vi.fn()));
const navigateMock = vi.hoisted(() => vi.fn());
const routeMonth = vi.hoisted(() => ({ value: "2026-07" as string | undefined }));

vi.mock("../../../../lib/domain/common/month", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/domain/common/month")>();
  return { ...actual, getCurrentMonth: () => "2026-08" };
});

vi.mock("convex/react", () => ({
  useMutation: () => useMutationMock(),
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ month: routeMonth.value }),
  };
});

describe("MonthlySummaryPage", () => {
  beforeEach(() => {
    routeMonth.value = "2026-07";
    useMutationMock.mockReset();
    useMutationMock.mockImplementation(() => vi.fn());
    useQueryMock.mockImplementation((_query: unknown, args: unknown) => {
      if (args && typeof args === "object" && "month" in args) {
        return {
          byCategory: [
            {
              categoryColor: "#8B5E3C",
              categoryId: "category-food",
              categoryName: "食費",
              count: 1,
              totalAmountYen: 1200,
            },
          ],
          count: 1,
          incomeCount: 1,
          incomes: [
            {
              _id: "income-1",
              amountYen: 50000,
              bankName: "給与口座",
              date: "2026-07-25",
              memo: undefined,
              recordType: "expenseEntry",
              type: "income",
            },
          ],
          netAmountYen: 48800,
          receipts: [
            {
              _id: "expense-1",
              amountYen: 1200,
              categoryColor: "#8B5E3C",
              categoryId: "category-food",
              categoryName: "食費",
              date: "2026-07-10",
              memo: undefined,
              recordType: "expenseEntry",
              shopName: "スーパー",
              type: "expense",
            },
          ],
          totalAmountYen: 1200,
          totalIncomeYen: 50000,
        };
      }
      return [{ _id: "category-food", name: "食費" }];
    });
    navigateMock.mockReset();
  });

  it("月次の収支、カテゴリ、支出・収入一覧を表示する", () => {
    renderWithProviders(
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MonthlySummaryPage />
        </LocalizationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "月次サマリー" })).toBeInTheDocument();
    expect(screen.getByLabelText("支出")).toHaveTextContent("1,200円");
    expect(screen.getByLabelText("収入")).toHaveTextContent("50,000円");
    expect(screen.getByLabelText("差引")).toHaveTextContent("+48,800円");
    expect(screen.getByRole("heading", { name: "支出カテゴリ" })).toBeInTheDocument();
    expect(screen.getByLabelText("月次サマリーの支出一覧")).toBeInTheDocument();
    expect(screen.getByLabelText("月次サマリーの収入一覧")).toBeInTheDocument();
  });

  it("データがない月は支出・収入の空状態を表示する", () => {
    useQueryMock.mockImplementation((_query: unknown, args: unknown) => {
      if (args && typeof args === "object" && "month" in args) {
        return {
          byCategory: [],
          count: 0,
          incomeCount: 0,
          incomes: [],
          netAmountYen: 0,
          receipts: [],
          totalAmountYen: 0,
          totalIncomeYen: 0,
        };
      }
      return [];
    });

    renderWithProviders(
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MonthlySummaryPage />
        </LocalizationProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("この月の支出はまだありません").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("この月の収入はまだありません")).toBeInTheDocument();
  });

  it("月次データの読み込み中はローディングを表示する", () => {
    useQueryMock.mockImplementation((_query: unknown, args: unknown) => {
      if (args && typeof args === "object" && "month" in args) {
        return undefined;
      }
      return [];
    });

    renderWithProviders(
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MonthlySummaryPage />
        </LocalizationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/月次サマリーを読み込んでいます/)).toBeInTheDocument();
  });

  it("月次データの取得失敗時はエラーを表示する", () => {
    useQueryMock.mockImplementation((_query: unknown, args: unknown) => {
      if (args && typeof args === "object" && "month" in args) {
        return null;
      }
      return [];
    });

    renderWithProviders(
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MonthlySummaryPage />
        </LocalizationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("月次サマリーの読み込みに失敗しました。")).toBeInTheDocument();
  });

  it("不正な月URLは当月へ置き換える", async () => {
    routeMonth.value = "2026-13";

    renderWithProviders(
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MonthlySummaryPage />
        </LocalizationProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(`/months/${getCurrentMonth()}`, { replace: true });
    });
  });

  it("前月・次月・今月の操作で安全な月へ遷移する", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MonthlySummaryPage />
        </LocalizationProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "前月へ" }));
    await user.click(screen.getByRole("button", { name: "次月へ" }));
    await user.click(screen.getByRole("button", { name: "今月へ" }));

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/months/2026-06");
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/months/2026-08");
    expect(navigateMock).toHaveBeenNthCalledWith(3, "/months/2026-08");
  });

  it("支出・収入の編集と削除をキャンセルできる", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MonthlySummaryPage />
        </LocalizationProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /スーパー.*を編集$/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /給与口座.*を編集$/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /給与口座.*を削除$/ }));
    expect(screen.getByText("この記録を削除しますか？")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => {
      expect(screen.queryByText("この記録を削除しますか？")).not.toBeInTheDocument();
    });
  });

  it("編集保存後に保存完了メッセージを表示する", async () => {
    const user = userEvent.setup();
    const updateMock = vi.fn().mockResolvedValue(undefined);
    useMutationMock.mockImplementation(() => updateMock);

    renderWithProviders(
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MonthlySummaryPage />
        </LocalizationProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /スーパー.*を編集$/ }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
      expect(screen.getByText("変更を保存しました。")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    });
  });

  it("expenseEntriesの削除成功後に完了メッセージを表示する", async () => {
    const user = userEvent.setup();
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    useMutationMock.mockImplementation(() => deleteMock);

    renderWithProviders(
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MonthlySummaryPage />
        </LocalizationProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole("button", { name: /を削除$/ })[0]);
    await user.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith({ expenseEntryId: "expense-1" });
      expect(screen.getByText("記録を削除しました。")).toBeInTheDocument();
    });
  });

  it("旧レシートの削除失敗時はエラーを表示する", async () => {
    const user = userEvent.setup();
    const deleteMock = vi.fn().mockRejectedValue(new Error("delete failed"));
    useMutationMock.mockImplementation(() => deleteMock);
    useQueryMock.mockImplementation((_query: unknown, args: unknown) => {
      if (args && typeof args === "object" && "month" in args) {
        return {
          byCategory: [],
          count: 1,
          incomeCount: 0,
          incomes: [],
          netAmountYen: -800,
          receipts: [
            {
              _id: "legacy-receipt-1",
              amountYen: 800,
              categoryColor: "#8B5E3C",
              categoryId: "category-food",
              categoryName: "食費",
              date: "2026-07-10",
              memo: undefined,
              recordType: "receipt",
              shopName: "旧レシート",
              type: "expense",
            },
          ],
          totalAmountYen: 800,
          totalIncomeYen: 0,
        };
      }
      return null;
    });

    renderWithProviders(
      <MemoryRouter>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MonthlySummaryPage />
        </LocalizationProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /旧レシート.*を削除$/ }));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith({ receiptId: "legacy-receipt-1" });
      expect(
        screen.getByText("削除に失敗しました。時間をおいて再度お試しください。"),
      ).toBeInTheDocument();
    });
  });
});
