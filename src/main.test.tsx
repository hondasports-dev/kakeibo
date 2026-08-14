import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createRootMock, renderMock } = vi.hoisted(() => ({
  createRootMock: vi.fn(),
  renderMock: vi.fn(),
}));

function Passthrough({ children }: { children?: ReactNode }) {
  return children;
}

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));

vi.mock("@clerk/react", () => ({
  ClerkProvider: Passthrough,
  useAuth: vi.fn(),
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: class ConvexReactClient {
    constructor(_url: string) {}
  },
}));

vi.mock("convex/react-clerk", () => ({
  ConvexProviderWithClerk: Passthrough,
}));

vi.mock("@mui/material", () => ({
  CssBaseline: () => null,
  ThemeProvider: Passthrough,
}));

vi.mock("@mui/x-date-pickers/AdapterDayjs", () => ({
  AdapterDayjs: vi.fn(),
}));

vi.mock("@mui/x-date-pickers/locales", () => ({
  jaJP: { components: { MuiLocalizationProvider: { defaultProps: { localeText: {} } } } },
}));

vi.mock("@mui/x-date-pickers/LocalizationProvider", () => ({
  LocalizationProvider: Passthrough,
}));

vi.mock("./features/app-shell", () => ({
  AppErrorBoundary: Passthrough,
}));

vi.mock("./theme.ts", () => ({ theme: {} }));
vi.mock("./App.tsx", () => ({ default: () => null }));

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  createRootMock.mockReset();
  renderMock.mockReset();
  document.body.innerHTML = "";
});

describe("main entrypoint", () => {
  it("Clerk設定がない場合は起動を拒否する", async () => {
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");

    await expect(import("./main.tsx")).rejects.toThrow("VITE_CLERK_PUBLISHABLE_KEY is required");
  });

  it("Convex設定がない場合は起動を拒否する", async () => {
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_example");
    vi.stubEnv("VITE_CONVEX_URL", "");

    await expect(import("./main.tsx")).rejects.toThrow("VITE_CONVEX_URL is required");
  });

  it("必要な設定がある場合はLocalizationProvider付きでrootを描画する", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_example");
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    createRootMock.mockReturnValue({ render: renderMock });

    await import("./main.tsx");

    expect(createRootMock).toHaveBeenCalledWith(document.getElementById("root"));
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
