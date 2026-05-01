import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasLiteralTextFragment, hasPropertyNamed } from "../_shared/ast-literal-queries.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";

const {
  DISPATCH_FAILURE_PATH,
  EXECUTOR_PATH,
  EXECUTOR_COMPLETION_PATH,
  EXECUTOR_FLOW_PATH,
  EXECUTOR_FLOW_SUPPORT_PATH,
  EXECUTOR_PREFLIGHT_PATH,
  INPUT_GATE_PATH,
  LAW_RUNTIME_GOVERNANCE,
  NAVIGATION_RUNNER_PATH,
  POST_OPEN_STATE_GATE_PATH,
  POST_OPEN_STATE_HELPERS_PATH,
  POST_OPEN_STATE_RESULT_BUILDERS_PATH,
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
  const flowSource = getOpenSourceOrThrow(project, EXECUTOR_FLOW_PATH);
  const routeChecks = [
    { file: EXECUTOR_PATH, callName: "executeOpenChildFlow", message: "Open executor must route through executeOpenChildFlow." },
    { file: EXECUTOR_FLOW_PATH, callName: "resolveOpenChildPreflight", message: "Open execution flow must route through resolveOpenChildPreflight." },
    { file: EXECUTOR_FLOW_PATH, callName: "completeOpenChildExecution", message: "Open execution flow must route through completeOpenChildExecution." },
    { file: EXECUTOR_PREFLIGHT_PATH, callName: "evaluateOpenTargetPolicy", message: "Open execution chain must route through evaluateOpenTargetPolicy." },
    { file: EXECUTOR_PREFLIGHT_PATH, callName: "evaluateUrlSafety", message: "Open execution chain must route through evaluateUrlSafety." },
    { file: EXECUTOR_PREFLIGHT_PATH, callName: "evaluateRealChromeSession", message: "Open execution chain must route through evaluateRealChromeSession." },
    { file: EXECUTOR_COMPLETION_PATH, callName: "runOpenNavigation", message: "Open execution chain must route through runOpenNavigation." },
    { file: EXECUTOR_COMPLETION_PATH, callName: "evaluatePostOpenState", message: "Open execution chain must route through evaluatePostOpenState." },
    { file: EXECUTOR_FLOW_SUPPORT_PATH, callName: "buildOpenResult", message: "Open execution chain must route through buildOpenResult." },
  ] as const;

  return routeChecks.flatMap((check) => {
    const source = check.file === EXECUTOR_PATH ? executorSource : check.file === EXECUTOR_FLOW_PATH ? flowSource : getOpenSourceOrThrow(project, check.file);
    return hasCallExpression(source, check.callName)
      ? []
      : [createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: check.file, line: 1, severity: "fatal", message: check.message })];
  });
};

const collectTargetPolicyFinding = (project: import("ts-morph").Project): Finding[] => {
  const targetPolicySource = getOpenSourceOrThrow(project, TARGET_POLICY_GATE_PATH);
  return !hasCallExpression(targetPolicySource, "includes") || !hasLiteralTextFragment(targetPolicySource, "caller allowlist")
    ? [createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: TARGET_POLICY_GATE_PATH, line: 1, severity: "fatal", message: "Target policy gate must enforce caller policy before allowing target resolution." })]
    : [];
};

const collectUrlSafetyFinding = (project: import("ts-morph").Project): Finding[] => {
  const urlSafetySource = getOpenSourceOrThrow(project, URL_SAFETY_GATE_PATH);
  return hasLiteralTextFragment(urlSafetySource, "127.0.0.1/invalid")
    ? [createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: URL_SAFETY_GATE_PATH, line: 1, severity: "fatal", message: "URL safety gate must not fabricate fallback invalid URLs." })]
    : [];
};

const collectSessionGateFinding = (project: import("ts-morph").Project): Finding[] => {
  const sessionGateSource = getOpenSourceOrThrow(project, SESSION_GATE_PATH);
  return !hasLiteralTextFragment(sessionGateSource, "profile_missing") || !hasLiteralTextFragment(sessionGateSource, "profile_locked") || !hasLiteralTextFragment(sessionGateSource, "operator_verified") || !hasLiteralTextFragment(sessionGateSource, "login_required")
    ? [createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: SESSION_GATE_PATH, line: 1, severity: "fatal", message: "Real Chrome session gate must allowlist ready profile states." })]
    : [];
};

const collectNavigationRunnerFinding = (project: import("ts-morph").Project): Finding[] => {
  const navigationRunnerSource = getOpenSourceOrThrow(project, NAVIGATION_RUNNER_PATH);
  return !hasCallExpression(navigationRunnerSource, "safeReadSessionSnapshot") || !hasCallExpression(navigationRunnerSource, "buildTimedOutNavigationResult")
    ? [createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: NAVIGATION_RUNNER_PATH, line: 1, severity: "fatal", message: "Navigation runner must govern browser.open and getSessionSnapshot failures without throwing through the child boundary." })]
    : [];
};

const collectPolicyGateFindings = (project: import("ts-morph").Project): Finding[] => [
  ...collectTargetPolicyFinding(project),
  ...collectUrlSafetyFinding(project),
  ...collectSessionGateFinding(project),
  ...collectNavigationRunnerFinding(project),
];

const collectPostOpenStateFindings = (project: import("ts-morph").Project): Finding[] => {
  const postOpenStateSource = getOpenSourceOrThrow(project, POST_OPEN_STATE_HELPERS_PATH);
  const postOpenStateResultBuilders = getOpenSourceOrThrow(project, POST_OPEN_STATE_RESULT_BUILDERS_PATH);
  const findings: Finding[] = [];

  if (!hasLiteralTextFragment(postOpenStateSource, "captcha_wall") || !hasLiteralTextFragment(postOpenStateSource, "permission_wall")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: POST_OPEN_STATE_GATE_PATH, line: 1, severity: "fatal", message: "Post-open state gate must classify captcha and permission walls explicitly." }));
  }
  if (!hasLiteralTextFragment(postOpenStateResultBuilders, "login_wall") || !hasLiteralTextFragment(postOpenStateResultBuilders, "wrong_domain") || !hasCallExpression(postOpenStateSource, "buildReviewRequiredPostOpenStateResult") || !hasCallExpression(postOpenStateSource, "buildFailedPostOpenStateResult")) {
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
  if (!hasPropertyNamed(proofBuilderSource, "targetUrlSource") || !hasPropertyNamed(proofBuilderSource, "failureInputParseDecision")) {
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