import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { LineLinkCallbackPage } from "./LineLinkCallbackPage";

const { useActionMock } = vi.hoisted(() => ({ useActionMock: vi.fn() }));

vi.mock("../../../../convex/_generated/api", () => ({
  api: { lineLink: { actions: { complete: "lineLink.actions.complete" } } },
}));

vi.mock("convex/react", () => ({ useAction: useActionMock }));

function SettingsResult() {
  const location = useLocation();
  return <div>{location.pathname + location.search}</div>;
}

describe("LineLinkCallbackPage", () => {
  beforeEach(() => useActionMock.mockReset());

  it("callbackのstate/codeをactionへ渡し、結果コードだけを設定画面へ渡す", async () => {
    const complete = vi.fn().mockResolvedValue({ code: "success" });
    useActionMock.mockReturnValue(complete);
    renderWithProviders(
      <MemoryRouter initialEntries={["/settings/line/callback?state=private-state&code=mock"]}>
        <Routes>
          <Route path="/settings/line/callback" element={<LineLinkCallbackPage />} />
          <Route path="/settings" element={<SettingsResult />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("/settings?line=success")).toBeInTheDocument());
    expect(complete).toHaveBeenCalledWith({ state: "private-state", code: "mock" });
    expect(screen.queryByText("private-state")).not.toBeInTheDocument();
  });

  it("stateまたはcodeが無いcallbackはactionを呼ばずinvalidへ戻す", async () => {
    const complete = vi.fn();
    useActionMock.mockReturnValue(complete);
    renderWithProviders(
      <MemoryRouter initialEntries={["/settings/line/callback?state=private-state"]}>
        <Routes>
          <Route path="/settings/line/callback" element={<LineLinkCallbackPage />} />
          <Route path="/settings" element={<SettingsResult />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("/settings?line=invalid")).toBeInTheDocument());
    expect(complete).not.toHaveBeenCalled();
  });
});
