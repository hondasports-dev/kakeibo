import { MemoryRouter, Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { GroupInvitationAcceptPage } from "./GroupInvitationAcceptPage";

const {
  acceptGroupInvitationMock,
  signUpFinalizeMock,
  signUpTicketMock,
  useAuthMock,
  useClerkMock,
  useConvexAuthMock,
  useNavigateMock,
  useSearchParamsMock,
  useSignUpMock,
} = vi.hoisted(() => ({
  acceptGroupInvitationMock: vi.fn(),
  signUpFinalizeMock: vi.fn(),
  signUpTicketMock: vi.fn(),
  useAuthMock: vi.fn(),
  useClerkMock: vi.fn(),
  useConvexAuthMock: vi.fn(),
  useNavigateMock: vi.fn(),
  useSearchParamsMock: vi.fn(),
  useSignUpMock: vi.fn(),
}));

vi.mock("@clerk/react", () => ({
  useAuth: useAuthMock,
  useClerk: useClerkMock,
  useSignUp: useSignUpMock,
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
    signUpFinalizeMock.mockReset();
    signUpTicketMock.mockReset();
    useAuthMock.mockReset();
    useClerkMock.mockReset();
    useConvexAuthMock.mockReset();
    useNavigateMock.mockReset();
    useSearchParamsMock.mockReset();
    useSignUpMock.mockReset();
    acceptGroupInvitationMock.mockResolvedValue("group-001");
    signUpFinalizeMock.mockResolvedValue({ error: null });
    signUpTicketMock.mockResolvedValue({ error: null });
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: false });
    useClerkMock.mockReturnValue({ signOut: vi.fn().mockResolvedValue(undefined) });
    useConvexAuthMock.mockReturnValue({ isAuthenticated: false });
    useNavigateMock.mockReturnValue(vi.fn());
    useSearchParamsMock.mockImplementation(() => [
      new URLSearchParams("token=invite-token&__clerk_ticket=ticket-001"),
    ]);
    useSignUpMock.mockReturnValue({
      signUp: {
        finalize: signUpFinalizeMock,
        status: "complete",
        ticket: signUpTicketMock,
      },
    });
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
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: true });
    useSearchParamsMock.mockImplementation(() => [new URLSearchParams("token=invite-token")]);

    renderPage();

    await waitFor(() => {
      expect(acceptGroupInvitationMock).toHaveBeenCalledWith({ token: "invite-token" });
      expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("未ログインかつ Clerk ticket があれば招待を消費して同じ受け入れURLへ戻す", async () => {
    const locationSpy = vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      href: "",
    } as Location);
    signUpFinalizeMock.mockImplementation(async ({ navigate }) => {
      navigate({ decorateUrl: (url: string) => url });
      return { error: null };
    });

    renderPage();

    await waitFor(() => {
      expect(signUpTicketMock).toHaveBeenCalledWith({ ticket: "ticket-001" });
      expect(signUpFinalizeMock).toHaveBeenCalled();
      expect(window.location.href).toBe("/group/invitations/accept?token=invite-token");
    });

    locationSpy.mockRestore();
  });

  it("Clerk ticket 付きURLで既存セッションがあれば現在のセッションを抜けてから処理する", async () => {
    const signOutMock = vi.fn().mockResolvedValue(undefined);
    const invitationPath =
      "/group/invitations/accept?token=invite-token&__clerk_ticket=ticket-001&__clerk_status=sign_up";
    window.history.pushState({}, "", invitationPath);
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: true });
    useClerkMock.mockReturnValue({ signOut: signOutMock });
    useConvexAuthMock.mockReturnValue({ isAuthenticated: true });

    renderPage(
      "/group/invitations/accept?token=invite-token&__clerk_ticket=ticket-001&__clerk_status=sign_up",
    );

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledWith({
        redirectUrl: invitationPath,
      });
    });
    expect(signUpTicketMock).not.toHaveBeenCalled();
    expect(acceptGroupInvitationMock).not.toHaveBeenCalled();
  });
});
