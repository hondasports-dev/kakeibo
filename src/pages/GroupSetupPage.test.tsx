import { MemoryRouter } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { GroupSetupPage } from "./GroupSetupPage";

const { createGroupMock, seedDefaultCategoriesMock, useMutationMock, useQueryMock, useAuthMock } =
  vi.hoisted(() => ({
    createGroupMock: vi.fn(),
    seedDefaultCategoriesMock: vi.fn(),
    useMutationMock: vi.fn(),
    useQueryMock: vi.fn(),
    useAuthMock: vi.fn(),
  }));

vi.mock("@clerk/react", () => ({
  useAuth: useAuthMock,
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    categories: {
      seedDefaultCategories: "categories.seedDefaultCategories",
    },
    groups: {
      createGroup: "groups.createGroup",
      getMyGroup: "groups.getMyGroup",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

function renderPage() {
  return renderWithProviders(
    <MemoryRouter>
      <GroupSetupPage />
    </MemoryRouter>,
  );
}

describe("GroupSetupPage", () => {
  beforeEach(() => {
    createGroupMock.mockReset();
    seedDefaultCategoriesMock.mockReset();
    useMutationMock.mockReset();
    useQueryMock.mockReset();
    useAuthMock.mockReset();

    createGroupMock.mockResolvedValue("group-001");
    seedDefaultCategoriesMock.mockResolvedValue({ created: 8, skipped: 0 });
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: true });
    useQueryMock.mockReturnValue(null);
    useMutationMock.mockImplementation((mutationRef: string) => {
      if (mutationRef.includes("groups.createGroup")) return createGroupMock;
      if (mutationRef.includes("categories.seedDefaultCategories"))
        return seedDefaultCategoriesMock;
      return vi.fn();
    });
  });

  it("グループ未所属なら作成フォームを表示する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "家族グループを作成" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "グループ名" })).toBeInTheDocument();
  });

  it("グループ作成後にデフォルトカテゴリをseedする", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("textbox", { name: "グループ名" }), "佐藤家");
    await user.click(screen.getByRole("button", { name: "グループを作成" }));

    await waitFor(() => {
      expect(createGroupMock).toHaveBeenCalledWith({ name: "佐藤家" });
      expect(seedDefaultCategoriesMock).toHaveBeenCalledTimes(1);
    });
  });
});
