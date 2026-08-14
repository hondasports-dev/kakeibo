export const APP_ENVIRONMENTS = ["development", "preview", "production"] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export type ResolveAppEnvironmentError = "mismatch" | "unknown";

const resolveAppEnvironmentErrorMessages: Record<ResolveAppEnvironmentError, string> = {
  mismatch: "対象環境が一致しません",
  unknown: "不明な環境です",
};

/** 環境解決エラーをユーザー向けメッセージに変換する */
export function getResolveAppEnvironmentErrorMessage(error: ResolveAppEnvironmentError): string {
  return resolveAppEnvironmentErrorMessages[error];
}

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
