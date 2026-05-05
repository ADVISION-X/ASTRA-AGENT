import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { runStartupExitClassificationChecks } from "./startup-exit-classification-checks.js";

const STARTUP_PATH = "scripts/startup/launch-grasseye.mjs";

async function runCheck(): Promise<{ passed: boolean; violationCount: number }> {
  await buildAuditArtifacts();
  const result = await runStartupExitClassificationChecks();
  return { passed: result.findings.length === 0, violationCount: result.findings.length };
}

function createResult(findings: Finding[], summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings,
    phase: createPhase("startup-exit-negative-proof", findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT", findings.length === 0, summary),
  };
}

export async function runStartupExitNegativeProof(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const filePath = pathFromRepoRoot(STARTUP_PATH);
  const state = await readAuditFileState(filePath);

  try {
    const baseline = await runCheck();
    if (!baseline.passed) {
      return createResult([
        createFinding({
          lawId: "GRASSEYE-STRUCTURED-LOGGING-009-V1",
          file: STARTUP_PATH,
          line: 1,
          severity: "fatal",
          message: "Startup exit classification baseline must pass before startup exit negative proof runs.",
        }),
      ], "Startup exit negative proof could not start because the baseline inspector is already failing.");
    }

    await applyAuditMutation(filePath, state.original, {
      name: "startup controlled exit classification removal mutation",
      file: STARTUP_PATH,
      search: '  return shuttingDown || exit.signal === "SIGTERM" || exit.code === 143;\n',
      replace: '  return shuttingDown;\n',
    });

    const mutated = await runCheck();
    if (mutated.passed || mutated.violationCount === 0) {
      return createResult([
        createFinding({
          lawId: "GRASSEYE-STRUCTURED-LOGGING-009-V1",
          file: STARTUP_PATH,
          line: 1,
          severity: "fatal",
          message: "Startup exit classification check did not fail when startup lost controlled-exit classification.",
        }),
      ], "Startup exit negative proof failed because the inspector accepted a controlled-exit classification regression.");
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runCheck();
  if (!restored.passed) {
    return createResult([
      createFinding({
        lawId: "GRASSEYE-STRUCTURED-LOGGING-009-V1",
        file: STARTUP_PATH,
        line: 1,
        severity: "fatal",
        message: "Rollback verification failed after startup exit negative proof mutation.",
      }),
    ], "Startup exit negative proof failed because rollback did not restore a passing baseline.");
  }

  return createResult([], "Startup exit negative proof rejects controlled-exit classification regressions and restores the passing baseline.");
}