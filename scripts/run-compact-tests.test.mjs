import { describe, expect, it } from "vitest";

import { buildCommands, formatSummary, parseArguments } from "./run-compact-tests.mjs";

describe("compact test runner arguments", () => {
  it("selects Vitest and forwards test filters", () => {
    expect(parseArguments(["vitest", "src/example.test.ts", "-t", "happy path"])).toEqual({
      help: false,
      mode: "vitest",
      forwardedArgs: ["src/example.test.ts", "-t", "happy path"],
    });

    const commands = buildCommands("vitest", ["src/example.test.ts"]);
    expect(commands).toHaveLength(2);
    expect(commands[0].label).toBe("dependency-preflight");
    expect(commands[1].args).toEqual(
      expect.arrayContaining([
        "run",
        "src/example.test.ts",
        "--reporter=minimal",
        "--maxWorkers=4",
      ]),
    );
  });

  it("keeps E2E environment sync before the compact Playwright command", () => {
    const commands = buildCommands("e2e", ["--grep", "@smoke"]);

    expect(commands.map(({ label }) => label)).toEqual(["e2e-env-sync", "playwright"]);
    expect(commands[1].args).toEqual(
      expect.arrayContaining([
        "test",
        "--grep",
        "@smoke",
        "--reporter=dot",
        "--quiet",
        "--max-failures=1",
      ]),
    );
  });

  it("pins compact reporters after forwarded options", () => {
    expect(buildCommands("vitest", ["--reporter=verbose"])[1].args.slice(-2)).toEqual([
      "--reporter=minimal",
      "--maxWorkers=4",
    ]);
    expect(buildCommands("e2e", ["--reporter=list"])[1].args.slice(-3)).toEqual([
      "--reporter=dot",
      "--quiet",
      "--max-failures=1",
    ]);
  });

  it("formats bounded machine-readable summaries", () => {
    expect(
      formatSummary({
        mode: "vitest",
        status: "FAIL",
        logPath: "C:/Temp/vitest.log",
        phase: "vitest",
        exitCode: 1,
      }),
    ).toBe("COMPACT_TEST status=FAIL mode=vitest log=C:/Temp/vitest.log phase=vitest exit_code=1");
  });

  it("supports help without selecting a test process", () => {
    expect(parseArguments(["--help"])).toEqual({ help: true, mode: null, forwardedArgs: [] });
  });
});
