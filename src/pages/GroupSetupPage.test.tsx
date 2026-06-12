import { MemoryRouter } from "react-router-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { GroupSetupPage } from "./GroupSetupPage";

const { createGroupMock, seedDefaultCategoriesMock, useMutationMock, useNavigateMock } = vi.hoisted(
  () => ({
    createGroupMock: vi.fn(),
    seedDefaultCategoriesMock: vi.fn(),
    useMutationMock: vi.fn(),
    useNavigateMock: vi.fn(),
  }),
);

vi.mock("../../convex/_generated/api", () => ({
  api: {
    groups: {
      createGroup: "groups.createGroup",
    },
    categories: {
      seedDefaultCategories: "categories.seedDefaultCategories",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: useMutationMock,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
    useNavigate: useNavigateMock,
  };
});

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
    useNavigateMock.mockReset();

    createGroupMock.mockResolvedValue("group-001");
    seedDefaultCategoriesMock.mockResolvedValue({ created: 8, skipped: 0 });
    useMutationMock.mockImplementation((mutationRef: string) => {
      if (mutationRef.includes("groups.createGroup")) return createGroupMock;
      if (mutationRef.includes("categories.seedDefaultCategories"))
        return seedDefaultCategoriesMock;
      return vi.fn();
    });
    useNavigateMock.mockReturnValue(vi.fn());
  });

  it("グループ未所属なら作成フォームを表示する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "家族グループを作成" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "グループ名" })).toBeInTheDocument();
  });

  it("グループ作成後にデフォルトカテゴリを seed してから遷移する", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    useNavigateMock.mockReturnValue(navigate);
    renderPage();

    await user.type(screen.getByRole("textbox", { name: "グループ名" }), "佐藤家");
    await user.click(screen.getByRole("button", { name: "グループを作成" }));

    expect(createGroupMock).toHaveBeenCalledWith({ name: "佐藤家" });
    expect(seedDefaultCategoriesMock).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
