import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test/render";
import App from "./App";

const {
  useAuthMock,
  useClerkMock,
  useConvexAuthMock,
  useMutationMock,
  useQueryMock,
  useSignInMock,
  useUserMock,
} = vi.hoisted(() => ({
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

describe("App weekly summary navigation", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
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

  it("/weeks/:weekStartDate の日付を週開始日に正規化し、サマリー取得に使う", async () => {
    // Given: 週の途中の日付を含む週次サマリーURLで表示している
    setupSignedInApp();
    window.history.pushState({}, "", "/weeks/2026-05-14");

    // When: アプリを表示する
    renderWithProviders(<App />);

    // Then: URL由来の日付が週開始日に正規化され、サマリー取得に使われる
    await waitFor(() => {
      expect(window.location.pathname).toBe("/weeks/2026-05-11");
      expect(
        useQueryMock.mock.calls.some(([, args]) => {
          return (
            typeof args === "object" &&
            args !== null &&
            "weekStartDate" in args &&
            args.weekStartDate === "2026-05-11" &&
            !("prevWeekTotalAmountYen" in args)
          );
        }),
      ).toBe(true);
    });
  });

  it("未来週URLは今週の週次サマリーURLへ正規化する", async () => {
    // Given: 今週より後の週次サマリーURLで表示している
    setupSignedInApp();
    window.history.pushState({}, "", "/weeks/2026-05-25");

    // When: アプリを表示する
    renderWithProviders(<App />);

    // Then: 今週のURLへ置き換えられる
    await waitFor(() => {
      expect(window.location.pathname).toBe("/weeks/2026-05-18");
    });
  });

  it("週次サマリーURLからルートへ戻るとサマリーを閉じる", async () => {
    // Given: 週次サマリーURLで表示している
    setupSignedInApp();
    window.history.pushState({}, "", "/weeks/2026-05-18");
    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "週次サマリー", level: 2 })).toBeInTheDocument();
    });

    // When: ブラウザBack相当でルートURLへ戻る
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));

    // Then: URLに合わせて週次サマリーが閉じる
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "週次サマリー", level: 2 }),
      ).not.toBeInTheDocument();
    });
  });

  it("振り返りパネルからサマリーを開くと今週の週次サマリーURLへ遷移する", async () => {
    // Given: 過去週サマリーを閉じた後の入力画面を表示している
    const user = userEvent.setup();
    setupSignedInApp();
    window.history.pushState({}, "", "/weeks/2026-05-11");
    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "サマリーを閉じる" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "サマリーを閉じる" }));

    // When: 今週の振り返りパネルからセッションを完了する
    await user.click(screen.getByRole("button", { name: "セッションを完了" }));

    // Then: 今週の週次サマリーURLへ遷移してサマリーを表示する
    await waitFor(() => {
      expect(window.location.pathname).toBe("/weeks/2026-05-18");
      expect(screen.getByRole("heading", { name: "週次サマリー", level: 2 })).toBeInTheDocument();
    });
  });
});
