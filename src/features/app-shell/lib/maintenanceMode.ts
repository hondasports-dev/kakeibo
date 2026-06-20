/** メンテナンス中でも閲覧可能な法務・案内ページ */
export const MAINTENANCE_EXEMPT_PATHS = ["/privacy", "/terms", "/maintenance"] as const;

export function isMaintenanceMode(): boolean {
  return import.meta.env.VITE_APP_MAINTENANCE_MODE === "true";
}

export function isMaintenanceExemptPath(pathname: string): boolean {
  return (MAINTENANCE_EXEMPT_PATHS as readonly string[]).includes(pathname);
}

export function shouldShowMaintenancePage(pathname: string): boolean {
  return isMaintenanceMode() && !isMaintenanceExemptPath(pathname);
}
