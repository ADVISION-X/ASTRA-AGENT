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
const STARTUP_CONTRACT_PATH = "src/lib/local-ai/startup-readiness.ts";
const APP_SERVER_PATH = "src/app/server.ts";

const ALLOWED_BOOTSTRAP_FILES = new Set([
  commanderConsoleInspectionConstants.STARTUP_PATH,
  STARTUP_HELPER_PATH,
  STARTUP_PROBE_PATH,
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
  if (hasNamedImport(launchSource, "./lib/local-ai-runtime-readiness.mjs", "ensureLocalAiRuntimeReady")) {
    return [];
  }

  return [createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must import ensureLocalAiRuntimeReady through the governed startup helper." })];
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

function collectFailClosedFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];
  const updatePreflight = launchSource.getFunction("runUpdatePreflight");
  const localAiReadiness = launchSource.getFunction("ensureLocalAiReadiness");

  if (!updatePreflight || !updatePreflight.getFullText().includes("UPDATE_PREFLIGHT_FAILED")) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must emit UPDATE_PREFLIGHT_FAILED when controlled update preflight fails." }));
  }
  if (!localAiReadiness) {
    findings.push(createStartupGateFinding({ lawId: STARTUP_GATE_LAW_ID, file: commanderConsoleInspectionConstants.STARTUP_PATH, message: "Startup must define a local AI readiness gate before service launch." }));
    return findings;
  }

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
}

async function collectHelperDelegationFindings(project: import("ts-morph").Project): Promise<Finding[]> {
  const findings: Finding[] = [];
  const helperSource = project.getSourceFile(pathFromRepoRoot(STARTUP_HELPER_PATH));
  const helperText = helperSource?.getFullText() ?? await readTextFile(pathFromRepoRoot(STARTUP_HELPER_PATH));
  const probeText = await readTextFile(pathFromRepoRoot(STARTUP_PROBE_PATH));

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