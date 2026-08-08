export type ExtractorMode = "mock" | "real";

export type ResolveExtractorModeError = "missing_required" | "invalid";

export function resolveExtractorMode(args: {
  appEnv: string;
  mode?: string;
}): { mode: ExtractorMode } | { error: ResolveExtractorModeError } {
  if (args.mode === undefined || args.mode === "") {
    if (args.appEnv === "production") {
      return { error: "missing_required" };
    }
    return { mode: "mock" };
  }

  if (args.mode !== "mock" && args.mode !== "real") {
    return { error: "invalid" };
  }

  return { mode: args.mode };
}
