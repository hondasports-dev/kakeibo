import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REVIEW_STATUSES = new Set(["PASS", "FAIL", "NOT_REQUIRED", "BLOCKED"]);
const VERIFICATION_AUTHORITIES = new Set(["local", "ci", "runtime"]);
const VERIFICATION_SCOPES = new Set([
  "targeted",
  "affected_scope",
  "full_repository",
  "functional_e2e",
  "regression_e2e",
  "static",
  "runtime",
]);

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

const LEARNING_IMPROVEMENT_AXES = new Set(["context", "speed", "precision"]);
const LEARNING_DISPOSITIONS = new Set(["applied", "follow_up", "no_change"]);
const LEARNING_FOLLOW_UP_TYPES = new Set(["issue", "task", "pr"]);

function candidateValue(candidate, camelCaseKey, snakeCaseKey) {
  return candidate?.[snakeCaseKey] ?? candidate?.[camelCaseKey];
}

function isNonEmptyList(value) {
  return Array.isArray(value) && value.length > 0;
}

function isNonEmptyTextList(value) {
  return isNonEmptyList(value) && value.every((item) => !isEmptyText(item));
}

function isPersistentFollowUp(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    LEARNING_FOLLOW_UP_TYPES.has(value.type) &&
    !isEmptyText(value.reference)
  );
}

export function extractLearningRecord(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  return "learning" in input ? input.learning : input;
}

function validateLearningCandidate(candidate, index) {
  const errors = [];
  const requiredText = [
    ["observedProblem", "observed_problem"],
    ["processCause", "process_cause"],
    ["reusableRule", "reusable_rule"],
    ["proposedTarget", "proposed_target"],
  ];

  for (const [camelCaseKey, snakeCaseKey] of requiredText) {
    if (isEmptyText(candidateValue(candidate, camelCaseKey, snakeCaseKey))) {
      errors.push(`candidate[${index}].${snakeCaseKey} is required`);
    }
  }

  const axes = candidateValue(candidate, "improvementAxes", "improvement_axes");
  if (!isNonEmptyList(axes) || axes.some((axis) => !LEARNING_IMPROVEMENT_AXES.has(axis))) {
    errors.push(`candidate[${index}].improvement_axes must contain context, speed, or precision`);
  }

  if (!isNonEmptyTextList(candidate?.evidence)) {
    errors.push(`candidate[${index}].evidence requires non-empty text entries`);
  }

  const disposition = candidate?.disposition ?? candidate?.applicationStatus;
  if (!LEARNING_DISPOSITIONS.has(disposition)) {
    errors.push(`candidate[${index}].disposition must be applied, follow_up, or no_change`);
    return errors;
  }

  if (disposition === "applied") {
    if (isEmptyText(candidate?.location)) {
      errors.push(`candidate[${index}].location is required for applied`);
    }
    const verificationEvidence = candidateValue(
      candidate,
      "verificationEvidence",
      "verification_evidence",
    );
    if (!isNonEmptyTextList(verificationEvidence)) {
      errors.push(
        `candidate[${index}].verification_evidence requires non-empty text entries for applied`,
      );
    }
  }

  if (disposition === "follow_up") {
    const persistentFollowUp = candidateValue(
      candidate,
      "persistentFollowUp",
      "persistent_follow_up",
    );
    if (!isPersistentFollowUp(persistentFollowUp)) {
      errors.push(
        `candidate[${index}].persistent_follow_up requires type issue/task/pr and reference`,
      );
    }
    if (isEmptyText(candidate?.rationale)) {
      errors.push(`candidate[${index}].rationale is required for follow_up`);
    }
  }

  if (disposition === "no_change" && isEmptyText(candidate?.rationale)) {
    errors.push(`candidate[${index}].rationale is required for no_change`);
  }

  return errors;
}

