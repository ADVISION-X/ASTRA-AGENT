import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";
import { getTypeAliasPropertyNames, hasCallExpression, hasIdentifier, hasLiteralTextFragment, hasPropertyNamed } from "./open-ast-queries.js";
import { collectLocalProgramRuntimeFindings } from "./run-open-local-program-runtime-checks.js";
import { collectChainBuilderFindings } from "./runtime-chain-findings.js";

const {
  DISPATCH_FAILURE_PATH,
  DISPATCH_FAILURE_BUILDERS_PATH,
  EXECUTOR_PATH,
  EXECUTOR_COMPLETION_PATH,
  EXECUTOR_FLOW_PATH,
  EXECUTOR_FLOW_SUPPORT_PATH,
  EXECUTOR_PREFLIGHT_PATH,
  IDEMPOTENCY_PATH,
  INPUT_GATE_PATH,
  LAW_INPUT_CHAIN,
  LAW_PAGE_STATE_HANDOFF,
  LAW_RESULT_PROOF,
  LAW_RUNTIME_GOVERNANCE,
  NAVIGATION_RUNNER_PATH,
  NAVIGATION_RUNNER_SUPPORT_PATH,
  POST_OPEN_OBSERVATION_HANDOFF_PATH,
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
  hasStatusClassificationObject,
  hasStrictSuccessStatusCheck,
} = openInspectionUtils;

const createMissingFieldFinding = (input: {
  fields: Set<string>;
  requiredFields: readonly string[];
  lawId: string;
  file: string;
  message: string;
}): Finding[] => {
  const missingFields = input.requiredFields.filter((field) => !input.fields.has(field));
  return missingFields.length === 0
    ? []
    : [createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: input.message, detail: missingFields.join(",") })];
};

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
    { file: EXECUTOR_COMPLETION_PATH, callName: "evaluatePostOpenObservationHandoff", message: "Open execution chain must route through evaluatePostOpenObservationHandoff." },
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
  const navigationRunnerSupportSource = getOpenSourceOrThrow(project, NAVIGATION_RUNNER_SUPPORT_PATH);
  const findings: Finding[] = [];

  if (!hasCallExpression(navigationRunnerSource, "safeReadSessionSnapshot") || !hasCallExpression(navigationRunnerSource, "buildTimedOutNavigationResult")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: NAVIGATION_RUNNER_PATH, line: 1, severity: "fatal", message: "Navigation runner must govern browser.open and getSessionSnapshot failures without throwing through the child boundary." }));
  }

  if (!hasIdentifier(navigationRunnerSource, "AbortController") || !hasCallExpression(navigationRunnerSupportSource, "runWithTimeout") || !hasPropertyNamed(navigationRunnerSupportSource, "abortSignal")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: NAVIGATION_RUNNER_SUPPORT_PATH, line: 1, severity: "fatal", message: "Navigation runner must propagate AbortSignal through runWithTimeout into OpenBrowserPort.open." }));
  }

  return findings;
};

const collectPolicyGateFindings = (project: import("ts-morph").Project): Finding[] => [
  ...collectTargetPolicyFinding(project),
  ...collectUrlSafetyFinding(project),
  ...collectSessionGateFinding(project),
  ...collectNavigationRunnerFinding(project),
];

const collectMissingFieldFindings = (input: {
  actualFields: readonly string[] | Set<string>;
  requiredFields: readonly string[];
  lawId: string;
  file: string;
  message: string;
}): Finding[] => {
  const actualFieldSet = input.actualFields instanceof Set ? input.actualFields : new Set(input.actualFields);
  const missingFields = input.requiredFields.filter((field) => !actualFieldSet.has(field));
  return missingFields.length === 0
    ? []
    : [createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: input.message, detail: missingFields.join(",") })];
};

