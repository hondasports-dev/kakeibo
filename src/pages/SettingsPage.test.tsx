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
    groups: {
      addMemberByEmail: "groups.addMemberByEmail",
      getGroupMembers: "groups.getGroupMembers",
      getMyGroup: "groups.getMyGroup",
      removeMember: "groups.removeMember",
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
        if (queryRef.includes("groups.getMyGroup"))
          return {
            _id: "group-001",
            name: "佐藤家",
            role: "owner",
            createdAt: 1000,
          };
        if (queryRef.includes("groups.getGroupMembers"))
          return [
            {
              userId: "user-owner",
              role: "owner",
              displayName: "オーナー",
              email: "owner@example.com",
              createdAt: 1000,
            },
          ];
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

  it("GroupSettingsPanel が含まれている", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "グループ管理", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("佐藤家")).toBeInTheDocument();
  });

  it("WeekDaySettingsPanel が含まれている", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "週の設定", level: 2 })).toBeInTheDocument();
  });
});
