import { spawnSync } from "node:child_process";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
  expectedNeedle: string;
  skipBuild?: boolean;
};

type InspectorProcessResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";
const INSPECTOR_ENTRY = "scripts/audit/domains/audit-system/inspector.ts";
const RUN_INSPECTOR_ENTRY = "scripts/audit/domains/audit-system/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_AUDIT_SYSTEM_NEGATIVE_PROOF";
const SKIP_CODE_PURITY_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_CODE_PURITY_NEGATIVE_PROOF";
const SKIP_AUDIT_SYSTEM_CODE_PURITY_ENV = "GRASSEYE_SKIP_AUDIT_SYSTEM_CODE_PURITY";

const MUTATIONS: Mutation[] = [
  {
    name: "negative-proof wiring validator removed mutation",
    file: "scripts/audit/domains/audit-system/components/run-audit-red-line-checks.ts",
    search: "    validateNegativeProofWiring(context),",
    replace: "    validateOwnedLawExecution(context),",
    expectedNeedle: "Audit-system inspector must execute validateNegativeProofWiring inside its Promise.all owner chain.",
    skipBuild: true,
  },
  {
    name: "phase gate audit-system removal mutation",
    file: "scripts/audit/phase-gates/phase-04-full-enforcement.json",
    search: "\"audit-system\",",
    replace: "\"agent-runtime\",",
    expectedNeedle: "Current phase gate must keep audit-system active.",
    skipBuild: true,
  },
  {
    name: "generated artifact hand-edit mutation",
    file: "scripts/audit/generated/audit-plan.generated.json",
    search: "  \"phase\": \"phase-04-full-enforcement\",",
    replace: "  \"phase\": \"phase-04-hand-edited\",",
    expectedNeedle: "Generated artifact content drifted away from the rebuild output; generated files must not be hand-edited.",
    skipBuild: true,
  },
  {
    name: "negative-proof invocation removed mutation",
    file: INSPECTOR_ENTRY,
    search: "      : runNegativeProofHarness(),",
    replace: "      : Promise.resolve({ findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"negative-proof removed by mutation\" } }),",
    expectedNeedle: "Audit-system inspector must invoke and report the negative-proof harness.",
    skipBuild: true,
  },
];

function runInspectorProcess(skipBuild = false): InspectorProcessResult {
  const result = spawnSync(
    "node",
    ["--import", "tsx", RUN_INSPECTOR_ENTRY, ...(skipBuild ? ["--skip-build"] : [])],
    {
      cwd: pathFromRepoRoot("."),
      encoding: "utf8",
      env: {
        ...process.env,
        [SKIP_NEGATIVE_PROOF_ENV]: "1",
        [SKIP_CODE_PURITY_NEGATIVE_PROOF_ENV]: "1",
        [SKIP_AUDIT_SYSTEM_CODE_PURITY_ENV]: "1",
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

const formatInspectorOutput = (result: InspectorProcessResult): string => `${result.stdout}\n${result.stderr}`;

async function mutateAndVerify(mutation: Mutation, baseline: InspectorProcessResult): Promise<string> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const failRun = runInspectorProcess(mutation.skipBuild);
    const combinedOutput = formatInspectorOutput(failRun);
    if (failRun.status === 0) {
      throw new Error(`Mutation ${mutation.name} did not fail inspector as expected.\n${combinedOutput}`);
    }
    if (!combinedOutput.includes(mutation.expectedNeedle)) {
      throw new Error(`Mutation ${mutation.name} failed, but not for the expected reason. Missing needle: ${mutation.expectedNeedle}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const rollbackRun = runInspectorProcess(mutation.skipBuild);
  if (rollbackRun.status !== baseline.status || formatInspectorOutput(rollbackRun) !== formatInspectorOutput(baseline)) {
    throw new Error(`Mutation ${mutation.name} did not restore the baseline inspector result after rollback.\n${rollbackRun.stdout}\n${rollbackRun.stderr}`);
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
        lawId: LAW_ID,
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
    const baseline = runInspectorProcess(true);
    const baselineOutput = formatInspectorOutput(baseline);

    if (MUTATIONS.some((mutation) => baselineOutput.includes(mutation.expectedNeedle))) {
      return createFatalResult(
        "Audit-system negative-proof harness baseline already contains a mutation target finding and cannot prove a delta safely.",
        "Audit-system negative-proof harness cannot start because the baseline output already contains a mutation target finding.",
      );
    }

    const reports: string[] = [];
    for (const mutation of MUTATIONS) {
      reports.push(await mutateAndVerify(mutation, baseline));
    }

    return createPassResult(`Audit-system negative-proof harness rejects ${reports.join(", ")}.`);
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Audit-system negative-proof harness failed.",
      "Audit-system negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
