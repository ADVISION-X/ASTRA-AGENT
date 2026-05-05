import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

import { runStructuredLoggingChecks } from "./run-structured-logging-checks.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/structured-logging/inspector.ts";

const MUTATIONS: Mutation[] = [
  {
    name: "structured action log parent refs contract mutation",
    file: "src/capabilities/forensics-persistence/children/write-structured-action-log/contract.ts",
    search: "  requireParentRefs: false,\n",
    replace: "  requireParentRefs: true,\n",
  },
  {
    name: "structured action log failed write guard removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-step-trace-recorder.ts",
    search: "  if (result.status === \"failed\") {\n    return null;\n  }\n\n",
    replace: "",
  },
  {
    name: "structured runtime event action chain relay removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-step-trace-recorder.ts",
    search: "    actionRef: input.actionRef ?? null,\n    postActionVerificationRef: input.postActionVerificationRef ?? null,\n",
    replace: "",
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  const result = await runStructuredLoggingChecks();
  const passed = result.findings.length === 0 && result.phases.every((phase) => phase.passed);
  return { passed, violationCount: result.findings.length };
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const result = await runInspector();
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }
}

function createPassResult(summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings: [],
    phase: createPhase("negative-proof-harness", "PASS", true, summary),
  };
}

function createFatalResult(message: string, summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings: [
      createFinding({
        lawId: "GRASSEYE-STRUCTURED-LOGGING-003-V1",
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

async function runMutations(): Promise<void> {
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Structured logging inspector baseline must pass before negative-proof mutation checks.",
        "Structured logging negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Structured logging negative-proof harness rejects action-log parentRefs regression, failed-write guard removal, and runtime event action-chain relay removal mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Structured logging negative-proof harness failed.",
      "Structured logging negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