const collectPostOpenStateFindings = (project: import("ts-morph").Project): Finding[] => {
  const postOpenObservationSource = getOpenSourceOrThrow(project, POST_OPEN_OBSERVATION_HANDOFF_PATH);
  const findings: Finding[] = [];

  if (!hasIdentifier(postOpenObservationSource, "evaluatePostOpenObservationHandoff") || !hasCallExpression(postOpenObservationSource, "buildPostOpenDecision")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: POST_OPEN_OBSERVATION_HANDOFF_PATH, line: 1, severity: "fatal", message: "Post-open observation handoff must evaluate the governed post-open observation and build a non-authoritative handoff decision." }));
  }

  if (!hasPropertyNamed(postOpenObservationSource, "authoritative")
    || !hasLiteralTextFragment(postOpenObservationSource, "AI owns readiness, safety, freshness, and page-kind judgment.")
    || !hasPropertyNamed(postOpenObservationSource, "pageStateHandoffRequired")
    || !hasPropertyNamed(postOpenObservationSource, "pageStateHandoffRef")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: POST_OPEN_OBSERVATION_HANDOFF_PATH, line: 1, severity: "fatal", message: "Post-open observation handoff must stay non-authoritative, preserve page-state handoff, and explicitly hand readiness judgment to AI." }));
  }

  if (!hasLiteralTextFragment(postOpenObservationSource, "timed_out")
    || !hasLiteralTextFragment(postOpenObservationSource, "navigation_failure_observation")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: POST_OPEN_OBSERVATION_HANDOFF_PATH, line: 1, severity: "fatal", message: "Post-open observation handoff must treat timed_out and failed navigation as failure observations instead of success." }));
  }

  if (hasLiteralTextFragment(postOpenObservationSource, "captcha_wall")
    || hasLiteralTextFragment(postOpenObservationSource, "permission_wall")
    || hasLiteralTextFragment(postOpenObservationSource, "login_wall")
    || hasLiteralTextFragment(postOpenObservationSource, "wrong_domain")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: POST_OPEN_OBSERVATION_HANDOFF_PATH, line: 1, severity: "fatal", message: "Post-open observation handoff must not revive local page-state truth branches such as login_wall, wrong_domain, captcha_wall, or permission_wall." }));
  }

  return findings;
};

const collectResultBuilderFindings = (project: import("ts-morph").Project): Finding[] => {
  const resultBuilderSource = getOpenSourceOrThrow(project, RESULT_BUILDER_PATH);
  const proofBuilderSource = getOpenSourceOrThrow(project, PROOF_BUILDER_PATH);
  const dispatchFailureSource = getOpenSourceOrThrow(project, DISPATCH_FAILURE_BUILDERS_PATH);
  const findings: Finding[] = [];

  if (!hasStrictSuccessStatusCheck(resultBuilderSource)) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Open result builder must only emit executable output on success." }));
  }
  if (!hasCallExpression(resultBuilderSource, "buildOpenProof")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Open result builder must always route through buildOpenProof." }));
  }
  if (!resultBuilderSource.getText().includes("pageStateHandoffRef,\n    pageStateHandoffRequired: true")) {
    findings.push(createFinding({ lawId: LAW_PAGE_STATE_HANDOFF, file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Open success output must preserve pageStateHandoffRef." }));
  }
  if (!hasPropertyNamed(proofBuilderSource, "targetUrlSource") || !hasPropertyNamed(proofBuilderSource, "failureInputParseDecision")) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: PROOF_BUILDER_PATH, line: 1, severity: "fatal", message: "Open proof builder must record trace-field provenance and parse decision data." }));
  }
  if (hasDispatchFailureFabrication(dispatchFailureSource)) {
    findings.push(createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: DISPATCH_FAILURE_BUILDERS_PATH, line: 1, severity: "fatal", message: "Dispatch failure envelope must not fabricate allow decisions or fake target profiles." }));
  }

  return findings;
};

const collectInputGateFinding = (project: import("ts-morph").Project): Finding[] => {
  const inputGateSource = getOpenSourceOrThrow(project, INPUT_GATE_PATH);
  const traceFields = getTypeAliasPropertyNames(inputGateSource, "OpenDispatchFailureTrace");
  const findings = hasLiteralTextFragment(inputGateSource, "coerceOpenInputSeed") || !hasCallExpression(inputGateSource, "readOptionalString")
    ? [createFinding({ lawId: LAW_RUNTIME_GOVERNANCE, file: INPUT_GATE_PATH, line: 1, severity: "fatal", message: "Open input gate must use one trace-only raw failure parser and must not coerce fake business requests." })]
    : [];

  findings.push(...collectMissingFieldFindings({
    actualFields: traceFields,
    requiredFields: [
      "stepId",
      "mapPackageId",
      "mapPackageVersion",
      "selectedMapId",
      "selectedMapVersion",
      "activationSnapshotRef",
      "capabilityCallId",
      "nerveBusEnvelopeId",
      "inputRef",
      "idempotencyKey",
      "timeoutMs",
      "receivedShapeHash",
    ],
    lawId: LAW_INPUT_CHAIN,
    file: INPUT_GATE_PATH,
    message: "Open dispatch-failure trace must retain the FINAL V2 chain fields and receivedShapeHash.",
  }));

  if (!hasCallExpression(inputGateSource, "hashInputShape")) {
    findings.push(createFinding({ lawId: LAW_INPUT_CHAIN, file: INPUT_GATE_PATH, line: 1, severity: "fatal", message: "Open input gate must hash invalid-input shapes before dispatch-failure proof is built." }));
  }

  return findings;
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
    ...collectChainBuilderFindings(project),
    ...collectRuntimeDisciplineFindings(project),
    ...collectLocalProgramRuntimeFindings(project),
  ];
}
