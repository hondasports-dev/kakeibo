import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  evaluateLearningApplication,
  evaluateReviewEvidence,
  evaluateSkipIfMissingReview,
  hasProcessPolicyChange,
  isProcessPolicyPath,
  normalizeChangedPath,
} from "./check-loop-evidence.mjs";

const HEAD = "cffdaacf556bdd48c84ccebf22a1a9ee0ac8aa62";

function passReview() {
  return {
    status: "PASS",
    independence_attested: true,
    viewpoints: ["checked correctness"],
  };
}

function validEvidence(overrides = {}) {
  return {
    reviewed_head_sha: HEAD,
    code_review: passReview(),
    security_review: passReview(),
    ...overrides,
  };
}

describe("normalizeChangedPath", () => {
  it("normalizes Windows separators and leading ./", () => {
    expect(normalizeChangedPath(".\\skills\\delivery\\SKILL.md")).toBe("skills/delivery/SKILL.md");
    expect(normalizeChangedPath("./AGENTS.md")).toBe("AGENTS.md");
  });
});

describe("isProcessPolicyPath", () => {
  it("matches the process_policy path set", () => {
    expect(isProcessPolicyPath("AGENTS.md")).toBe(true);
    expect(isProcessPolicyPath("plugin.json")).toBe(true);
    expect(isProcessPolicyPath(".loop/process.yaml")).toBe(true);
    expect(isProcessPolicyPath("skills/delivery/SKILL.md")).toBe(true);
    expect(isProcessPolicyPath(".github/workflows/ci.yml")).toBe(true);
    expect(isProcessPolicyPath(".husky/pre-commit")).toBe(true);
    expect(isProcessPolicyPath("scripts/check-loop-evidence.mjs")).toBe(true);
    expect(isProcessPolicyPath("scripts/check-loop-evidence.test.mjs")).toBe(true);
    expect(isProcessPolicyPath("scripts/run-coverage.mjs")).toBe(false);
    expect(isProcessPolicyPath("src/App.tsx")).toBe(false);
  });
});

