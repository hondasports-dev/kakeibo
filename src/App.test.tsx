import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test/render";
import App from "./App";

const {
  useAuthMock,
  useActionMock,
  useClerkMock,
  useConvexAuthMock,
  useMutationMock,
  useQueryMock,
  useSignInMock,
  useUserMock,
} = vi.hoisted(() => ({
  useActionMock: vi.fn(),
  useAuthMock: vi.fn(),
  useClerkMock: vi.fn(),
  useConvexAuthMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
  useSignInMock: vi.fn(),
  useUserMock: vi.fn(),
}));

vi.mock("@clerk/react", () => ({
  AuthenticateWithRedirectCallback: () => <div>OAuth callback mock</div>,
  useAuth: useAuthMock,
  useClerk: useClerkMock,
  useUser: useUserMock,
}));

vi.mock("@clerk/react/legacy", () => ({
  useSignIn: useSignInMock,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    RouterProvider: () => <div data-testid="router-provider" />,
    createBrowserRouter: () => ({}) as never,
  };
});

vi.mock("convex/react", () => ({
  useAction: useActionMock,
  useConvexAuth: useConvexAuthMock,
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

describe("App authentication states", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    useAuthMock.mockReset();
    useConvexAuthMock.mockReset();
    useSignInMock.mockReset();
    useClerkMock.mockReset();
    useMutationMock.mockReset();
    useQueryMock.mockReset();
    useUserMock.mockReset();
    useSignInMock.mockReturnValue({
      isLoaded: true,
      signIn: {
        authenticateWithRedirect: vi.fn(),
      },
    });
    useClerkMock.mockReturnValue({
      openUserProfile: vi.fn(),
      signOut: vi.fn(),
    });
    useUserMock.mockReturnValue({ user: null });
  });

  it("Clerkの読み込み中はログイン状態確認画面を表示する", () => {
    // Given: Clerkの認証状態がまだ読み込み中
    useAuthMock.mockReturnValue({ isLoaded: false, isSignedIn: false });
    useConvexAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: false });

    // When: アプリを表示する
    renderWithProviders(<App />);

    // Then: ログイン状態確認中の表示になる
    expect(screen.getByText("ログイン状態を確認しています。")).toBeInTheDocument();
  });

  it("未ログインではGoogleログイン画面を表示する", () => {
    // Given: Clerkは読み込み済みだが未ログイン
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: false });
    useConvexAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: false });

    // When: アプリを表示する
    renderWithProviders(<App />);

    // Then: Googleログイン導線が表示される
    expect(screen.getByAltText("Suzumemo スズメモ")).toBeInTheDocument();
    expect(screen.getByText("小さな支出と日々のメモを、軽く残せます。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Googleでログイン" })).toBeEnabled();
  });

  it("Clerkログイン後にConvex認証が読み込み中なら同期認証確認画面を表示する", () => {
    // Given: Clerkログイン済みでConvex認証が処理中
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: true });
    useConvexAuthMock.mockReturnValue({ isLoading: true, isAuthenticated: false });

    // When: アプリを表示する
    renderWithProviders(<App />);

    // Then: データ同期の認証状態確認が表示される
    expect(screen.getByText("データ同期の認証状態を確認しています。")).toBeInTheDocument();
  });

  it("Clerkログイン済みでもConvex未認証なら設定エラーを表示する", () => {
    // Given: Clerkログインは完了したがConvex認証が成立していない
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: true });
    useConvexAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: false });

    // When: アプリを表示する
    renderWithProviders(<App />);

    // Then: Convex連携の設定エラーが表示される
    expect(
      screen.getByText(/Clerkログインは完了していますが、Convexで認証できませんでした。/),
    ).toBeInTheDocument();
  });

  it("OAuth callback pathではClerkのリダイレクト完了画面を表示する", () => {
    // Given: Clerk OAuth callback URLで表示している
    window.history.pushState({}, "", "/sso-callback");

    // When: アプリを表示する
    renderWithProviders(<App />);

    // Then: callback専用画面が表示される
    expect(screen.getByRole("heading", { name: "Googleログインを処理中" })).toBeInTheDocument();
    expect(screen.getByText("OAuth callback mock")).toBeInTheDocument();
  });

  it("招待受け入れpathでは未ログインでもルーターを表示する", () => {
    // Given: Clerkは読み込み済みだが未ログイン
    window.history.pushState({}, "", "/group/invitations/accept?token=invite-token");
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: false });
    useConvexAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: false });

    // When: アプリを表示する
    renderWithProviders(<App />);

    // Then: 招待受け入れページへ到達できるように、通常の未ログイン画面ではなくルーターへ渡す
    expect(screen.getByTestId("router-provider")).toBeInTheDocument();
  });

  it("プライバシーポリシーpathでは未ログインでもルーターを表示する", () => {
    window.history.pushState({}, "", "/privacy");
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: false });
    useConvexAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: false });

    renderWithProviders(<App />);

    expect(screen.getByTestId("router-provider")).toBeInTheDocument();
  });

  it("未ログイン画面からプライバシーポリシーへのリンクを表示する", () => {
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: false });
    useConvexAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: false });

    renderWithProviders(<App />);

    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
  });

  it("利用規約pathでは未ログインでもルーターを表示する", () => {
    window.history.pushState({}, "", "/terms");
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: false });
    useConvexAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: false });

    renderWithProviders(<App />);

    expect(screen.getByTestId("router-provider")).toBeInTheDocument();
  });
});
