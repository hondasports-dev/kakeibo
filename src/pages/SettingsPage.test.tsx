import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { SettingsPage } from "./SettingsPage";

const { useMutationMock, useQueryMock } = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    categories: {
      createCategory: "categories.createCategory",
      deactivateCategory: "categories.deactivateCategory",
      listForSettings: "categories.listForSettings",
      updateCategory: "categories.updateCategory",
    },
    users: {
      getUserProfile: "users.getUserProfile",
      updateWeeklyDays: "users.updateWeeklyDays",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useMutationMock.mockReturnValue(vi.fn());
    useQueryMock.mockImplementation((queryRef) => {
      if (typeof queryRef === "string") {
        if (queryRef.includes("categories.listForSettings")) return [];
        if (queryRef.includes("users.getUserProfile"))
          return { monthlyIncome: null, weeklyStartDay: 1, weeklyEndDay: 0 };
      }
      return [];
    });
  });

  it("h1 見出し「設定」が表示される", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "設定", level: 1 })).toBeInTheDocument();
  });

  it("CategorySettingsPanel が含まれている", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole("button", { name: "カテゴリを追加" })).toBeInTheDocument();
  });

  it("WeekDaySettingsPanel が含まれている", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "週の設定", level: 2 })).toBeInTheDocument();
  });
});
