import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../../../test/render";
import { UserMenu } from "./UserMenu";

const { useClerkMock, useUserMock } = vi.hoisted(() => ({
  useClerkMock: vi.fn(),
  useUserMock: vi.fn(),
}));

vi.mock("@clerk/react", () => ({
  useClerk: useClerkMock,
  useUser: useUserMock,
}));

describe("UserMenu", () => {
  it("ユーザーメニューに /updates への「更新履歴」リンクを表示する", async () => {
    const user = userEvent.setup();
    useClerkMock.mockReturnValue({
      openUserProfile: vi.fn(),
      signOut: vi.fn(),
    });
    useUserMock.mockReturnValue({ user: null });

    renderWithProviders(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "ユーザーメニューを開く" }));

    const link = screen.getByRole("menuitem", { name: "更新履歴" });
    expect(link).toHaveAttribute("href", "/updates");
  });
});
