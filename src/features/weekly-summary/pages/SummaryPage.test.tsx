import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { SummaryPage } from "./SummaryPage";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn(() => vi.fn());
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: () => useMutationMock(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ weekStartDate: "2026-06-15" }),
  };
});

describe("SummaryPage", () => {
  beforeEach(() => {
    useQueryMock.mockReturnValue({
      count: 0,
      totalAmountYen: 0,
      totalIncomeYen: 0,
      incomeCount: 0,
      byCategory: [],
      prevWeekTotalAmountYen: null,
      receipts: [],
      incomes: [],
      weeks: [],
    });
  });

  it("振り返りとセッション完了のUIを表示しない", () => {
    renderWithProviders(<SummaryPage />);

    expect(screen.getByRole("heading", { name: "週次サマリー", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "週次振り返り" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "セッションを完了" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("振り返りメモ")).not.toBeInTheDocument();
  });
});
