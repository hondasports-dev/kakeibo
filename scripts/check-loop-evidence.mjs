import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REVIEW_STATUSES = new Set(["PASS", "FAIL", "NOT_REQUIRED", "BLOCKED"]);

export function normalizeChangedPath(filePath) {
  return String(filePath).replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isProcessPolicyPath(filePath) {
  const normalized = normalizeChangedPath(filePath);
  if (normalized === "AGENTS.md" || normalized === "plugin.json") {
    return true;
  }
  if (
    normalized.startsWith(".loop/") ||
    normalized.startsWith("skills/") ||
    normalized.startsWith(".github/workflows/") ||
    normalized.startsWith(".husky/")
  ) {
    return true;
  }

  if (!normalized.startsWith("scripts/")) {
    return false;
  }

  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  return /^check-.*\.mjs$/.test(basename);
}

export function hasProcessPolicyChange(changedPaths) {
  return (changedPaths ?? []).some((filePath) => isProcessPolicyPath(filePath));
}

function isEmptyText(value) {
  return typeof value !== "string" || value.trim() === "";
}

function isEmptyViewpoints(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return true;
  }
  return value.every((item) => isEmptyText(item));
}

function isPassReview(section) {
  return (
    section?.status === "PASS" &&
    section.independence_attested === true &&
    !isEmptyViewpoints(section.viewpoints)
  );
}

