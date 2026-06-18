import { describe, expect, it, vi, afterEach } from "vitest";
import {
  isMaintenanceExemptPath,
  isMaintenanceMode,
  shouldShowMaintenancePage,
} from "./maintenanceMode";

describe("maintenanceMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("VITE_APP_MAINTENANCE_MODE=true のときメンテナンスモードになる", () => {
    vi.stubEnv("VITE_APP_MAINTENANCE_MODE", "true");
    expect(isMaintenanceMode()).toBe(true);
  });

  it("メンテナンス中でも法務ページは閲覧可能", () => {
    expect(isMaintenanceExemptPath("/privacy")).toBe(true);
    expect(isMaintenanceExemptPath("/terms")).toBe(true);
    expect(isMaintenanceExemptPath("/maintenance")).toBe(true);
    expect(isMaintenanceExemptPath("/")).toBe(false);
  });

  it("メンテナンス中は通常ページのみメンテナンス表示対象", () => {
    vi.stubEnv("VITE_APP_MAINTENANCE_MODE", "true");
    expect(shouldShowMaintenancePage("/")).toBe(true);
    expect(shouldShowMaintenancePage("/settings")).toBe(true);
    expect(shouldShowMaintenancePage("/privacy")).toBe(false);
    expect(shouldShowMaintenancePage("/terms")).toBe(false);
  });
});
