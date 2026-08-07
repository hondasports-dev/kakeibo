/** 表示名を解決する。identity.name があればそれを優先し、なければ既存名、最後は email、既定値 "ユーザー" を返す。 */
export function resolveDisplayName(args: {
  name?: string;
  email?: string;
  existingDisplayName?: string;
  fallback?: string;
}): string {
  const identityName = args.name?.trim();
  if (identityName) {
    return identityName;
  }
  if (args.existingDisplayName && args.existingDisplayName !== (args.fallback ?? "ユーザー")) {
    return args.existingDisplayName;
  }
  return args.email ?? args.existingDisplayName ?? args.fallback ?? "ユーザー";
}
