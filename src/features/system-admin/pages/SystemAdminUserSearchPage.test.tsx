import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useActionMock } = vi.hoisted(() => ({ useActionMock: vi.fn() }));
vi.mock("convex/react", () => ({ useAction: useActionMock }));

import { SystemAdminUserSearchPage } from "./SystemAdminUserSearchPage";

describe("SystemAdminUserSearchPage", () => {
  const actionMock = vi.fn();

  beforeEach(() => {
    actionMock.mockReset();
    actionMock.mockResolvedValue({
      environment: "preview",
      page: [
        {
          id: "user-document-1",
          userId: "target-user",
          displayName: "対象ユーザー",
          email: "target@example.test",
          activeGroupId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      isDone: true,
      continueCursor: "",
    });
    useActionMock.mockReturnValue(actionMock);
  });

  it("検索 actionを使い、管理情報だけの結果を表示する", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SystemAdminUserSearchPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("textbox", { name: "ユーザー検索" }), "対象");
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(await screen.findByText("対象ユーザー")).toBeInTheDocument();
    expect(screen.getByText("target@example.test")).toBeInTheDocument();
    expect(screen.queryByText(/金額|支出|収入|レシート/)).not.toBeInTheDocument();
    expect(actionMock).toHaveBeenCalledWith({
      queryType: "displayName",
      query: "対象",
      paginationOpts: { numItems: 20, cursor: null },
    });
  });

  it("検索条件が未入力でも条件なし検索を実行する", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SystemAdminUserSearchPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "検索" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(await screen.findByText("対象ユーザー")).toBeInTheDocument();
    expect(actionMock).toHaveBeenCalledWith({
      queryType: "displayName",
      query: "",
      paginationOpts: { numItems: 20, cursor: null },
    });
  });
});
