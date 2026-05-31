import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test/render";
import App from "./App";
import { router } from "./router";

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

vi.mock("convex/react", () => ({
  useAction: useActionMock,
  useConvexAuth: useConvexAuthMock,
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

const currentWeekSession = {
  weekStartDate: "2026-05-18",
  weekEndDate: "2026-05-24",
  status: "draft" as const,
};

function setupSignedInApp() {
  const getOrCreateSession = vi.fn().mockResolvedValue(currentWeekSession);

  useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: true });
  useConvexAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: true });
  useActionMock.mockReset();
  useActionMock.mockReturnValue(vi.fn());
  useMutationMock.mockReset();
  useMutationMock.mockReturnValue(getOrCreateSession);
  useQueryMock.mockReset();
  useQueryMock.mockImplementation((_fn: unknown, args: unknown) => {
    if (args === "skip") {
      return undefined;
    }
    return [];
  });

  return { getOrCreateSession };
}

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
    expect(screen.getByRole("heading", { name: "家計簿にログイン" })).toBeInTheDocument();
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
});

describe("App route rendering", () => {
  beforeEach(async () => {
    await router.navigate("/");
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

  it("ルートURLではダッシュボードを表示する", async () => {
    // Given: ログイン済みでルートURLを表示している
    setupSignedInApp();

    // When: アプリを表示する
    renderWithProviders(<App />);

    // Then: ダッシュボードが表示される
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "今週のダッシュボード" })).toBeInTheDocument();
    });
  });

  it("入力リンクから入力画面へ遷移できる", async () => {
    // Given: ログイン済みでアプリを表示している
    const user = userEvent.setup();
    setupSignedInApp();
    renderWithProviders(<App />);
    await screen.findByRole("heading", { name: "今週のダッシュボード" });

    // When: 入力リンクを選ぶ
    await user.click(screen.getByRole("link", { name: "入力" }));

    // Then: 入力フォームが表示される
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "入力" })).toBeInTheDocument();
    });
  });

  it("カテゴリリンクからカテゴリ管理へ遷移できる", async () => {
    // Given: ログイン済みでアプリを表示している
    const user = userEvent.setup();
    setupSignedInApp();
    renderWithProviders(<App />);
    await screen.findByRole("heading", { name: "今週のダッシュボード" });

    // When: カテゴリリンクを選ぶ
    await user.click(screen.getByRole("link", { name: "カテゴリ" }));

    // Then: カテゴリ管理が表示される
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "カテゴリ管理" })).toBeInTheDocument();
    });
  });
});
