import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/render";
import { WeekDaySettingsPanel } from "./WeekDaySettingsPanel";

const { useMutationMock, useQueryMock } = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    users: {
      queries: {
        getUserProfile: "users.queries.getUserProfile",
      },
      mutations: {
        updateWeeklyDays: "users.mutations.updateWeeklyDays",
      },
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

describe("WeekDaySettingsPanel", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useQueryMock.mockReturnValue(undefined);
    useMutationMock.mockReturnValue(vi.fn());
  });

  it("プロファイル取得中はローディング状態を表示する", () => {
    useQueryMock.mockReturnValue(undefined);

    renderWithProviders(<WeekDaySettingsPanel />);

    expect(screen.getByText(/設定を読み込んでいます/)).toBeInTheDocument();
  });

  it("初期値が正しく Select に反映される", () => {
    useQueryMock.mockReturnValue({
      monthlyIncome: null,
      weeklyStartDay: 1,
      weeklyEndDay: 0,
    });

    renderWithProviders(<WeekDaySettingsPanel />);

    expect(screen.getByLabelText("週の始まり")).toHaveTextContent("月曜日");
    expect(screen.getByLabelText("週の終わり")).toHaveTextContent("日曜日");
  });

  it("値を変更して保存できる", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    useMutationMock.mockReturnValue(mockUpdate);
    useQueryMock.mockReturnValue({
      monthlyIncome: null,
      weeklyStartDay: 1,
      weeklyEndDay: 0,
    });

    renderWithProviders(<WeekDaySettingsPanel />);

    await userEvent.click(screen.getByLabelText("週の始まり"));
    await userEvent.click(screen.getByRole("option", { name: "火曜日" }));

    await userEvent.click(screen.getByLabelText("週の終わり"));
    await userEvent.click(screen.getByRole("option", { name: "月曜日" }));

    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(mockUpdate).toHaveBeenCalledWith({
      weeklyStartDay: 2,
      weeklyEndDay: 1,
    });
  });

  it("保存中はボタンが無効になる", async () => {
    let resolveMutation: (() => void) | undefined;
    const mockUpdate = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMutation = resolve;
        }),
    );
    useMutationMock.mockReturnValue(mockUpdate);
    useQueryMock.mockReturnValue({
      monthlyIncome: null,
      weeklyStartDay: 1,
      weeklyEndDay: 0,
    });

    renderWithProviders(<WeekDaySettingsPanel />);

    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();

    if (resolveMutation) {
      resolveMutation();
    }
  });
});