describe("evaluateReviewEvidence", () => {
  it("passes SHA-matching independent CR and SR PASS", () => {
    expect(
      evaluateReviewEvidence({
        evidence: validEvidence(),
        headSha: HEAD,
        changedPaths: ["scripts/check-loop-evidence.mjs"],
      }),
    ).toMatchObject({ ok: true, errors: [] });
  });

  it("fails when the evidence object is missing", () => {
    expect(
      evaluateReviewEvidence({ evidence: undefined, headSha: HEAD, changedPaths: [] }),
    ).toMatchObject({
      ok: false,
    });
  });

  it("fails when required keys are missing", () => {
    expect(
      evaluateReviewEvidence({
        evidence: { reviewed_head_sha: HEAD },
        headSha: HEAD,
        changedPaths: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it("fails on SHA mismatch", () => {
    expect(
      evaluateReviewEvidence({
        evidence: validEvidence({ reviewed_head_sha: "other" }),
        headSha: HEAD,
        changedPaths: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it("fails when code_review is not PASS", () => {
    expect(
      evaluateReviewEvidence({
        evidence: validEvidence({
          code_review: { ...passReview(), status: "FAIL" },
        }),
        headSha: HEAD,
        changedPaths: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it("fails PASS reviews without independence or viewpoints", () => {
    expect(
      evaluateReviewEvidence({
        evidence: validEvidence({
          code_review: { status: "PASS", independence_attested: "true", viewpoints: ["ok"] },
        }),
        headSha: HEAD,
        changedPaths: [],
      }),
    ).toMatchObject({ ok: false });
    expect(
      evaluateReviewEvidence({
        evidence: validEvidence({
          security_review: { status: "PASS", independence_attested: true, viewpoints: ["  "] },
        }),
        headSha: HEAD,
        changedPaths: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it("fails SR NOT_REQUIRED when process policy changed", () => {
    expect(
      evaluateReviewEvidence({
        evidence: validEvidence({
          security_review: {
            status: "NOT_REQUIRED",
            not_required_reason: "docs only",
          },
        }),
        headSha: HEAD,
        changedPaths: ["skills/delivery/SKILL.md"],
      }),
    ).toMatchObject({ ok: false });
    expect(hasProcessPolicyChange(["skills/delivery/SKILL.md"])).toBe(true);
  });

  it("passes SR NOT_REQUIRED with a reason when process policy did not change", () => {
    expect(
      evaluateReviewEvidence({
        evidence: validEvidence({
          security_review: {
            status: "NOT_REQUIRED",
            not_required_reason: "typo in README",
          },
        }),
        headSha: HEAD,
        changedPaths: ["README.md"],
      }),
    ).toMatchObject({ ok: true, errors: [] });
  });

  it("fails SR NOT_REQUIRED without a reason", () => {
    expect(
      evaluateReviewEvidence({
        evidence: validEvidence({
          security_review: { status: "NOT_REQUIRED", not_required_reason: " " },
        }),
        headSha: HEAD,
        changedPaths: ["README.md"],
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("evaluateSkipIfMissingReview", () => {
  it("passes when evidence is absent", () => {
    expect(
      evaluateSkipIfMissingReview({ evidence: undefined, headSha: HEAD, changedPaths: [] }),
    ).toMatchObject({ ok: true, errors: [] });
  });

  it("uses fail-closed rules when evidence is present", () => {
    expect(
      evaluateSkipIfMissingReview({
        evidence: validEvidence({ reviewed_head_sha: "other" }),
        headSha: HEAD,
        changedPaths: [],
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("evaluateLearningApplication", () => {
  it("fails a current-PR apply request with no candidates", () => {
    expect(
      evaluateLearningApplication({ userRequestedCurrentPrApply: true, candidates: [] }),
    ).toMatchObject({ ok: false });
  });

  it("fails a current-PR apply request unless every candidate is applied with a location", () => {
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [
          { applicationStatus: "not_applied", location: "scripts/check-loop-evidence.mjs" },
        ],
      }),
    ).toMatchObject({ ok: false });
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [{ applicationStatus: "applied", location: "  " }],
      }),
    ).toMatchObject({ ok: false });
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [
          { applicationStatus: "applied", location: "scripts/check-loop-evidence.mjs" },
          { applicationStatus: "not_applied", location: "skills/delivery/SKILL.md" },
        ],
      }),
    ).toMatchObject({ ok: false });
  });

  it("passes a current-PR apply request when all candidates are applied", () => {
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [{ applicationStatus: "applied", location: "scripts/check-loop-evidence.mjs" }],
      }),
    ).toMatchObject({ ok: true, errors: [] });
  });

  it("passes deferred not_applied candidates when apply was not requested", () => {
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: false,
        candidates: [{ applicationStatus: "not_applied", location: "" }],
      }),
    ).toMatchObject({ ok: true, errors: [] });
    expect(
      evaluateLearningApplication({ userRequestedCurrentPrApply: false, candidates: [] }),
    ).toMatchObject({ ok: true, errors: [] });
  });

  it("fails applied candidates when apply was not requested", () => {
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: false,
        candidates: [{ applicationStatus: "applied", location: "scripts/check-loop-evidence.mjs" }],
      }),
    ).toMatchObject({ ok: false });
  });

  it("does not wire fail-closed review evidence into husky or CI deploy jobs", () => {
    const preCommit = readFileSync(".husky/pre-commit", "utf8");
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const preview = readFileSync(".github/workflows/preview-deploy.yml", "utf8");
    const production = readFileSync(".github/workflows/production-release.yml", "utf8");

    expect(preCommit).not.toContain("check-loop-evidence");
    expect(ci).not.toContain("check-loop-evidence");
    expect(ci).not.toContain("convex deploy");
    expect(preview).toContain("convex deploy");
    expect(production).toContain("convex deploy");
  });

  it("treats unknown applicationStatus as not_applied", () => {
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [{ applicationStatus: "pending", location: "scripts/check-loop-evidence.mjs" }],
      }),
    ).toMatchObject({ ok: false });
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: false,
        candidates: [{ applicationStatus: "pending", location: "" }],
      }),
    ).toMatchObject({ ok: true, errors: [] });
  });
});
