export const APP_ENVIRONMENTS = ["development", "preview", "production"] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export type ResolveAppEnvironmentError = "mismatch" | "unknown";

export function resolveAppEnvironment(
  currentEnv: string | undefined,
  expectedEnv?: string,
):
  | { success: true; environment: AppEnvironment }
  | { success: false; error: ResolveAppEnvironmentError } {
  const isKnownEnv = (value: string | undefined): value is AppEnvironment =>
    APP_ENVIRONMENTS.includes(value as AppEnvironment);

  if (!expectedEnv) {
    return isKnownEnv(currentEnv)
      ? { success: true, environment: currentEnv }
      : { success: true, environment: "development" };
  }

  if (!isKnownEnv(currentEnv) || currentEnv !== expectedEnv) {
    return { success: false, error: "mismatch" };
  }

  return { success: true, environment: currentEnv };
}
