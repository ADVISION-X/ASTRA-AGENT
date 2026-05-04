import { spawnSync } from "node:child_process";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
  expectedNeedle: string;
};

const {
  INSPECTOR_ENTRY,
  LAW_ID_001,
  SKIP_NEGATIVE_PROOF_ENV,
} = capabilityGroupGovernanceConstants;

const RUN_INSPECTOR_ENTRY = "scripts/audit/domains/capability-group-governance/run-inspector.ts";

const MUTATIONS: Mutation[] = [
  {
    name: "package audit entrypoint drift mutation",
    file: "package.json",
    search: '    "audit:mouse-click": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    replace: '    "audit:runtime-debug-transparency": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    expectedNeedle: "package.json must not expose audit:runtime-debug-transparency; only constitutional owners may publish audit entrypoints.",
  },
  {
    name: "negative-proof invocation removed mutation",
    file: INSPECTOR_ENTRY,
    search: "    : await runNegativeProofHarness();",
    replace: "    : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"negative-proof removed by mutation\" } };",
    expectedNeedle: "Capability-group-governance inspector must invoke and report the negative-proof harness.",
  },
];

function runInspectorProcess(): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    "node",
    ["--import", "tsx", RUN_INSPECTOR_ENTRY],
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

async function mutateAndVerify(mutation: Mutation): Promise<string> {
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
        lawId: LAW_ID_001,
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
  try {
    const baseline = runInspectorProcess();
    if (baseline.status !== 0) {
      return createFatalResult(
        "Capability-group-governance inspector baseline must pass before negative-proof mutation checks.",
        "Capability-group-governance negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    const reports: string[] = [];
    for (const mutation of MUTATIONS) {
      reports.push(await mutateAndVerify(mutation));
    }

    return createPassResult(
      `Capability-group-governance negative-proof harness rejects ${reports.join(", ")}.`,
    );
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Capability-group-governance negative-proof harness failed.",
      "Capability-group-governance negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}