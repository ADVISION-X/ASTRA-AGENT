import { Node, SyntaxKind } from "ts-morph";

import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getNodeLine } from "../../core/ts-morph.js";
import { createStartupProject, getIdentifierCallWithin, hasNamedImport } from "../local-app-shell/inspection-utils.js";
import { commanderConsoleInspectionConstants } from "./inspection-constants.js";
import { collectStartupPlatformGovernanceFindings } from "./startup-platform-target-checks.js";

const STARTUP_GATE_LAW_ID = "GRASSEYE-STARTUP-ENTRYPOINT-005-V1";
const LOCAL_AI_GATE_LAW_ID = "GRASSEYE-LOCAL-AI-RUNTIME-006-V1";
const STARTUP_HELPER_PATH = "scripts/startup/lib/local-ai-runtime-readiness.mjs";
const STARTUP_PROBE_PATH = "scripts/startup/lib/local-ai-runtime-readiness-probe.ts";
const STARTUP_CATALOG_HELPER_PATH = "scripts/startup/lib/startup-catalog-readiness.mjs";
const STARTUP_CATALOG_PROBE_PATH = "scripts/startup/lib/startup-catalog-readiness-probe.ts";
const STARTUP_FAILURE_BUNDLE_PATH = "scripts/startup/lib/startup-failure-bundle.mjs";
const STARTUP_FAILURE_HANDLER_PATH = "scripts/startup/lib/startup-failure-handler.mjs";
const STARTUP_MAIN_SUPPORT_PATH = "scripts/startup/lib/startup-main-support.mjs";
const STARTUP_CONTRACT_PATH = "src/lib/local-ai/startup-readiness.ts";
const APP_SERVER_PATH = "src/app/server.ts";
const TASK_START_FLOW_PATH = "src/lib/local-app-shell/task-start-flow.ts";
const WORKBENCH_STATUS_PATH = "src/lib/local-runtime/workbench-status.ts";
const WORKBENCH_MISSION_COMMAND_PREFLIGHT_PATH = "src/lib/local-runtime/workbench-mission-command-preflight.ts";
const ORCHESTRATION_PUBLIC_INDEX_PATH = "src/capabilities/orchestration/index.ts";
const ORCHESTRATION_SCHEMA_PATH = "src/capabilities/orchestration/schema.ts";
const TERMINAL_STRUCTURED_LOG_PATH = "scripts/startup/lib/terminal-structured-log.mjs";
const STRUCTURED_LOG_PAYLOAD_PATH = "src/lib/local-runtime/structured-log-payload.ts";

const ALLOWED_BOOTSTRAP_FILES = new Set([commanderConsoleInspectionConstants.STARTUP_PATH, STARTUP_HELPER_PATH, STARTUP_PROBE_PATH, STARTUP_CATALOG_HELPER_PATH, STARTUP_CATALOG_PROBE_PATH, STARTUP_FAILURE_BUNDLE_PATH, STARTUP_FAILURE_HANDLER_PATH, STARTUP_MAIN_SUPPORT_PATH, STARTUP_CONTRACT_PATH]);
const FORBIDDEN_BOOTSTRAP_MARKERS = ["ensureLocalAiRuntimeReady(", 'open", ["-a", "Ollama"]', 'ollama", ["serve"]'];

const createStartupGateFinding = (input: { lawId: string; file: string; message: string; line?: number; severity?: "error" | "fatal"; detail?: string }): Finding => {
  return createFinding({
    lawId: input.lawId,
    file: input.file,
    line: input.line ?? 1,
    severity: input.severity ?? "error",
    message: input.message,
    ...(input.detail ? { detail: input.detail } : {}),
  });
};

function collectStartupImportFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];
  if (!hasNamedImport(launchSource, "./lib/local-ai-runtime-readiness.mjs", "ensureLocalAiRuntimeReady")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must import ensureLocalAiRuntimeReady through the governed startup helper." }));
  }
  if (!hasNamedImport(launchSource, "./lib/startup-catalog-readiness.mjs", "ensureStartupCatalogReadiness")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must import ensureStartupCatalogReadiness through the governed startup catalog helper." }));
  }
  if (!hasNamedImport(launchSource, "./lib/startup-failure-handler.mjs", "handleStartupBootstrapFailure")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must import handleStartupBootstrapFailure so hard failures are correlated with a current debug-loop bundle." }));
  }

  return findings;
}

function collectPerformLaunchSequenceFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];
  const performLaunch = launchSource.getFunction("performLaunch");
  if (!performLaunch) {
    return [createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must define performLaunch with governed bootstrap ordering." })];
  }

  const orderedCalls = [getIdentifierCallWithin(performLaunch, "ensureDependencies"), getIdentifierCallWithin(performLaunch, "runUpdatePreflight"), getIdentifierCallWithin(performLaunch, "ensureStartupCatalogReadiness"), getIdentifierCallWithin(performLaunch, "ensureLocalAiReadiness"), getIdentifierCallWithin(performLaunch, "preparePort"), getIdentifierCallWithin(performLaunch, "startService"), getIdentifierCallWithin(performLaunch, "verifyAppHealth"), getIdentifierCallWithin(performLaunch, "openReadyPage"), getIdentifierCallWithin(performLaunch, "markMissionRuntimeAvailable")];
  const callLabels = ["ensureDependencies", "runUpdatePreflight", "ensureStartupCatalogReadiness", "ensureLocalAiReadiness", "preparePort", "startService", "verifyAppHealth", "openReadyPage", "markMissionRuntimeAvailable"];

  orderedCalls.forEach((callNode, index) => {
    if (!callNode) {
      findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: `performLaunch must call ${callLabels[index]} as part of the governed startup chain.` }));
    }
  });

  for (let index = 1; index < orderedCalls.length; index += 1) {
    const previousCall = orderedCalls[index - 1];
    const currentCall = orderedCalls[index];
    if (previousCall && currentCall && previousCall.getStart() > currentCall.getStart()) {
      findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, line: getNodeLine(currentCall), message: `performLaunch must run ${callLabels[index - 1]} before ${callLabels[index]}.` }));
    }
  }

  return findings;
}

const collectStartupCatalogGateFindings = (
  startupCatalogReadiness: ReturnType<import("ts-morph").SourceFile["getFunction"]>,
): Finding[] => {
  const findings: Finding[] = [];
  if (!startupCatalogReadiness) {
    return [createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must define a governed catalog readiness gate before local AI readiness and service launch." })];
  }
  const readinessText = startupCatalogReadiness.getFullText();
  if (!getIdentifierCallWithin(startupCatalogReadiness, "ensureStartupCatalogReadiness")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup catalog gate must delegate to ensureStartupCatalogReadiness." }));
  }
  if (!["prompt_contract_registry_check", "muscle_memory_catalog_check", "platform_registry_check"].every((token) => readinessText.includes(token))) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup catalog gate must emit prompt_contract_registry_check, muscle_memory_catalog_check, and platform_registry_check before local AI readiness." }));
  }
  if (!readinessText.includes("ownerResponsible") || !readinessText.includes("actionableMessage")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup catalog gate must preserve ownerResponsible and actionableMessage in failure logs." }));
  }
  return findings;
};

const collectLocalAiFailClosedFindings = (
  localAiReadiness: ReturnType<import("ts-morph").SourceFile["getFunction"]>,
): Finding[] => {
  if (!localAiReadiness) {
    return [createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must define a local AI readiness gate before service launch." })];
  }
  const findings: Finding[] = [];
  const readinessText = localAiReadiness.getFullText();
  if (!readinessText.includes("ai_capability_readiness_gate")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must log ai_capability_readiness_gate as part of the local AI startup chain." }));
  }
  if (!readinessText.includes("missionRuntimeAvailable")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup local AI gate must read the typed missionRuntimeAvailable result." }));
  }
  if (!readinessText.includes("throw new Error")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup local AI gate must fail closed when readiness does not pass." }));
  }

  return findings;
};

function collectFailClosedFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const updatePreflight = launchSource.getFunction("runUpdatePreflight");
  const main = launchSource.getFunction("main");
  const findings: Finding[] = [];
  if (!updatePreflight || !updatePreflight.getFullText().includes("UPDATE_PREFLIGHT_FAILED")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must emit UPDATE_PREFLIGHT_FAILED when controlled update preflight fails." }));
  }
  if (!main || !getIdentifierCallWithin(main, "handleStartupBootstrapFailure")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup hard-failure catch path must write a current startup failure bundle." }));
  }
  return [...findings, ...collectStartupCatalogGateFindings(launchSource.getFunction("ensureStartupCatalogReadiness")), ...collectLocalAiFailClosedFindings(launchSource.getFunction("ensureLocalAiReadiness"))];
}

