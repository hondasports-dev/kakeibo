import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

const useQueryMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("../hooks/useWeekSession", () => ({
  useWeekSession: vi.fn(),
}));

vi.mock("../../ui", () => ({
  AnimatedCounter: ({ suffix, value }: { suffix?: string; value: number }) => (
    <span>{`${value.toLocaleString("ja-JP")}${suffix ?? ""}`}</span>
  ),
  SuzumemoLoadingState: () => <div data-testid="loading">loading</div>,
}));

vi.mock("../components/WeekComparisonChart", () => ({
  WeekComparisonChart: () => <div data-testid="week-comparison-chart" />,
}));

import { useWeekSession } from "../hooks/useWeekSession";

const useWeekSessionMock = vi.mocked(useWeekSession);

describe("DashboardPage", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useWeekSessionMock.mockReturnValue({
      sessionError: "",
      setWeekSession: vi.fn(),
      weekSession: {
        status: "draft",
        weekEndDate: "2026-06-21",
        weekStartDate: "2026-06-15",
      },
    });
  });

  it("セッション読み込み中はローディングを表示する", () => {
    useWeekSessionMock.mockReturnValue({
      sessionError: "",
      setWeekSession: vi.fn(),
      weekSession: null,
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("セッションエラー時はエラーを表示する", () => {
    useWeekSessionMock.mockReturnValue({
      sessionError: "週次セッションの初期化に失敗しました。",
      setWeekSession: vi.fn(),
      weekSession: null,
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("週次セッションの初期化に失敗しました。")).toBeInTheDocument();
  });

  it("サマリー取得後に主要セクションを表示する", () => {
    useQueryMock.mockReturnValue({
      byCategory: [],
      count: 3,
      prevWeekTotalAmountYen: 7000,
      totalAmountYen: 6280,
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "今週のダッシュボード" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "支出カテゴリ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "今週の入力" })).toBeInTheDocument();
    expect(screen.getByTestId("week-comparison-chart")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "入力を再開" })).toBeInTheDocument();
  });
});
