import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { UserSettingsPanel } from "./UserSettingsPanel";

const { updateMonthlyIncomeMock, useMutationMock, useQueryMock } = vi.hoisted(() => ({
  updateMonthlyIncomeMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    users: {
      getUserProfile: "users.getUserProfile",
      updateMonthlyIncome: "users.updateMonthlyIncome",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

describe("UserSettingsPanel", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    updateMonthlyIncomeMock.mockReset();
    updateMonthlyIncomeMock.mockResolvedValue(undefined);
    useQueryMock.mockReturnValue({ monthlyIncome: null });
    useMutationMock.mockImplementation((reference: string) => {
      if (reference === "users.updateMonthlyIncome") return updateMonthlyIncomeMock;
      throw new Error(`Unexpected mutation reference: ${reference}`);
    });
  });

  it("月収入の初期値が表示される（設定済みの場合）", () => {
    // Given: 月収入が300000円に設定されている
    useQueryMock.mockReturnValue({ monthlyIncome: 300000 });

    // When: UserSettingsPanel を表示する
    renderWithProviders(<UserSettingsPanel />);

    // Then: 300000 が入力欄に表示される
    expect(screen.getByLabelText("月収入（円）")).toHaveValue(300000);
  });

  it("月収入が未設定の場合は空欄が表示される", () => {
    // Given: 月収入が未設定
    useQueryMock.mockReturnValue({ monthlyIncome: null });

    // When: UserSettingsPanel を表示する
    renderWithProviders(<UserSettingsPanel />);

    // Then: 入力欄が空
    expect(screen.getByLabelText("月収入（円）")).toHaveValue(null);
  });

  it("入力値を変更できる", async () => {
    // Given: UserSettingsPanelが表示されている
    const user = userEvent.setup();
    renderWithProviders(<UserSettingsPanel />);

    // When: 月収入を入力する
    const input = screen.getByLabelText("月収入（円）");
    await user.clear(input);
    await user.type(input, "200000");

    // Then: 入力値が反映される
    expect(input).toHaveValue(200000);
  });

  it("保存ボタンクリックで updateMonthlyIncome が呼ばれる", async () => {
    // Given: 月収入が入力されている
    const user = userEvent.setup();
    renderWithProviders(<UserSettingsPanel />);
    const input = screen.getByLabelText("月収入（円）");
    await user.clear(input);
    await user.type(input, "300000");

    // When: 保存ボタンをクリックする
    await user.click(screen.getByRole("button", { name: "保存" }));

    // Then: updateMonthlyIncome が 300000 で呼ばれる
    await waitFor(() => {
      expect(updateMonthlyIncomeMock).toHaveBeenCalledWith({ monthlyIncome: 300000 });
    });
  });

  it("クリアボタンクリックで updateMonthlyIncome({ monthlyIncome: null }) が呼ばれる", async () => {
    // Given: 月収入が設定されている
    const user = userEvent.setup();
    useQueryMock.mockReturnValue({ monthlyIncome: 300000 });
    renderWithProviders(<UserSettingsPanel />);

    // When: クリアボタンをクリックする
    await user.click(screen.getByRole("button", { name: "クリア（未設定に戻す）" }));

    // Then: updateMonthlyIncome が null で呼ばれる
    await waitFor(() => {
      expect(updateMonthlyIncomeMock).toHaveBeenCalledWith({ monthlyIncome: null });
    });
  });

  it("負の値を入力するとエラーが表示される", async () => {
    // Given: UserSettingsPanelが表示されている
    const user = userEvent.setup();
    renderWithProviders(<UserSettingsPanel />);
    const input = screen.getByLabelText("月収入（円）");
    await user.clear(input);
    await user.type(input, "-1");

    // When: 保存ボタンをクリックする
    await user.click(screen.getByRole("button", { name: "保存" }));

    // Then: エラーメッセージが表示される
    expect(screen.getByText("月収入は0以上の整数で入力してください")).toBeInTheDocument();
    expect(updateMonthlyIncomeMock).not.toHaveBeenCalled();
  });

  it("サーバーエラーをキャッチして表示する", async () => {
    // Given: サーバーがエラーを返す設定
    const user = userEvent.setup();
    updateMonthlyIncomeMock.mockRejectedValue(new Error("Server error occurred"));
    renderWithProviders(<UserSettingsPanel />);
    const input = screen.getByLabelText("月収入（円）");
    await user.clear(input);
    await user.type(input, "100000");

    // When: 保存ボタンをクリックする
    await user.click(screen.getByRole("button", { name: "保存" }));

    // Then: エラーメッセージが表示される
    await waitFor(() => {
      expect(screen.getByText("Server error occurred")).toBeInTheDocument();
    });
  });
});