const collectLocalAiHelperFindings = (helperText: string, probeText: string): Finding[] => {
  const findings: Finding[] = [];
  if (!helperText.includes("local-ai-runtime-readiness-probe.ts")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: STARTUP_HELPER_PATH, message: "Startup helper must delegate readiness evaluation to the governed local AI probe script." }));
  }
  if (helperText.includes("/api/tags") || helperText.includes('open", ["-a", "Ollama"]') || helperText.includes('ollama", ["serve"]')) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: STARTUP_HELPER_PATH, message: "Startup helper must stay a thin adapter and must not inline local AI boot logic." }));
  }
  if (!probeText.includes("src/lib/local-ai/startup-readiness.js")) {
    findings.push(createStartupGateFinding({ lawId: LOCAL_AI_GATE_LAW_ID, file: STARTUP_PROBE_PATH, message: "Startup probe must import the governed local AI startup readiness contract." }));
  }
  return findings;
};

const collectStartupCatalogHelperFindings = (catalogHelperText: string, catalogProbeText: string): Finding[] => {
  const findings: Finding[] = [];
  if (!catalogHelperText.includes("startup-catalog-readiness-probe.ts")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: STARTUP_CATALOG_HELPER_PATH, message: "Startup catalog helper must delegate readiness evaluation to the governed startup catalog probe script." }));
  }
  if (!catalogProbeText.includes("prompt-contracts/registry") || !catalogProbeText.includes("muscle-memory/catalog") || !catalogProbeText.includes("platform-target-registry")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: STARTUP_CATALOG_PROBE_PATH, message: "Startup catalog probe must verify Prompt Contract Registry, MuscleMemoryCatalog, and PlatformRegistry through governed source modules." }));
  }
  if (!catalogProbeText.includes("ownerResponsible") || !catalogProbeText.includes("actionableMessage")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: STARTUP_CATALOG_PROBE_PATH, message: "Startup catalog probe must report ownerResponsible and actionableMessage for pre-service failures." }));
  }
  return findings;
};

const collectFailureBundleHelperFindings = (failureBundleText: string): Finding[] => {
  if (!failureBundleText.includes("startup-failure.json") || !failureBundleText.includes("ownerResponsible") || !failureBundleText.includes("actionableMessage")) {
    return [createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: STARTUP_FAILURE_BUNDLE_PATH, message: "Startup failure bundle writer must persist ownerResponsible and actionableMessage in startup-failure.json." })];
  }
  return [];
};

