import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useActionMock } = vi.hoisted(() => ({ useActionMock: vi.fn() }));
vi.mock("convex/react", () => ({ useAction: useActionMock }));

import { SystemAdminGroupSearchPage } from "./SystemAdminGroupSearchPage";

describe("SystemAdminGroupSearchPage", () => {
  const actionMock = vi.fn();

  beforeEach(() => {
    actionMock.mockReset();
    actionMock.mockResolvedValue({
      environment: "preview",
      page: [
        {
          id: "group-document-1",
          name: "対象グループ",
          status: "active",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      isDone: true,
      continueCursor: "",
    });
    useActionMock.mockReturnValue(actionMock);
  });

  it("検索条件が未入力でも条件なし検索を実行する", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SystemAdminGroupSearchPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "検索" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(await screen.findByText("対象グループ")).toBeInTheDocument();
    expect(actionMock).toHaveBeenCalledWith({
      queryType: "name",
      query: "",
      paginationOpts: { numItems: 20, cursor: null },
    });
  });
});
