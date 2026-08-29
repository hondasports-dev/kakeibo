import { describe, expect, it } from "vitest";

import {
  evaluateTaskStateTemplateChanges,
  isTaskStateInstancePath,
  isTaskStateTemplatePath,
  normalizeChangedPath,
  parseTaskStateTemplateArguments,
  runTaskStateTemplateCheck,
} from "./check-task-state-template.mjs";

describe("task-state path classification", () => {
  it("normalizes separators and leading ./", () => {
    expect(normalizeChangedPath("./.loop\\state\\issue-700.yaml")).toBe(
      ".loop/state/issue-700.yaml",
    );
  });

  it("recognizes the tracked template and template variants", () => {
    expect(isTaskStateTemplatePath(".loop/templates/task-state.yaml")).toBe(true);
    expect(isTaskStateTemplatePath(".loop\\templates\\task-state.schema.yml")).toBe(true);
    expect(isTaskStateTemplatePath(".loop/state/issue-700.yaml")).toBe(false);
  });

  it("recognizes current task instances", () => {
    expect(isTaskStateInstancePath(".loop/state/issue-700.yaml")).toBe(true);
    expect(isTaskStateInstancePath(".loop\\state\\issue-700.yaml")).toBe(true);
    expect(isTaskStateInstancePath(".loop/templates/task-state.yaml")).toBe(false);
  });
});

describe("evaluateTaskStateTemplateChanges", () => {
  it("passes when no task-state paths are staged", () => {
    expect(evaluateTaskStateTemplateChanges({ changedPaths: ["README.md"] })).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("fails template changes without an explicit schema reason", () => {
    expect(
      evaluateTaskStateTemplateChanges({
        changedPaths: [".loop/templates/task-state.yaml"],
      }),
    ).toMatchObject({ ok: false });
  });

  it("allows a schema-only change with a reason", () => {
    expect(
      evaluateTaskStateTemplateChanges({
        changedPaths: [".loop/templates/task-state.yaml"],
        allowSchemaChange: true,
        schemaChangeReason: "clarify schema-only template contract",
      }),
    ).toMatchObject({ ok: true, errors: [] });
  });

  it("requires a reason for the schema exception", () => {
    expect(
      evaluateTaskStateTemplateChanges({
        changedPaths: [".loop/templates/task-state.yaml"],
        allowSchemaChange: true,
      }),
    ).toMatchObject({ ok: false });
  });

  it("always fails staged current instances, including with schema exception", () => {
    expect(
      evaluateTaskStateTemplateChanges({
        changedPaths: [".loop/state/issue-700.yaml"],
        allowSchemaChange: true,
        schemaChangeReason: "schema change",
      }),
    ).toMatchObject({ ok: false });
  });

  it("fails when a template and a current instance are both staged", () => {
    const result = evaluateTaskStateTemplateChanges({
      changedPaths: [".loop/templates/task-state.yaml", ".loop/state/issue-700.yaml"],
      allowSchemaChange: true,
      schemaChangeReason: "schema change",
    });
    expect(result.ok).toBe(false);
    expect(result.templateChanges).toHaveLength(1);
    expect(result.instanceChanges).toHaveLength(1);
  });
});

describe("task-state template check CLI helpers", () => {
  it("parses the staged schema exception", () => {
    expect(
      parseTaskStateTemplateArguments([
        "--staged",
        "--allow-schema-change",
        "--reason",
        "schema-only contract",
      ]),
    ).toEqual({
      staged: true,
      allowSchemaChange: true,
      schemaChangeReason: "schema-only contract",
    });
  });

  it("rejects an exception without a reason", () => {
    expect(() => parseTaskStateTemplateArguments(["--allow-schema-change"])).toThrow(
      "--allow-schema-change requires a non-empty --reason",
    );
  });

  it("runs against supplied paths without reading git", () => {
    expect(
      runTaskStateTemplateCheck({
        changedPaths: ["README.md"],
        staged: true,
      }),
    ).toBe(0);
  });
});