function collectMissionPreflightContractFindings(project: import("ts-morph").Project): Finding[] {
  const taskStartFlow = project.getSourceFileOrThrow(pathFromRepoRoot(TASK_START_FLOW_PATH));
  const workbenchStatus = project.getSourceFileOrThrow(pathFromRepoRoot(WORKBENCH_STATUS_PATH));
  const commandPreflight = project.getSourceFileOrThrow(pathFromRepoRoot(WORKBENCH_MISSION_COMMAND_PREFLIGHT_PATH));
  const taskStartCalls = taskStartFlow.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "getMissionStartPreflight";
  });
  const callCarriesContract = taskStartCalls.some((callExpression) => {
    return ["userRequirementText", "selectedPlatforms", "targetProfileRef"].every((propertyName) => callExpression.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === propertyName));
  });
  const statusHasContractComponent = workbenchStatus.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "commandTransportContract");
  const statusHasMissionCommandSchemaComponent = workbenchStatus.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "missionCommandSchema");
  const statusImportsMissionCommandPreflight = hasNamedImport(workbenchStatus, "./workbench-mission-command-preflight.js", "checkMissionCommandSchemaPreflight");
  const preflightImportsMissionCommandSchema = importsGovernedMissionCommandSchema(project, commandPreflight);
  const statusValidatesMissionCommandSchema = commandPreflight.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === "MissionCommandSchema"
      && expression.getName() === "safeParse";
  });
  const statusChecksBinding = ["userRequirementText", "selectedPlatforms", "targetProfileRef"].every((propertyName) => workbenchStatus.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === `input.${propertyName}`));
  const findings: Finding[] = [];

  if (!callCarriesContract) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: TASK_START_FLOW_PATH, message: "Task start flow must pass userRequirementText, selectedPlatforms, and targetProfileRef into MissionStartPreflight before COMMANDER dispatch." }));
  }
  if (!statusHasContractComponent || !statusChecksBinding) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: WORKBENCH_STATUS_PATH, message: "MissionStartPreflight must include a commandTransportContract component that blocks missing user requirement, selected platform, or target profile refs." }));
  }
  if (!statusHasMissionCommandSchemaComponent || !statusImportsMissionCommandPreflight || !preflightImportsMissionCommandSchema || !statusValidatesMissionCommandSchema) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: WORKBENCH_STATUS_PATH, message: "MissionStartPreflight must dry-run MissionCommandSchema before COMMANDER dispatch so command schema failures cannot appear only after Nerve Bus dispatch." }));
  }

  return findings;
}

const sourceExportsMissionCommandSchema = (sourceFile: import("ts-morph").SourceFile): boolean => sourceFile.getExportedDeclarations().has("MissionCommandSchema");

function importsGovernedMissionCommandSchema(
  project: import("ts-morph").Project,
  commandPreflight: import("ts-morph").SourceFile,
): boolean {
  const schemaSource = project.getSourceFileOrThrow(pathFromRepoRoot(ORCHESTRATION_SCHEMA_PATH));
  const indexSource = project.getSourceFileOrThrow(pathFromRepoRoot(ORCHESTRATION_PUBLIC_INDEX_PATH));
  const schemaExportsCommandSchema = sourceExportsMissionCommandSchema(schemaSource);

  if (hasNamedImport(commandPreflight, "../../capabilities/orchestration/schema.js", "MissionCommandSchema")) {
    return schemaExportsCommandSchema;
  }

  if (!hasNamedImport(commandPreflight, "../../capabilities/orchestration/index.js", "MissionCommandSchema")) {
    return false;
  }

  return schemaExportsCommandSchema && sourceExportsMissionCommandSchema(indexSource);
}

function collectTerminalRelayFieldFindings(project: import("ts-morph").Project): Finding[] {
  const terminalSources = [TERMINAL_STRUCTURED_LOG_PATH, "scripts/startup/lib/terminal-structured-runtime-relay.mjs"].map((filePath) => project.addSourceFileAtPathIfExists(pathFromRepoRoot(filePath)) ?? project.addSourceFileAtPath(pathFromRepoRoot(filePath)));
  const payloadSource = project.getSourceFileOrThrow(pathFromRepoRoot(STRUCTURED_LOG_PAYLOAD_PATH));
  const hasProperty = (sourceFile: import("ts-morph").SourceFile, propertyName: string) =>
    sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === propertyName);
  const payloadFields = ["runId", "ownerResponsible", "actionableMessage"].every((propertyName) => hasProperty(payloadSource, propertyName));
  const terminalFields = ["runId", "ownerResponsible", "actionableMessage", "traceId", "failureReason"].every((propertyName) => terminalSources.some((sourceFile) => hasProperty(sourceFile, propertyName)));

  return payloadFields && terminalFields
    ? []
    : [createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: TERMINAL_STRUCTURED_LOG_PATH, severity: "fatal", message: "Terminal runtime relay must preserve runId, ownerResponsible, actionableMessage, traceId, and failureReason for COMMAND_REJECTED." })];
}

