import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";

const {
  DISPATCH_FAILURE_PATH,
  EXECUTOR_PATH,
  INPUT_GATE_PATH,
  LAW_RUNTIME_GOVERNANCE,
  NAVIGATION_RUNNER_PATH,
  POST_OPEN_STATE_GATE_PATH,
  PROOF_BUILDER_PATH,
  RESULT_BUILDER_PATH,
  SESSION_GATE_PATH,
  TARGET_POLICY_GATE_PATH,
  URL_SAFETY_GATE_PATH,
} = openInspectionConstants;
const {
  getOpenSourceOrThrow,
  getOpenSources,
  hasCookieRead,
  hasDateUsageOutsideClock,
  hasDispatchFailureFabrication,
  hasReturnedObjectProperty,
  hasStatusClassificationObject,
  hasStrictSuccessStatusCheck,
} = openInspectionUtils;

const collectExecutorFindings = (project: import("ts-morph").Project): Finding[] => {
  const executorSource = getOpenSourceOrThrow(project, EXECUTOR_PATH);
  const requiredExecutorCalls = ["evaluateOpenTargetPolicy", "evaluateUrlSafety", "evaluateRealChromeSession", "runOpenNavigation", "evaluatePostOpenState", "buildOpenResult"];
  return requiredExecutorCalls.flatMap((callName) => {
    return hasCallExpression(executorSource, callName)
      ? []
      : [createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Open executor must route through ${callName}.` })];
  });
};

const collectPolicyGateFindings = (project: import("ts-morph").Project): Finding[] => {
  const targetPolicySource = getOpenSourceOrThrow(project, TARGET_POLICY_GATE_PATH);
  const urlSafetySource = getOpenSourceOrThrow(project, URL_SAFETY_GATE_PATH);
  const sessionGateSource = getOpenSourceOrThrow(project, SESSION_GATE_PATH);
  const navigationRunnerSource = getOpenSourceOrThrow(project, NAVIGATION_RUNNER_PATH);
  const findings: Finding[] = [];

  if (!hasCallExpression(targetPolicySource, "includes") || !hasLiteralTextFragment(targetPolicySource, "caller allowlist")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: TARGET_POLICY_GATE_PATH, line: 1, severity: "fatal", message: "Target policy gate must enforce caller policy before allowing target resolution." }));
  }
  if (hasLiteralTextFragment(urlSafetySource, "127.0.0.1/invalid")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: URL_SAFETY_GATE_PATH, line: 1, severity: "fatal", message: "URL safety gate must not fabricate fallback invalid URLs." }));
  }
  if (!hasLiteralTextFragment(sessionGateSource, "profile_ready") || !hasLiteralTextFragment(sessionGateSource, "logged_in")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: SESSION_GATE_PATH, line: 1, severity: "fatal", message: "Real Chrome session gate must allowlist ready profile states." }));
  }
  if (!hasCallExpression(navigationRunnerSource, "safeReadSessionSnapshot") || !hasLiteralTextFragment(navigationRunnerSource, "session_snapshot_failed")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: NAVIGATION_RUNNER_PATH, line: 1, severity: "fatal", message: "Navigation runner must govern browser.open and getSessionSnapshot failures without throwing through the child boundary." }));
  }

  return findings;
};

const collectPostOpenStateFindings = (project: import("ts-morph").Project): Finding[] => {
  const postOpenStateSource = getOpenSourceOrThrow(project, POST_OPEN_STATE_GATE_PATH);
  const findings: Finding[] = [];

  if (!hasLiteralTextFragment(postOpenStateSource, "captcha_wall") || !hasLiteralTextFragment(postOpenStateSource, "permission_wall")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: POST_OPEN_STATE_GATE_PATH, line: 1, severity: "fatal", message: "Post-open state gate must classify captcha and permission walls explicitly." }));
  }
  if (!hasStatusClassificationObject(postOpenStateSource, "review_required", "login_wall") || !hasStatusClassificationObject(postOpenStateSource, "failed", "wrong_domain")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: POST_OPEN_STATE_GATE_PATH, line: 1, severity: "fatal", message: "Post-open state gate must keep explicit login_wall and wrong_domain branches out of success." }));
  }

  return findings;
};

const collectResultBuilderFindings = (project: import("ts-morph").Project): Finding[] => {
  const resultBuilderSource = getOpenSourceOrThrow(project, RESULT_BUILDER_PATH);
  const proofBuilderSource = getOpenSourceOrThrow(project, PROOF_BUILDER_PATH);
  const dispatchFailureSource = getOpenSourceOrThrow(project, DISPATCH_FAILURE_PATH);
  const findings: Finding[] = [];

  if (!hasStrictSuccessStatusCheck(resultBuilderSource)) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Open result builder must only emit executable output on success." }));
  }
  if (!hasCallExpression(resultBuilderSource, "buildOpenProof")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Open result builder must always route through buildOpenProof." }));
  }
  if (!hasReturnedObjectProperty(proofBuilderSource, "targetUrlSource") || !hasReturnedObjectProperty(proofBuilderSource, "failureInputParseDecision")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: PROOF_BUILDER_PATH, line: 1, severity: "fatal", message: "Open proof builder must record trace-field provenance and parse decision data." }));
  }
  if (hasDispatchFailureFabrication(dispatchFailureSource)) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: DISPATCH_FAILURE_PATH, line: 1, severity: "fatal", message: "Dispatch failure envelope must not fabricate allow decisions or fake target profiles." }));
  }

  return findings;
};

const collectInputGateFinding = (project: import("ts-morph").Project): Finding[] => {
  const inputGateSource = getOpenSourceOrThrow(project, INPUT_GATE_PATH);
  return hasLiteralTextFragment(inputGateSource, "coerceOpenInputSeed") || !hasCallExpression(inputGateSource, "readOptionalString")
    ? [createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: INPUT_GATE_PATH, line: 1, severity: "fatal", message: "Open input gate must use one trace-only raw failure parser and must not coerce fake business requests." })]
    : [];
};

const collectRuntimeDisciplineFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const openSources = getOpenSources(project);
  const dateViolationFile = openSources.find((sourceFile) => hasDateUsageOutsideClock(sourceFile));
  const cookieReadFile = openSources.find((sourceFile) => hasCookieRead(sourceFile));

  if (dateViolationFile) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: dateViolationFile.getFilePath(), line: 1, severity: "fatal", message: "Open runtime must use the governed clock port instead of scattered Date constructors or Date.now." }));
  }
  if (cookieReadFile) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: cookieReadFile.getFilePath(), line: 1, severity: "fatal", message: "Open root must not read cookies or storage state directly." }));
  }

  return findings;
};

export function runOpenRuntimeChecks(project: import("ts-morph").Project): Finding[] {
  return [
    ...collectExecutorFindings(project),
    ...collectPolicyGateFindings(project),
    ...collectPostOpenStateFindings(project),
    ...collectResultBuilderFindings(project),
    ...collectInputGateFinding(project),
    ...collectRuntimeDisciplineFindings(project),
  ];
}