export function evaluateReviewEvidence({ evidence, headSha, changedPaths }) {
  const errors = [];

  if (evidence === null || evidence === undefined || typeof evidence !== "object") {
    return { ok: false, errors: ["review evidence object is missing"] };
  }

  const requiredKeys = ["reviewed_head_sha", "code_review", "security_review"];
  for (const key of requiredKeys) {
    if (!(key in evidence) || evidence[key] === null || evidence[key] === undefined) {
      errors.push(`review evidence is missing ${key}`);
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (evidence.reviewed_head_sha !== headSha) {
    errors.push("reviewed_head_sha does not match head SHA");
  }

  const codeReview = evidence.code_review;
  const securityReview = evidence.security_review;
  if (typeof codeReview !== "object" || codeReview === null) {
    errors.push("code_review is missing");
  }
  if (typeof securityReview !== "object" || securityReview === null) {
    errors.push("security_review is missing");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (codeReview.status !== "PASS") {
    errors.push("code_review.status must be PASS");
  } else if (!isPassReview(codeReview)) {
    errors.push("code_review PASS requires independence_attested=true and non-empty viewpoints");
  }

  const processPolicyChanged = hasProcessPolicyChange(changedPaths);
  const securityStatus = securityReview.status;

  if (
    !REVIEW_STATUSES.has(securityStatus) ||
    (securityStatus !== "PASS" && securityStatus !== "NOT_REQUIRED")
  ) {
    errors.push("security_review.status must be PASS or NOT_REQUIRED");
  } else if (securityStatus === "PASS") {
    if (!isPassReview(securityReview)) {
      errors.push(
        "security_review PASS requires independence_attested=true and non-empty viewpoints",
      );
    }
  } else {
    if (processPolicyChanged) {
      errors.push("security_review NOT_REQUIRED is forbidden when process policy changed");
    }
    if (isEmptyText(securityReview.not_required_reason)) {
      errors.push("security_review NOT_REQUIRED requires a non-empty not_required_reason");
    }
  }

  return { ok: errors.length === 0, errors };
}

function isAppliedCandidate(candidate) {
  return candidate?.applicationStatus === "applied" && !isEmptyText(candidate?.location);
}

export function evaluateLearningApplication({ userRequestedCurrentPrApply, candidates }) {
  const errors = [];
  const list = Array.isArray(candidates) ? candidates : [];
  const requested = userRequestedCurrentPrApply === true;

  if (requested) {
    if (list.length === 0) {
      errors.push("user requested current-PR apply but no candidates were recorded");
    }
    for (const [index, candidate] of list.entries()) {
      if (!isAppliedCandidate(candidate)) {
        errors.push(`candidate[${index}] is not applied with a non-empty location`);
      }
    }
    return { ok: errors.length === 0, errors };
  }

  for (const [index, candidate] of list.entries()) {
    const status = candidate?.applicationStatus;
    const treatedAsNotApplied = status !== "applied";
    if (!treatedAsNotApplied) {
      errors.push(`candidate[${index}] is applied without a current-PR apply request`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function evaluateSkipIfMissingReview({ evidence, headSha, changedPaths }) {
  if (evidence === null || evidence === undefined) {
    return { ok: true, errors: [] };
  }
  return evaluateReviewEvidence({ evidence, headSha, changedPaths });
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function parseLoopEvidenceArguments(args) {
  const options = {
    mode: null,
    headSha: "",
    file: "",
    evidenceJson: "",
    userRequestedCurrentPrApply: null,
    candidatesJson: "",
    changedPathsJson: "",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--require-review") options.mode = "require-review";
    else if (arg === "--skip-if-missing") options.mode = "skip-if-missing";
    else if (arg === "--learning") options.mode = "learning";
    else if (arg === "--head") {
      options.headSha = next ?? "";
      index += 1;
    } else if (arg === "--file") {
      options.file = next ?? "";
      index += 1;
    } else if (arg === "--evidence-json") {
      options.evidenceJson = next ?? "";
      index += 1;
    } else if (arg === "--user-requested-apply") {
      options.userRequestedCurrentPrApply = next === "true";
      index += 1;
    } else if (arg === "--candidates-json") {
      options.candidatesJson = next ?? "";
      index += 1;
    } else if (arg === "--changed-paths-json") {
      options.changedPathsJson = next ?? "";
      index += 1;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  if (!options.mode) {
    throw new Error("one of --require-review, --skip-if-missing, or --learning is required");
  }

  return options;
}

function loadEvidence(options) {
  if (options.evidenceJson) {
    return JSON.parse(options.evidenceJson);
  }
  if (options.file) {
    return readJsonFile(options.file);
  }
  return undefined;
}

export function runLoopEvidenceCheck(options) {
  if (options.mode === "learning") {
    const candidates = options.candidatesJson
      ? JSON.parse(options.candidatesJson)
      : options.file
        ? readJsonFile(options.file)
        : [];
    const result = evaluateLearningApplication({
      userRequestedCurrentPrApply: options.userRequestedCurrentPrApply,
      candidates: Array.isArray(candidates) ? candidates : candidates.candidates,
    });
    console.log(`LOOP_EVIDENCE learning: ${result.ok ? "PASS" : "FAIL"}`);
    for (const error of result.errors) console.error(`error: ${error}`);
    return result.ok ? 0 : 1;
  }

  let evidence;
  try {
    evidence = loadEvidence(options);
  } catch (error) {
    if (options.mode === "skip-if-missing" && options.file) {
      const missing =
        error && typeof error === "object" && "code" in error && error.code === "ENOENT";
      if (missing) {
        console.log("LOOP_EVIDENCE review: PASS");
        console.log("scope: skip-if-missing");
        return 0;
      }
    }
    console.log("LOOP_EVIDENCE review: FAIL");
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  const changedPaths = options.changedPathsJson
    ? JSON.parse(options.changedPathsJson)
    : (options.changedPaths ?? []);
  const result =
    options.mode === "skip-if-missing"
      ? evaluateSkipIfMissingReview({
          evidence,
          headSha: options.headSha,
          changedPaths,
        })
      : evaluateReviewEvidence({
          evidence,
          headSha: options.headSha,
          changedPaths,
        });

  console.log(`LOOP_EVIDENCE review: ${result.ok ? "PASS" : "FAIL"}`);
  for (const error of result.errors) console.error(`error: ${error}`);
  return result.ok ? 0 : 1;
}

function normalizePath(value) {
  return path
    .resolve(value)
    .replace(/[\\/]+$/, "")
    .toLowerCase();
}

const invokedPath = process.argv[1] ? normalizePath(process.argv[1]) : "";
const modulePath = normalizePath(fileURLToPath(import.meta.url));
if (invokedPath === modulePath) {
  try {
    process.exitCode = runLoopEvidenceCheck(parseLoopEvidenceArguments(process.argv.slice(2)));
  } catch (error) {
    console.error("LOOP_EVIDENCE status: FAIL");
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