export function evaluateLearningApplication({ userRequestedCurrentPrApply, learning }) {
  const errors = [];
  const requested = userRequestedCurrentPrApply === true;

  if (learning === null || typeof learning !== "object" || Array.isArray(learning)) {
    return { ok: false, errors: ["learning record is missing or invalid"] };
  }

  const event = learning.event;
  const normalizedStatus = typeof learning.status === "string" ? learning.status.toLowerCase() : "";
  const candidatesAreArray = Array.isArray(learning.candidates);
  const list = candidatesAreArray ? learning.candidates : [];

  if (isEmptyText(event)) {
    errors.push("learning.event is required");
  }
  if (!candidatesAreArray) {
    errors.push("learning.candidates must be an array");
  }

  if (event === "none") {
    if (normalizedStatus !== "not_required") {
      errors.push("learning.status must be NOT_REQUIRED when event is none");
    }
    if (list.length > 0) {
      errors.push("learning.candidates must be empty when event is none");
    }
    if (requested) {
      errors.push("current-PR apply cannot be requested when learning.event is none");
    }
    return { ok: errors.length === 0, errors };
  }

  if (normalizedStatus !== "pass") {
    errors.push("learning.status must be PASS when a learning event occurred");
  }

  if (list.length > 3) {
    errors.push("learning candidates must be limited to the 3 highest-impact items");
  }

  for (const [index, candidate] of list.entries()) {
    errors.push(...validateLearningCandidate(candidate, index));
  }

  if (requested) {
    if (list.length === 0) {
      errors.push("user requested current-PR apply but no candidates were recorded");
    }
    for (const [index, candidate] of list.entries()) {
      const disposition = candidate?.disposition ?? candidate?.applicationStatus;
      if (disposition !== "applied") {
        errors.push(`candidate[${index}] must be applied when current-PR apply was requested`);
      }
    }
    return { ok: errors.length === 0, errors };
  }

  for (const [index, candidate] of list.entries()) {
    const disposition = candidate?.disposition ?? candidate?.applicationStatus;
    if (disposition === "applied") {
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

function normalizedCheckName(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

export function evaluateVerificationEvidence({ evidence }) {
  const errors = [];

  if (evidence === null || evidence === undefined || typeof evidence !== "object") {
    return { ok: false, errors: ["verification evidence object is missing"] };
  }

  if (evidence.status !== "PASS") {
    errors.push("verification.status must be PASS");
  }

  const requiredTextKeys = ["verification_epoch", "evidence_snapshot"];
  for (const key of requiredTextKeys) {
    if (isEmptyText(evidence[key])) {
      errors.push(`verification evidence requires ${key}`);
    }
  }

  if (!Array.isArray(evidence.affected_scope) || evidence.affected_scope.length === 0) {
    errors.push("verification evidence requires a non-empty affected_scope");
  }

  const authorities = evidence.check_authority;
  if (!Array.isArray(authorities) || authorities.length === 0) {
    errors.push("verification evidence requires a non-empty check_authority");
  } else {
    for (const authority of authorities) {
      if (!VERIFICATION_AUTHORITIES.has(authority)) {
        errors.push(`unknown check_authority: ${String(authority)}`);
      }
    }
  }

  const checks = evidence.checks;
  if (!Array.isArray(checks) || checks.length === 0) {
    errors.push("verification evidence requires a non-empty checks list");
  }

  const checkNames = new Map();
  for (const [index, check] of (Array.isArray(checks) ? checks : []).entries()) {
    if (typeof check !== "object" || check === null || Array.isArray(check)) {
      errors.push(`check[${index}] must be an object`);
      continue;
    }

    if (isEmptyText(check.name)) {
      errors.push(`check[${index}].name is required`);
    }
    if (!VERIFICATION_AUTHORITIES.has(check.authority)) {
      errors.push(`check[${index}].authority is invalid`);
    }
    if (!VERIFICATION_SCOPES.has(check.scope)) {
      errors.push(`check[${index}].scope is invalid`);
    }
    if (!REVIEW_STATUSES.has(check.status)) {
      errors.push(`check[${index}].status is invalid`);
    } else if (check.status !== "PASS" && check.status !== "NOT_REQUIRED") {
      errors.push(`check[${index}].status must be PASS or NOT_REQUIRED`);
    }
    if (check.status === "NOT_REQUIRED" && isEmptyText(check.not_required_reason)) {
      errors.push(`check[${index}].NOT_REQUIRED requires not_required_reason`);
    }

    if (check.scope === "full_repository" && check.status !== "NOT_REQUIRED") {
      const name = normalizedCheckName(check.name);
      if (name) {
        const existing = checkNames.get(name) ?? [];
        existing.push(index);
        checkNames.set(name, existing);
      }
    }
  }

  const reruns = evidence.reruns;
  if (!Array.isArray(reruns)) {
    errors.push("verification evidence requires reruns to be an array");
  } else {
    for (const [index, rerun] of reruns.entries()) {
      if (typeof rerun !== "object" || rerun === null || Array.isArray(rerun)) {
        errors.push(`rerun[${index}] must be an object`);
        continue;
      }
      if (isEmptyText(rerun.check)) {
        errors.push(`rerun[${index}].check is required`);
      }
      if (isEmptyText(rerun.reason)) {
        errors.push(`rerun[${index}].reason is required`);
      }
      if (isEmptyText(rerun.invalidated_by)) {
        errors.push(`rerun[${index}].invalidated_by is required`);
      }
    }
  }

  const duplicateFullChecks = [...checkNames.entries()].filter(([, indexes]) => indexes.length > 1);
  if (duplicateFullChecks.length > 0 && isEmptyText(evidence.duplicate_full_check_reason)) {
    const names = duplicateFullChecks.map(([name]) => name).join(", ");
    errors.push(`duplicate full checks require duplicate_full_check_reason: ${names}`);
  }

  return { ok: errors.length === 0, errors };
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
    else if (arg === "--verification") options.mode = "verification";
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
    throw new Error(
      "one of --require-review, --skip-if-missing, --learning, or --verification is required",
    );
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
    let input;
    try {
      input = options.candidatesJson
        ? JSON.parse(options.candidatesJson)
        : options.file
          ? readJsonFile(options.file)
          : undefined;
    } catch (error) {
      console.log("LOOP_EVIDENCE learning: FAIL");
      console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
    const result = evaluateLearningApplication({
      userRequestedCurrentPrApply: options.userRequestedCurrentPrApply,
      learning: extractLearningRecord(input),
    });
    console.log(`LOOP_EVIDENCE learning: ${result.ok ? "PASS" : "FAIL"}`);
    for (const error of result.errors) console.error(`error: ${error}`);
    return result.ok ? 0 : 1;
  }

  if (options.mode === "verification") {
    let evidence;
    try {
      evidence = loadEvidence(options);
    } catch (error) {
      console.log("LOOP_EVIDENCE verification: FAIL");
      console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
    const result = evaluateVerificationEvidence({ evidence });
    console.log(`LOOP_EVIDENCE verification: ${result.ok ? "PASS" : "FAIL"}`);
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
