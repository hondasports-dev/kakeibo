import { MemoryRouter, Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { GroupInvitationAcceptPage } from "./GroupInvitationAcceptPage";

const { acceptGroupInvitationMock, useConvexAuthMock, useNavigateMock, useSearchParamsMock } =
  vi.hoisted(() => ({
    acceptGroupInvitationMock: vi.fn(),
    useConvexAuthMock: vi.fn(),
    useNavigateMock: vi.fn(),
    useSearchParamsMock: vi.fn(),
  }));

vi.mock("@clerk/react", () => ({
  AuthenticateWithRedirectCallback: () => <div data-testid="clerk-callback" />,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: useConvexAuthMock,
  useMutation: () => acceptGroupInvitationMock,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: useNavigateMock,
    useSearchParams: useSearchParamsMock,
  };
});

function renderPage(initialEntry = "/group/invitations/accept?token=invite-token") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/group/invitations/accept" element={<GroupInvitationAcceptPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GroupInvitationAcceptPage", () => {
  beforeEach(() => {
    acceptGroupInvitationMock.mockReset();
    useConvexAuthMock.mockReset();
    useNavigateMock.mockReset();
    useSearchParamsMock.mockReset();
    acceptGroupInvitationMock.mockResolvedValue("group-001");
    useConvexAuthMock.mockReturnValue({ isAuthenticated: false });
    useNavigateMock.mockReturnValue(vi.fn());
    useSearchParamsMock.mockImplementation(() => [
      new URLSearchParams("token=invite-token&__clerk_ticket=ticket-001"),
    ]);
  });

  it("token がなければエラーを表示する", () => {
    useSearchParamsMock.mockImplementation(() => [new URLSearchParams("")]);

    renderPage("/group/invitations/accept");

    expect(screen.getByText("招待トークンが見つかりませんでした。")).toBeInTheDocument();
  });

  it("認証済みなら招待を受け入れて home へ遷移する", async () => {
    const navigateMock = vi.fn();
    useNavigateMock.mockReturnValue(navigateMock);
    useConvexAuthMock.mockReturnValue({ isAuthenticated: true });

    renderPage();

    expect(screen.getByTestId("clerk-callback")).toBeInTheDocument();

    await waitFor(() => {
      expect(acceptGroupInvitationMock).toHaveBeenCalledWith({ token: "invite-token" });
      expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });
  });
});
