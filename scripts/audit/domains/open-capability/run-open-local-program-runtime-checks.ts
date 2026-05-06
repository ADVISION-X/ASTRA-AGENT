import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";
import { hasCallExpression, hasIdentifier } from "./open-ast-queries.js";

const {
  LAW_LOCAL_PROGRAM,
  LOCAL_PROGRAM_RUNNER_PATH,
  LOCAL_PROGRAM_COMPLETION_PATH,
  LOCAL_PROGRAM_LAUNCH_PATH,
  LOCAL_PROGRAM_FAILURE_PATH,
  LOCAL_PROGRAM_ADAPTER_PATH,
  LOCAL_PROGRAM_ADAPTER_SYSTEM_PATH,
  LOCAL_PROGRAM_ADAPTER_CONSTANTS_PATH,
  MAP_CAPABILITY_CATALOG_OPEN_BUILDER_PATH,
  WORKBENCH_PATH,
  WORKBENCH_STATUS_PATH,
} = openInspectionConstants;
const { getOpenSourceOrThrow } = openInspectionUtils;

export const collectLocalProgramRuntimeFindings = (project: import("ts-morph").Project): Finding[] => {
  const localProgramRunnerSource = getOpenSourceOrThrow(project, LOCAL_PROGRAM_RUNNER_PATH);
  const localProgramCompletionSource = getOpenSourceOrThrow(project, LOCAL_PROGRAM_COMPLETION_PATH);
  const localProgramLaunchSource = getOpenSourceOrThrow(project, LOCAL_PROGRAM_LAUNCH_PATH);
  const localProgramFailureSource = getOpenSourceOrThrow(project, LOCAL_PROGRAM_FAILURE_PATH);
  const adapterSource = project.getSourceFileOrThrow(LOCAL_PROGRAM_ADAPTER_PATH);
  const adapterSystemSource = project.getSourceFileOrThrow(LOCAL_PROGRAM_ADAPTER_SYSTEM_PATH);
  const adapterConstantsSource = project.getSourceFileOrThrow(LOCAL_PROGRAM_ADAPTER_CONSTANTS_PATH);
  const catalogSource = project.getSourceFileOrThrow(MAP_CAPABILITY_CATALOG_OPEN_BUILDER_PATH);
  const workbenchOpenSource = project.getSourceFileOrThrow(WORKBENCH_PATH);
  const workbenchStatusSource = project.getSourceFileOrThrow(WORKBENCH_STATUS_PATH);

  return [
    ...collectLocalProgramLaunchFindings(localProgramLaunchSource, localProgramRunnerSource.getText()),
    ...collectLocalProgramProofFindings(localProgramCompletionSource.getText()),
    ...collectLocalProgramWorkbenchFindings(workbenchOpenSource.getText(), workbenchStatusSource.getText()),
    ...collectLocalProgramAdapterFindings(adapterSource.getText(), adapterSystemSource.getText(), adapterConstantsSource.getText()),
    ...collectLocalProgramCatalogFindings(catalogSource.getText()),
    ...collectLocalProgramFailureFindings(localProgramLaunchSource.getText(), localProgramFailureSource.getText()),
  ];
};

const collectLocalProgramLaunchFindings = (
  localProgramLaunchSource: import("ts-morph").SourceFile,
  runnerText: string,
): Finding[] => {
  const findings: Finding[] = [];
  if (!hasCallExpression(localProgramLaunchSource, "openLocalProgram") || !hasIdentifier(localProgramLaunchSource, "AbortController")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_RUNNER_PATH, line: 1, severity: "fatal", message: "Local program branch must call OpenLocalProgramPort.openLocalProgram with timeout/cancellation." }));
  }
  if (runnerText.includes("targetUrl: \"http://127.0.0.1") || runnerText.includes("localhost")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_RUNNER_PATH, line: 1, severity: "fatal", message: "Local program branch must not use localhost or fake URL fallback." }));
  }
  return findings;
};

