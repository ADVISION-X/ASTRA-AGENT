import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS, PATHS } from "./config.js";
import { createCommanderConsoleMacShellProject, getMacShellSourceFile } from "./project-access.js";
import { hasForbiddenImport, hasPropertyAccessPath, hasStartRequiredBothCondition } from "./source-rules.js";

function collectShellBoundaryFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const findings: Finding[] = [];
  for (const path of [PATHS.MAC_SHELL, PATHS.PAGE_RENDER]) {
    const sourceFile = getMacShellSourceFile(project, path);
    if (hasForbiddenImport(sourceFile)) {
      findings.push(createFinding({ lawId: LAW_IDS.DOMAIN, file: path, line: 1, severity: "fatal", message: "Mac shell crossed into forbidden runtime ownership." }));
    }
  }
  return findings;
}

function collectServerBoundaryFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const createServerSource = getMacShellSourceFile(project, PATHS.CREATE_SERVER);
  return hasPropertyAccessPath(createServerSource, ["activeWorkbench", "evidenceStore"]) || hasPropertyAccessPath(createServerSource, ["activeWorkbench", "deleteCandidate"])
    ? [createFinding({ lawId: LAW_IDS.APP_SHELL, file: PATHS.CREATE_SERVER, line: 1, severity: "fatal", message: "Workbench server must not expose evidence store or delete mutations for the shell." })]
    : [];
}

function collectRuntimeBoundaryFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const runtimeSource = getMacShellSourceFile(project, PATHS.RUNTIME_HANDLER);
  return hasPropertyAccessPath(runtimeSource, ["activeWorkbench", "evidenceStore"])
    ? [createFinding({ lawId: LAW_IDS.APP_SHELL, file: PATHS.RUNTIME_HANDLER, line: 1, severity: "fatal", message: "Runtime read handlers must not query evidence store directly for Commander UI reads." })]
    : [];
}

function collectCandidateBoundaryFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const candidateSource = getMacShellSourceFile(project, PATHS.CANDIDATE_HANDLER);
  return hasPropertyAccessPath(candidateSource, ["activeWorkbench", "deleteCandidate"]) || hasPropertyAccessPath(candidateSource, ["activeWorkbench", "exportCandidateSummaries"])
    ? [createFinding({ lawId: LAW_IDS.APP_SHELL, file: PATHS.CANDIDATE_HANDLER, line: 1, severity: "fatal", message: "Candidate handlers must not bypass Commander public boundaries for delete/export mutations." })]
    : [];
}

function collectTaskBoundaryFindings(project: ReturnType<typeof createCommanderConsoleMacShellProject>): Finding[] {
  const taskSource = getMacShellSourceFile(project, PATHS.TASK_HANDLER);
  return !hasStartRequiredBothCondition(taskSource)
    ? [createFinding({ lawId: LAW_IDS.DOMAIN, file: PATHS.TASK_HANDLER, line: 1, severity: "fatal", message: "Task start handler must require both requestedPlatformId and selectedMapId." })]
    : [];
}

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = createCommanderConsoleMacShellProject();
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
        ? "Mac shell stays on render-only UI boundaries while task start still enters through governed Commander handlers."
        : "Mac shell still leaks into forbidden runtime ownership or relaxed task-start boundaries.",
    ),
  };
}