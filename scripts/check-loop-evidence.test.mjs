import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  evaluateLearningApplication,
  evaluateReviewEvidence,
  evaluateSkipIfMissingReview,
  evaluateVerificationEvidence,
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

function validVerificationEvidence(overrides = {}) {
  return {
    status: "PASS",
    verification_epoch: "epoch-1",
    evidence_snapshot: HEAD,
    affected_scope: ["scripts/check-loop-evidence.mjs"],
    check_authority: ["local", "ci"],
    checks: [
      {
        name: "loop evidence targeted test",
        authority: "local",
        scope: "targeted",
        status: "PASS",
      },
      {
        name: "repository test",
        authority: "ci",
        scope: "full_repository",
        status: "PASS",
      },
    ],
    reruns: [],
    duplicate_full_check_reason: "",
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

describe("evaluateVerificationEvidence", () => {
  it("passes scoped local checks with CI as the full-check authority", () => {
    expect(evaluateVerificationEvidence({ evidence: validVerificationEvidence() })).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("fails duplicate full checks without an explicit reason", () => {
    const result = evaluateVerificationEvidence({
      evidence: validVerificationEvidence({
        checks: [
          {
            name: "repository test",
            authority: "local",
            scope: "full_repository",
            status: "PASS",
          },
          {
            name: "repository test",
            authority: "ci",
            scope: "full_repository",
            status: "PASS",
          },
        ],
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "duplicate full checks require duplicate_full_check_reason: repository test",
    );
  });

  it("fails a verification marked PASS when an individual check failed", () => {
    const result = evaluateVerificationEvidence({
      evidence: validVerificationEvidence({
        checks: [
          {
            name: "targeted test",
            authority: "local",
            scope: "targeted",
            status: "FAIL",
          },
        ],
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("check[0].status must be PASS or NOT_REQUIRED");
  });

  it("allows duplicate full checks when the duplication is justified", () => {
    expect(
      evaluateVerificationEvidence({
        evidence: validVerificationEvidence({
          checks: [
            {
              name: "repository test",
              authority: "local",
              scope: "full_repository",
              status: "PASS",
            },
            {
              name: "repository test",
              authority: "ci",
              scope: "full_repository",
              status: "PASS",
            },
          ],
          duplicate_full_check_reason:
            "CI feedback was unavailable during a broad failure diagnosis",
        }),
      }),
    ).toMatchObject({ ok: true, errors: [] });
  });

  it("requires a reason and invalidation for every rerun", () => {
    const result = evaluateVerificationEvidence({
      evidence: validVerificationEvidence({
        reruns: [{ check: "repository test", reason: "fixed assertion" }],
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("rerun[0].invalidated_by is required");
  });
});

function learningCandidate(overrides = {}) {
  return {
    observed_problem: "A reusable loop problem was observed",
    process_cause: "The existing enforcement did not cover it",
    reusable_rule: "Enforce the reusable behavior deterministically",
    improvement_axes: ["precision"],
    proposed_target: "scripts/check-loop-evidence.mjs",
    disposition: "applied",
    location: "scripts/check-loop-evidence.mjs",
    evidence: ["task-state finding F001"],
    verification_evidence: ["targeted test PASS"],
    ...overrides,
  };
}

describe("evaluateLearningApplication", () => {
  it("fails a current-PR apply request with no candidates", () => {
    expect(
      evaluateLearningApplication({ userRequestedCurrentPrApply: true, candidates: [] }),
    ).toMatchObject({ ok: false });
  });

  it("fails a current-PR apply request unless every candidate is applied with evidence", () => {
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [
          learningCandidate({
            disposition: "follow_up",
            persistent_follow_up: "#700",
            rationale: "outside current scope",
          }),
        ],
      }),
    ).toMatchObject({ ok: false });
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [learningCandidate({ location: "  " })],
      }),
    ).toMatchObject({ ok: false });
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [learningCandidate({ verification_evidence: [] })],
      }),
    ).toMatchObject({ ok: false });
  });

  it("passes a current-PR apply request when all candidates are applied", () => {
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [learningCandidate()],
      }),
    ).toMatchObject({ ok: true, errors: [] });
  });

  it("passes persistent follow_up and evidenced no_change candidates", () => {
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: false,
        candidates: [
          learningCandidate({
            disposition: "follow_up",
            location: "",
            persistent_follow_up: "https://github.com/example/repo/issues/1",
            rationale: "outside current scope",
            verification_evidence: [],
          }),
          learningCandidate({
            disposition: "no_change",
            location: "",
            rationale: "existing enforcement already covers the rule",
            verification_evidence: [],
          }),
        ],
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
        candidates: [learningCandidate()],
      }),
    ).toMatchObject({ ok: false });
  });

  it("fails candidates without reusable content, valid axes, evidence, or disposition details", () => {
    const result = evaluateLearningApplication({
      userRequestedCurrentPrApply: false,
      candidates: [
        learningCandidate({
          observed_problem: " ",
          improvement_axes: ["cost"],
          evidence: [],
          disposition: "follow_up",
          persistent_follow_up: "",
          rationale: "",
        }),
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("candidate[0].observed_problem is required");
    expect(result.errors).toContain(
      "candidate[0].improvement_axes must contain context, speed, or precision",
    );
    expect(result.errors).toContain("candidate[0].evidence is required");
    expect(result.errors).toContain("candidate[0].persistent_follow_up is required for follow_up");
  });

  it("limits reusable candidates to the 3 highest-impact items", () => {
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [
          learningCandidate(),
          learningCandidate(),
          learningCandidate(),
          learningCandidate(),
        ],
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

  it("fails unknown dispositions", () => {
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: true,
        candidates: [learningCandidate({ disposition: "pending" })],
      }),
    ).toMatchObject({ ok: false });
    expect(
      evaluateLearningApplication({
        userRequestedCurrentPrApply: false,
        candidates: [learningCandidate({ disposition: "pending" })],
      }),
    ).toMatchObject({ ok: false });
  });
});
