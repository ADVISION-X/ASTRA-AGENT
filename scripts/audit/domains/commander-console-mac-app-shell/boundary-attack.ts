import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  APP_SHELL_LAW_ID,
  CANDIDATE_HANDLER_PATH,
  CREATE_SERVER_PATH,
  MAC_SHELL_PATH,
  PAGE_RENDER_PATH,
  RUNTIME_HANDLER_PATH,
  TASK_HANDLER_PATH,
  createCommanderConsoleMacShellProject,
  getMacShellSourceFile,
  hasForbiddenImport,
  hasPropertyAccessPath,
  hasStartRequiredBothCondition,
} from "./ast-utils.js";
import { LAW_ID } from "./ast-utils.js";

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = createCommanderConsoleMacShellProject();
  const findings: Finding[] = [];

  for (const path of [MAC_SHELL_PATH, PAGE_RENDER_PATH]) {
    const sourceFile = getMacShellSourceFile(project, path);
    if (hasForbiddenImport(sourceFile)) {
      findings.push(createFinding({ lawId: LAW_ID, file: path, line: 1, severity: "fatal", message: "Mac shell crossed into forbidden runtime ownership." }));
    }
  }

  const createServerSource = getMacShellSourceFile(project, CREATE_SERVER_PATH);
  if (hasPropertyAccessPath(createServerSource, ["activeWorkbench", "evidenceStore"]) || hasPropertyAccessPath(createServerSource, ["activeWorkbench", "deleteCandidate"])) {
    findings.push(createFinding({ lawId: APP_SHELL_LAW_ID, file: CREATE_SERVER_PATH, line: 1, severity: "fatal", message: "Workbench server must not expose evidence store or delete mutations for the shell." }));
  }

  const runtimeSource = getMacShellSourceFile(project, RUNTIME_HANDLER_PATH);
  if (hasPropertyAccessPath(runtimeSource, ["activeWorkbench", "evidenceStore"])) {
    findings.push(createFinding({ lawId: APP_SHELL_LAW_ID, file: RUNTIME_HANDLER_PATH, line: 1, severity: "fatal", message: "Runtime read handlers must not query evidence store directly for Commander UI reads." }));
  }

  const candidateSource = getMacShellSourceFile(project, CANDIDATE_HANDLER_PATH);
  if (hasPropertyAccessPath(candidateSource, ["activeWorkbench", "deleteCandidate"]) || hasPropertyAccessPath(candidateSource, ["activeWorkbench", "exportCandidateSummaries"])) {
    findings.push(createFinding({ lawId: APP_SHELL_LAW_ID, file: CANDIDATE_HANDLER_PATH, line: 1, severity: "fatal", message: "Candidate handlers must not bypass Commander public boundaries for delete/export mutations." }));
  }

  const taskSource = getMacShellSourceFile(project, TASK_HANDLER_PATH);
  if (!hasStartRequiredBothCondition(taskSource)) {
    findings.push(createFinding({ lawId: LAW_ID, file: TASK_HANDLER_PATH, line: 1, severity: "fatal", message: "Task start handler must require both requestedPlatformId and selectedMapId." }));
  }

  return {
    findings,
    phase: createPhase(
      "boundary-attack",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Mac shell stays on render-only UI boundaries while task start still enters through governed Commander handlers."
        : "Mac shell still leaks into forbidden runtime ownership or relaxed task-start boundaries.",
    ),
  };
}