async function collectHelperDelegationFindings(project: import("ts-morph").Project): Promise<Finding[]> {
  const helperText = project.getSourceFile(pathFromRepoRoot(STARTUP_HELPER_PATH))?.getFullText() ?? await readTextFile(pathFromRepoRoot(STARTUP_HELPER_PATH));
  const probeText = await readTextFile(pathFromRepoRoot(STARTUP_PROBE_PATH));
  const failureBundleText = await readTextFile(pathFromRepoRoot(STARTUP_FAILURE_BUNDLE_PATH));
  const findings = [
    ...collectLocalAiHelperFindings(helperText, probeText),
    ...collectFailureBundleHelperFindings(failureBundleText),
  ];
  const catalogHelperPath = pathFromRepoRoot(STARTUP_CATALOG_HELPER_PATH);
  const catalogProbePath = pathFromRepoRoot(STARTUP_CATALOG_PROBE_PATH);

  if (!(await fileExists(catalogHelperPath)) || !(await fileExists(catalogProbePath))) {
    findings.push(createStartupGateFinding({
      lawId: STARTUP_GATE_LAW_ID,
      file: STARTUP_CATALOG_HELPER_PATH,
      message: "Startup must define governed startup-catalog readiness helper and probe files before mission runtime becomes available.",
    }));
    return findings;
  }

  const catalogHelperText = project.getSourceFile(catalogHelperPath)?.getFullText() ?? await readTextFile(catalogHelperPath);
  const catalogProbeText = await readTextFile(catalogProbePath);
  return [...findings, ...collectStartupCatalogHelperFindings(catalogHelperText, catalogProbeText)];
}

async function collectScatteredBootstrapFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const candidateFiles = [
    ...(await listFilesRecursive(pathFromRepoRoot("scripts/debug-loop"), { extensions: [".ts", ".js", ".mjs"] })),
    ...(await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts", ".js", ".mjs"] })),
  ];

  for (const absolutePath of candidateFiles) {
    const repoPath = toRepoRelativePath(absolutePath);
    if (ALLOWED_BOOTSTRAP_FILES.has(repoPath)) {
      continue;
    }

    const text = await readTextFile(absolutePath);
    const marker = FORBIDDEN_BOOTSTRAP_MARKERS.find((entry) => text.includes(entry));
    if (marker) {
      findings.push(createStartupGateFinding({
        lawId: LOCAL_AI_GATE_LAW_ID,
        file: repoPath,
        message: "Local AI bootstrap must stay inside the governed startup readiness contract and must not be started ad hoc by consumers.",
        detail: marker,
      }));
    }
  }

  return findings;
}

export async function runStartupReadinessGateChecks(): Promise<Finding[]> {
  const startupProject = createStartupProject();
  startupProject.addSourceFileAtPath(pathFromRepoRoot(APP_SERVER_PATH));
  startupProject.addSourceFileAtPath(pathFromRepoRoot(TASK_START_FLOW_PATH));
  startupProject.addSourceFileAtPath(pathFromRepoRoot(WORKBENCH_STATUS_PATH));
  startupProject.addSourceFileAtPath(pathFromRepoRoot(WORKBENCH_MISSION_COMMAND_PREFLIGHT_PATH));
  startupProject.addSourceFileAtPath(pathFromRepoRoot(ORCHESTRATION_PUBLIC_INDEX_PATH));
  startupProject.addSourceFileAtPath(pathFromRepoRoot(ORCHESTRATION_SCHEMA_PATH));
  startupProject.addSourceFileAtPath(pathFromRepoRoot(STRUCTURED_LOG_PAYLOAD_PATH));
  const launchSource = startupProject.getSourceFileOrThrow(pathFromRepoRoot(commanderConsoleInspectionConstants.STARTUP_PATH));

  return [
    ...collectStartupImportFindings(launchSource),
    ...collectPerformLaunchSequenceFindings(launchSource),
    ...collectFailClosedFindings(launchSource),
    ...collectMissionPreflightContractFindings(startupProject),
    ...collectTerminalRelayFieldFindings(startupProject),
    ...(await collectStartupPlatformGovernanceFindings(startupProject, launchSource)),
    ...(await collectHelperDelegationFindings(startupProject)),
    ...(await collectScatteredBootstrapFindings()),
  ];
}