const collectLocalProgramProofFindings = (completionText: string): Finding[] => {
  const findings: Finding[] = [];
  if (!completionText.includes("appLaunchAttemptRef: launch.launchResult?.appLaunchAttemptRef ?? null") || !completionText.includes("windowHandoffRef: handoff.windowHandoffRef")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_RUNNER_PATH, line: 1, severity: "fatal", message: "Local program success proof must preserve windowHandoffRef from the governed handoff." }));
  }
  if (!completionText.includes("localAppStateHandoffRef: handoff.localAppStateHandoffRef")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_RUNNER_PATH, line: 1, severity: "fatal", message: "Local program success proof must preserve localAppStateHandoffRef from the governed handoff." }));
  }
  return findings;
};

const collectLocalProgramWorkbenchFindings = (workbenchText: string, readinessText: string): Finding[] => {
  const findings: Finding[] = [];
  if (!workbenchText.includes("localProgram: createGovernedMacOSOpenLocalProgramAdapter()")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench Open runtime must inject the governed OpenLocalProgramPort adapter." }));
  }
  if (!readinessText.includes("BLOCKED_OPEN_LOCAL_PROGRAM_PORT_NOT_CONFIGURED") || !readinessText.includes("openLocalProgram")) {
    findings.push(createFinding({ lawId: LAW_LOCAL_PROGRAM, file: WORKBENCH_STATUS_PATH, line: 1, severity: "fatal", message: "Mission preflight must BLOCK local-program maps when the local program port/profile is not ready." }));
  }
  return findings;
};

const collectLocalProgramAdapterFindings = (
  adapterText: string,
  adapterSystemText: string,
  adapterConstantsText: string,
): Finding[] =>
  collectLocalProgramAdapterIdentityFindings(adapterConstantsText)
    .concat(collectLocalProgramAdapterEscapeFindings(adapterText, adapterSystemText))
    .concat(collectLocalProgramAdapterHandoffFindings(adapterText));

const collectLocalProgramAdapterIdentityFindings = (adapterConstantsText: string): Finding[] =>
  adapterConstantsText.includes("GOVERNED_TARGET_PROFILE_REF = \"macos-app:iphone-mirroring\"") && adapterConstantsText.includes("GOVERNED_BUNDLE_ID = \"com.apple.ScreenContinuity\"")
    ? []
    : [createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_ADAPTER_PATH, line: 1, severity: "fatal", message: "Local runtime adapter must hard-code the governed iPhone Mirroring profile instead of accepting raw app names." })];

const collectLocalProgramAdapterEscapeFindings = (adapterText: string, adapterSystemText: string): Finding[] =>
  adapterText.includes("osascript") || adapterText.includes("shellCommand") || adapterText.includes("shell: true") || adapterSystemText.includes("shell: true")
    ? [createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_ADAPTER_PATH, line: 1, severity: "fatal", message: "Local runtime adapter must not use AppleScript, shellCommand fields, or shell execution." })]
    : [];

const collectLocalProgramAdapterHandoffFindings = (adapterText: string): Finding[] =>
  adapterText.includes("windowHandoffRef") && adapterText.includes("localAppStateHandoffRef")
    ? []
    : [createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_ADAPTER_PATH, line: 1, severity: "fatal", message: "Local runtime adapter must return window and local app state handoff refs only after governed launch confirmation." })];

const collectLocalProgramCatalogFindings = (catalogText: string): Finding[] =>
  catalogText.includes("[\"macos-local\", \"local-program-window\", \"desktop-screen\"]")
    ? []
    : [createFinding({ lawId: LAW_LOCAL_PROGRAM, file: MAP_CAPABILITY_CATALOG_OPEN_BUILDER_PATH, line: 1, severity: "fatal", message: "Map capability catalog must preserve open-local-program supported targets for macOS local program window and desktop-screen handoff." })];

const collectLocalProgramFailureFindings = (launchText: string, failureText: string): Finding[] =>
  launchText.includes("LOCAL_PROGRAM_PORT_NOT_CONFIGURED") && failureText.includes("LOCAL_PROGRAM_APP_NOT_INSTALLED") && failureText.includes("LOCAL_PROGRAM_WINDOW_HANDOFF_MISSING") && failureText.includes("LOCAL_APP_STATE_HANDOFF_MISSING")
    ? []
    : [createFinding({ lawId: LAW_LOCAL_PROGRAM, file: LOCAL_PROGRAM_RUNNER_PATH, line: 1, severity: "fatal", message: "Local program failureReason codes must be specific enough for readiness and log triage." })];
