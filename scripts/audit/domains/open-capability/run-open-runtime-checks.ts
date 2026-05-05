import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";
import { getTypeAliasPropertyNames, hasCallExpression, hasIdentifier, hasLiteralTextFragment, hasPropertyNamed } from "./open-ast-queries.js";
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
  LAW_LOCAL_PROGRAM,
  LOCAL_PROGRAM_RUNNER_PATH,
  LOCAL_PROGRAM_COMPLETION_PATH,
  LOCAL_PROGRAM_LAUNCH_PATH,
  LOCAL_PROGRAM_FAILURE_PATH,
  LOCAL_PROGRAM_ADAPTER_PATH,
  LOCAL_PROGRAM_ADAPTER_CONSTANTS_PATH,
  WORKBENCH_PATH,
  WORKBENCH_STATUS_PATH,
  NAVIGATION_RUNNER_PATH,
  NAVIGATION_RUNNER_SUPPORT_PATH,
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

const collectLocalProgramRuntimeFindings = (project: import("ts-morph").Project): Finding[] => {
  const localProgramRunnerSource = getOpenSourceOrThrow(project, LOCAL_PROGRAM_RUNNER_PATH);
  const localProgramCompletionSource = getOpenSourceOrThrow(project, LOCAL_PROGRAM_COMPLETION_PATH);
  const localProgramLaunchSource = getOpenSourceOrThrow(project, LOCAL_PROGRAM_LAUNCH_PATH);
  const localProgramFailureSource = getOpenSourceOrThrow(project, LOCAL_PROGRAM_FAILURE_PATH);
  const localProgramAdapterSource = project.getSourceFileOrThrow(LOCAL_PROGRAM_ADAPTER_PATH);
  const localProgramAdapterConstantsSource = project.getSourceFileOrThrow(LOCAL_PROGRAM_ADAPTER_CONSTANTS_PATH);
  const workbenchOpenSource = project.getSourceFileOrThrow(WORKBENCH_PATH);
  const workbenchStatusSource = project.getSourceFileOrThrow(WORKBENCH_STATUS_PATH);
  const text = localProgramRunnerSource.getText();
  const completionText = localProgramCompletionSource.getText();
  const launchText = localProgramLaunchSource.getText();
  const failureText = localProgramFailureSource.getText();
  const adapterText = localProgramAdapterSource.getText();
  const adapterConstantsText = localProgramAdapterConstantsSource.getText();
  const workbenchText = workbenchOpenSource.getText();
  const readinessText = workbenchStatusSource.getText();
  const findings: Finding[] = [];

  if (!hasCallExpression(localProgramLaunchSource, "openLocalProgram") || !hasIdentifier(localProgramLaunchSource, "AbortController")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_RUNNER_PATH, line: 1, severity: "fatal", message: "Local program branch must call OpenLocalProgramPort.openLocalProgram with timeout/cancellation." }));
  }
  if (!completionText.includes("appLaunchAttemptRef: launch.launchResult?.appLaunchAttemptRef ?? null") || !completionText.includes("windowHandoffRef: handoff.windowHandoffRef")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_RUNNER_PATH, line: 1, severity: "fatal", message: "Local program success proof must preserve windowHandoffRef from the governed handoff." }));
  }
  if (!completionText.includes("localAppStateHandoffRef: handoff.localAppStateHandoffRef")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_RUNNER_PATH, line: 1, severity: "fatal", message: "Local program success proof must preserve localAppStateHandoffRef from the governed handoff." }));
  }
  if (text.includes("targetUrl: \"http://127.0.0.1") || text.includes("localhost")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_RUNNER_PATH, line: 1, severity: "fatal", message: "Local program branch must not use localhost or fake URL fallback." }));
  }
  if (!workbenchText.includes("localProgram: createGovernedMacOSOpenLocalProgramAdapter()")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench Open runtime must inject the governed OpenLocalProgramPort adapter." }));
  }
  if (!readinessText.includes("BLOCKED_OPEN_LOCAL_PROGRAM_PORT_NOT_CONFIGURED") || !readinessText.includes("openLocalProgram")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: WORKBENCH_STATUS_PATH, line: 1, severity: "fatal", message: "Mission preflight must BLOCK local-program maps when the local program port/profile is not ready." }));
  }
  if (!adapterConstantsText.includes("GOVERNED_TARGET_PROFILE_REF = \"macos-app:iphone-mirroring\"") || !adapterConstantsText.includes("GOVERNED_BUNDLE_ID = \"com.apple.ScreenContinuity\"")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_ADAPTER_PATH, line: 1, severity: "fatal", message: "Local runtime adapter must hard-code the governed iPhone Mirroring profile instead of accepting raw app names." }));
  }
  if (adapterText.includes("osascript") || adapterText.includes("shellCommand") || adapterText.includes("shell: true")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_ADAPTER_PATH, line: 1, severity: "fatal", message: "Local runtime adapter must not use AppleScript, shellCommand fields, or shell execution." }));
  }
  if (!adapterText.includes("windowHandoffRef") || !adapterText.includes("localAppStateHandoffRef")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_ADAPTER_PATH, line: 1, severity: "fatal", message: "Local runtime adapter must return window and local app state handoff refs only after governed launch confirmation." }));
  }
  if (!launchText.includes("LOCAL_PROGRAM_PORT_NOT_CONFIGURED") || !failureText.includes("LOCAL_PROGRAM_APP_NOT_INSTALLED") || !failureText.includes("LOCAL_PROGRAM_WINDOW_HANDOFF_MISSING") || !failureText.includes("LOCAL_APP_STATE_HANDOFF_MISSING")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_RUNNER_PATH, line: 1, severity: "fatal", message: "Local program failureReason codes must be specific enough for readiness and log triage." }));
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
