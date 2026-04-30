import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  APP_SHELL_LAW_ID,
  CANDIDATE_HANDLER_PATH,
  COMMAND_SCHEMA_PATH,
  CREATE_SERVER_PATH,
  LAW_ID,
  ROOT,
  RUNTIME_HANDLER_PATH,
  TASK_HANDLER_PATH,
  TRANSPORT_SCHEMA_PATH,
  createCommanderConsoleUiProject,
  getUiFeatureSourceFiles,
  getUiSourceFile,
  hasForbiddenImport,
  hasPropertyAccessPath,
  hasStartRequiredBothCondition,
} from "./ast-utils.js";

export function runBoundaryAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = createCommanderConsoleUiProject();
  const findings: Finding[] = [];

  for (const sourceFile of getUiFeatureSourceFiles(project)) {
    if (hasForbiddenImport(sourceFile)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: sourceFile.getFilePath().includes(ROOT) ? sourceFile.getFilePath().slice(sourceFile.getFilePath().indexOf(ROOT)) : sourceFile.getBaseName(),
        line: 1,
        severity: "fatal",
        message: "Commander Console UI imported a forbidden private runtime or child path.",
      }));
    }
  }

  const createServerSource = getUiSourceFile(project, CREATE_SERVER_PATH);
  if (hasPropertyAccessPath(createServerSource, ["activeWorkbench", "evidenceStore"]) || hasPropertyAccessPath(createServerSource, ["activeWorkbench", "evidenceStore", "getDataDir"])) {
    findings.push(createFinding({
      lawId: APP_SHELL_LAW_ID,
      file: CREATE_SERVER_PATH,
      line: 1,
      severity: "fatal",
      message: "Workbench server must not expose artifact streaming through evidenceStore or dataDir reads.",
    }));
  }

  const runtimeSource = getUiSourceFile(project, RUNTIME_HANDLER_PATH);
  if (hasPropertyAccessPath(runtimeSource, ["activeWorkbench", "evidenceStore"])) {
    findings.push(createFinding({
      lawId: APP_SHELL_LAW_ID,
      file: RUNTIME_HANDLER_PATH,
      line: 1,
      severity: "fatal",
      message: "Runtime read handlers must not query evidenceStore directly for Commander UI reads.",
    }));
  }

  const candidateSource = getUiSourceFile(project, CANDIDATE_HANDLER_PATH);
  if (hasPropertyAccessPath(candidateSource, ["activeWorkbench", "deleteCandidate"]) || hasPropertyAccessPath(candidateSource, ["activeWorkbench", "exportCandidateSummaries"])) {
    findings.push(createFinding({
      lawId: APP_SHELL_LAW_ID,
      file: CANDIDATE_HANDLER_PATH,
      line: 1,
      severity: "fatal",
      message: "Candidate handlers must not bypass Commander public boundaries to delete or export records directly.",
    }));
  }

  const taskSource = getUiSourceFile(project, TASK_HANDLER_PATH);
  if (!hasStartRequiredBothCondition(taskSource)) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TASK_HANDLER_PATH,
      line: 1,
      severity: "fatal",
      message: "Task start handler must require both requestedPlatformId and selectedMapId.",
    }));
  }

  const commandSchemaSource = getUiSourceFile(project, COMMAND_SCHEMA_PATH);
  if (!hasStartRequiredBothCondition(commandSchemaSource)) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: COMMAND_SCHEMA_PATH,
      line: 1,
      severity: "fatal",
      message: "Issue human command schema must require both requestedPlatformId and selectedMapId.",
    }));
  }

  const transportSchemaSource = getUiSourceFile(project, TRANSPORT_SCHEMA_PATH);
  if (!hasStartRequiredBothCondition(transportSchemaSource)) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TRANSPORT_SCHEMA_PATH,
      line: 1,
      severity: "fatal",
      message: "Start mission transport payload schema must require both requestedPlatformId and selectedMapId.",
    }));
  }

  return {
    findings,
    phase: createPhase(
      "boundary-attack",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Commander Console UI stays on public shell and command boundaries without filesystem, evidence store, or delete/export bypasses."
        : "Commander Console UI still leaks into private runtime, filesystem, or relaxed start-command boundaries.",
    ),
  };
}