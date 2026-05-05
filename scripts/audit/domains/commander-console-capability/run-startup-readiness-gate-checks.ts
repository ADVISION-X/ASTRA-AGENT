import { Node } from "ts-morph";

import { readTextFile, listFilesRecursive } from "../../core/filesystem.js";
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
const MAP_PACKAGE_HELPER_PATH = "scripts/startup/lib/map-package-readiness.mjs";
const MAP_PACKAGE_PROBE_PATH = "scripts/startup/lib/map-package-readiness-probe.ts";
const STARTUP_FAILURE_BUNDLE_PATH = "scripts/startup/lib/startup-failure-bundle.mjs";
const STARTUP_FAILURE_HANDLER_PATH = "scripts/startup/lib/startup-failure-handler.mjs";
const STARTUP_MAIN_SUPPORT_PATH = "scripts/startup/lib/startup-main-support.mjs";
const STARTUP_CONTRACT_PATH = "src/lib/local-ai/startup-readiness.ts";
const APP_SERVER_PATH = "src/app/server.ts";

const ALLOWED_BOOTSTRAP_FILES = new Set([
  commanderConsoleInspectionConstants.STARTUP_PATH,
  STARTUP_HELPER_PATH,
  STARTUP_PROBE_PATH,
  MAP_PACKAGE_HELPER_PATH,
  MAP_PACKAGE_PROBE_PATH,
  STARTUP_FAILURE_BUNDLE_PATH,
  STARTUP_FAILURE_HANDLER_PATH,
  STARTUP_MAIN_SUPPORT_PATH,
  STARTUP_CONTRACT_PATH,
]);

const FORBIDDEN_BOOTSTRAP_MARKERS = [
  "ensureLocalAiRuntimeReady(",
  'open", ["-a", "Ollama"]',
  'ollama", ["serve"]',
];

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
  if (!hasNamedImport(launchSource, "./lib/map-package-readiness.mjs", "ensureMapPackageReadiness")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must import ensureMapPackageReadiness through the governed map package startup helper." }));
  }
  if (!hasNamedImport(launchSource, "./lib/startup-failure-handler.mjs", "createStartupFailureReport")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must import createStartupFailureReport so hard failures are correlated with a current debug-loop bundle." }));
  }

  return findings;
}

function collectPerformLaunchSequenceFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];
  const performLaunch = launchSource.getFunction("performLaunch");
  if (!performLaunch) {
    return [createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must define performLaunch with governed bootstrap ordering." })];
  }

  const orderedCalls = [
    getIdentifierCallWithin(performLaunch, "ensureDependencies"),
    getIdentifierCallWithin(performLaunch, "runUpdatePreflight"),
    getIdentifierCallWithin(performLaunch, "ensureStartupMapPackageReadiness"),
    getIdentifierCallWithin(performLaunch, "ensureLocalAiReadiness"),
    getIdentifierCallWithin(performLaunch, "preparePort"),
    getIdentifierCallWithin(performLaunch, "startService"),
    getIdentifierCallWithin(performLaunch, "verifyAppHealth"),
    getIdentifierCallWithin(performLaunch, "openReadyPage"),
    getIdentifierCallWithin(performLaunch, "markMissionRuntimeAvailable"),
  ];
  const callLabels = [
    "ensureDependencies",
    "runUpdatePreflight",
    "ensureStartupMapPackageReadiness",
    "ensureLocalAiReadiness",
    "preparePort",
    "startService",
    "verifyAppHealth",
    "openReadyPage",
    "markMissionRuntimeAvailable",
  ];

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

const collectMapPackageGateFindings = (
  mapPackageReadiness: ReturnType<import("ts-morph").SourceFile["getFunction"]>,
): Finding[] => {
  const findings: Finding[] = [];
  if (!mapPackageReadiness) {
    return [createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must define a map package readiness gate before service launch." })];
  }
  if (!getIdentifierCallWithin(mapPackageReadiness, "ensureMapPackageReadiness")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup map package gate must delegate to ensureMapPackageReadiness." }));
  }
  if (!mapPackageReadiness.getFullText().includes("map_package_readiness_check")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup map package gate must emit map_package_readiness_check structured logs." }));
  }
  if (!mapPackageReadiness.getFullText().includes("ownerResponsible") || !mapPackageReadiness.getFullText().includes("actionableMessage")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup map package gate must preserve ownerResponsible and actionableMessage in failure logs." }));
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
  if (!main || !getIdentifierCallWithin(main, "createStartupFailureReport")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup hard-failure catch path must write a current startup failure bundle." }));
  }
  return [
    ...findings,
    ...collectMapPackageGateFindings(launchSource.getFunction("ensureStartupMapPackageReadiness")),
    ...collectLocalAiFailClosedFindings(launchSource.getFunction("ensureLocalAiReadiness")),
  ];
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

const collectMapPackageHelperFindings = (mapPackageHelperText: string, mapPackageProbeText: string): Finding[] => {
  const findings: Finding[] = [];
  if (!mapPackageHelperText.includes("map-package-readiness-probe.ts")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: MAP_PACKAGE_HELPER_PATH, message: "Map package startup helper must delegate readiness evaluation to the governed map package probe script." }));
  }
  if (!mapPackageProbeText.includes("src/map-plugins/builtins/index.js") || !mapPackageProbeText.includes("src/map-plugins/registry/map-plugin-registry.js")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: MAP_PACKAGE_PROBE_PATH, message: "Map package startup probe must load builtin packages and exercise registry bootstrap through governed source modules." }));
  }
  if (!mapPackageProbeText.includes("ownerResponsible") || !mapPackageProbeText.includes("actionableMessage")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: MAP_PACKAGE_PROBE_PATH, message: "Map package startup probe must report ownerResponsible and actionableMessage for pre-service failures." }));
  }
  return findings;
};

const collectFailureBundleHelperFindings = (failureBundleText: string): Finding[] => {
  if (!failureBundleText.includes("startup-failure.json") || !failureBundleText.includes("ownerResponsible") || !failureBundleText.includes("actionableMessage")) {
    return [createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: STARTUP_FAILURE_BUNDLE_PATH, message: "Startup failure bundle writer must persist ownerResponsible and actionableMessage in startup-failure.json." })];
  }
  return [];
};

async function collectHelperDelegationFindings(project: import("ts-morph").Project): Promise<Finding[]> {
  const helperText = project.getSourceFile(pathFromRepoRoot(STARTUP_HELPER_PATH))?.getFullText() ?? await readTextFile(pathFromRepoRoot(STARTUP_HELPER_PATH));
  const mapPackageHelperText = project.getSourceFile(pathFromRepoRoot(MAP_PACKAGE_HELPER_PATH))?.getFullText() ?? await readTextFile(pathFromRepoRoot(MAP_PACKAGE_HELPER_PATH));
  const probeText = await readTextFile(pathFromRepoRoot(STARTUP_PROBE_PATH));
  const mapPackageProbeText = await readTextFile(pathFromRepoRoot(MAP_PACKAGE_PROBE_PATH));
  const failureBundleText = await readTextFile(pathFromRepoRoot(STARTUP_FAILURE_BUNDLE_PATH));

  return [
    ...collectLocalAiHelperFindings(helperText, probeText),
    ...collectMapPackageHelperFindings(mapPackageHelperText, mapPackageProbeText),
    ...collectFailureBundleHelperFindings(failureBundleText),
  ];
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
  const launchSource = startupProject.getSourceFileOrThrow(pathFromRepoRoot(commanderConsoleInspectionConstants.STARTUP_PATH));

  return [
    ...collectStartupImportFindings(launchSource),
    ...collectPerformLaunchSequenceFindings(launchSource),
    ...collectFailClosedFindings(launchSource),
    ...(await collectStartupPlatformGovernanceFindings(startupProject, launchSource)),
    ...(await collectHelperDelegationFindings(startupProject)),
    ...(await collectScatteredBootstrapFindings()),
  ];
}
