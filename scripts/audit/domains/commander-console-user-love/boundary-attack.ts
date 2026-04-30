import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  APP_SHELL_PATH,
  CANDIDATE_HANDLER_PATH,
  CREATE_SERVER_PATH,
  PAGE_RENDER_PATH,
  RUNTIME_HANDLER_PATH,
  TASK_HANDLER_PATH,
  createCommanderConsoleUserLoveProject,
  getUserLoveSourceFile,
  hasForbiddenImport,
  hasPropertyAccessPath,
  hasStartRequiredBothCondition,
} from "./ast-utils.js";
import { APP_SHELL_LAW_ID, LAW_ID } from "./ast-utils.js";

function collectShellBoundaryFindings(project: ReturnType<typeof createCommanderConsoleUserLoveProject>): Finding[] {
  const findings: Finding[] = [];
  for (const path of [APP_SHELL_PATH, PAGE_RENDER_PATH]) {
    const sourceFile = getUserLoveSourceFile(project, path);
    if (hasForbiddenImport(sourceFile)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: path,
        line: 1,
        severity: "fatal",
        message: "User-love shell crossed into forbidden runtime ownership.",
      }));
    }
  }
  return findings;
}

function collectServerBoundaryFindings(project: ReturnType<typeof createCommanderConsoleUserLoveProject>): Finding[] {
  const createServerSource = getUserLoveSourceFile(project, CREATE_SERVER_PATH);
  return hasPropertyAccessPath(createServerSource, ["activeWorkbench", "evidenceStore"]) || hasPropertyAccessPath(createServerSource, ["activeWorkbench", "deleteCandidate"])
    ? [createFinding({ lawId: APP_SHELL_LAW_ID, file: CREATE_SERVER_PATH, line: 1, severity: "fatal", message: "Workbench server must not expose evidence store or delete mutations for the shell." })]
    : [];
}

function collectRuntimeBoundaryFindings(project: ReturnType<typeof createCommanderConsoleUserLoveProject>): Finding[] {
  const runtimeSource = getUserLoveSourceFile(project, RUNTIME_HANDLER_PATH);
  return hasPropertyAccessPath(runtimeSource, ["activeWorkbench", "evidenceStore"])
    ? [createFinding({ lawId: APP_SHELL_LAW_ID, file: RUNTIME_HANDLER_PATH, line: 1, severity: "fatal", message: "Runtime read handlers must not query evidence store directly for Commander UI reads." })]
    : [];
}

function collectCandidateBoundaryFindings(project: ReturnType<typeof createCommanderConsoleUserLoveProject>): Finding[] {
  const candidateSource = getUserLoveSourceFile(project, CANDIDATE_HANDLER_PATH);
  return hasPropertyAccessPath(candidateSource, ["activeWorkbench", "deleteCandidate"]) || hasPropertyAccessPath(candidateSource, ["activeWorkbench", "exportCandidateSummaries"])
    ? [createFinding({ lawId: APP_SHELL_LAW_ID, file: CANDIDATE_HANDLER_PATH, line: 1, severity: "fatal", message: "Candidate handlers must not bypass Commander public boundaries for delete/export mutations." })]
    : [];
}

function collectTaskBoundaryFindings(project: ReturnType<typeof createCommanderConsoleUserLoveProject>): Finding[] {
  const taskSource = getUserLoveSourceFile(project, TASK_HANDLER_PATH);
  return !hasStartRequiredBothCondition(taskSource)
    ? [createFinding({ lawId: LAW_ID, file: TASK_HANDLER_PATH, line: 1, severity: "fatal", message: "Task start handler must require both requestedPlatformId and selectedMapId." })]
    : [];
}

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = createCommanderConsoleUserLoveProject();
  const findings = [
    ...collectShellBoundaryFindings(project),
    ...collectServerBoundaryFindings(project),
    ...collectRuntimeBoundaryFindings(project),
    ...collectCandidateBoundaryFindings(project),
    ...collectTaskBoundaryFindings(project),
  ];

  return {
    findings,
    phase: createPhase(
      "boundary-attack",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Commander Console user-love shell stays on render-only UI boundaries while commands still enter through the Commander public surface."
        : "Commander Console user-love shell still leaks into direct runtime, evidence store, or relaxed command boundaries.",
    ),
  };
}