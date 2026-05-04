import { spawnSync } from "node:child_process";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  acquireAuditMutationLock,
  applyAuditMutation,
  readAuditFileState,
  restoreAuditFileState,
} from "../_shared/read-audit-file-state.js";

import { kernelInspectionConstants } from "./inspection-constants.js";
import { kernelNegativeProofMutations, type KernelNegativeProofMutation } from "./kernel-negative-proof-mutations.js";

const {
  AI_PROMPT_CONTRACT_ROOT,
  BLUEPRINT_FILE,
  INSPECTOR_ENTRY,
  KERNEL_FILE,
  PROMPT_CONTRACT_GOVERNANCE_BLUEPRINT_FILE,
  REQUIREMENT_ID_001,
  RUN_INSPECTOR_FILE,
  SKIP_NEGATIVE_PROOF_ENV,
} = kernelInspectionConstants;

const MUTATIONS = kernelNegativeProofMutations({
  aiPromptContractRoot: AI_PROMPT_CONTRACT_ROOT,
  blueprintFile: BLUEPRINT_FILE,
  inspectorEntry: INSPECTOR_ENTRY,
  kernelFile: KERNEL_FILE,
  promptContractGovernanceBlueprintFile: PROMPT_CONTRACT_GOVERNANCE_BLUEPRINT_FILE,
  runInspectorFile: RUN_INSPECTOR_FILE,
});

function runInspectorProcess(): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    "node",
    ["--import", "tsx", RUN_INSPECTOR_FILE],
    {
      cwd: pathFromRepoRoot("."),
      encoding: "utf8",
      env: {
        ...process.env,
        [SKIP_NEGATIVE_PROOF_ENV]: "1",
        TSX_DISABLE_CACHE: "1",
      },
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

async function mutateAndVerify(mutation: KernelNegativeProofMutation): Promise<string> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const failRun = runInspectorProcess();
    const combinedOutput = `${failRun.stdout}\n${failRun.stderr}`;
    if (failRun.status === 0) {
      throw new Error(`Mutation ${mutation.name} did not fail inspector as expected.\n${combinedOutput}`);
    }
    if (!combinedOutput.includes(mutation.expectedNeedle)) {
      throw new Error(`Mutation ${mutation.name} failed, but not for the expected reason. Missing needle: ${mutation.expectedNeedle}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const rollbackRun = runInspectorProcess();
  if (rollbackRun.status !== 0) {
    throw new Error(`Mutation ${mutation.name} did not restore inspector PASS after rollback.\n${rollbackRun.stdout}\n${rollbackRun.stderr}`);
  }

  return `${mutation.name}: fail-ok rollback-ok`;
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
        lawId: REQUIREMENT_ID_001,
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const releaseHarnessLock = await acquireAuditMutationLock();
  try {
    const baseline = runInspectorProcess();
    if (baseline.status !== 0) {
      return createFatalResult(
        `Kernel inspector baseline must pass before negative-proof mutation checks.\n${baseline.stdout}\n${baseline.stderr}`,
        "Kernel negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    const reports: string[] = [];
    for (const mutation of MUTATIONS) {
      reports.push(await mutateAndVerify(mutation));
    }

    return createPassResult(`Kernel negative-proof harness rejects ${reports.join(", ")}.`);
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Kernel negative-proof harness failed.",
      "Kernel negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  } finally {
    await releaseHarnessLock();
  }
}
