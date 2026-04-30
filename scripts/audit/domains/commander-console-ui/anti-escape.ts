import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import {
  APP_SHELL_LAW_ID,
  CANDIDATE_HANDLER_PATH,
  CREATE_SERVER_PATH,
  LAW_ID,
  PAGE_RENDER_PATH,
  RUNTIME_HANDLER_PATH,
  TASK_HANDLER_PATH,
  createCommanderConsoleUiProject,
  getUiFeatureSourceFiles,
  getUiSourceFile,
  hasUnsafeEscape,
} from "./ast-utils.js";

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = createCommanderConsoleUiProject();
  const findings: Finding[] = [];

  for (const sourceFile of getUiFeatureSourceFiles(project)) {
    if (hasUnsafeEscape(sourceFile)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: sourceFile.getFilePath().slice(sourceFile.getFilePath().indexOf("src/features/commander-console")),
        line: 1,
        severity: "fatal",
        message: "Commander Console UI contains a forbidden escape hatch or legacy dashboard marker.",
      }));
    }
  }

  for (const appFile of [PAGE_RENDER_PATH, CREATE_SERVER_PATH, TASK_HANDLER_PATH, CANDIDATE_HANDLER_PATH, RUNTIME_HANDLER_PATH]) {
    const sourceFile = getUiSourceFile(project, appFile);
    if (hasUnsafeEscape(sourceFile)) {
      findings.push(createFinding({
        lawId: APP_SHELL_LAW_ID,
        file: appFile,
        line: 1,
        severity: "fatal",
        message: "Commander Console shell boundary file contains a forbidden escape hatch or legacy dashboard marker.",
      }));
    }
  }

  return {
    findings,
    phase: createPhase(
      "anti-escape",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Commander Console UI rejects any-casts, unknown-casts, suppression comments, export-star drift, and legacy dashboard identifiers."
        : "Commander Console UI still carries an unsafe escape hatch or legacy dashboard residue.",
    ),
  };
}