import { createInspectorContext, loadGeneratedArtifacts } from "../../core/runtime.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult, hasBlockingFindings } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { resetAuditProject } from "../../core/ts-morph.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

import { indexInspectionConstants } from "./inspection-constants.js";
import { buildIndexInspectionSummary, collectIndexInspectionWithoutNegativeProof } from "./inspection-parts.js";
import { indexBlueprintAndGovernanceMutations } from "./negative-proof-blueprint-mutations.js";
import { indexRouteMutations } from "./negative-proof-route-mutations.js";
import { indexStandardPackageMutations } from "./negative-proof-standard-package-mutations.js";
import type { Mutation } from "./negative-proof-types.js";

type InspectorProcessResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

const {
  INSPECTOR_ENTRY,
  REQUIREMENT_ID_001,
  SKIP_NEGATIVE_PROOF_ENV,
} = indexInspectionConstants;
const NEGATIVE_PROOF_FILTER_ENV = "GRASSEYE_INDEX_NEGATIVE_PROOF_FILTER";
const NEGATIVE_PROOF_VERBOSE_ENV = "GRASSEYE_INDEX_NEGATIVE_PROOF_VERBOSE";

const MUTATIONS: Mutation[] = [
  ...indexRouteMutations,
  ...indexBlueprintAndGovernanceMutations,
  ...indexStandardPackageMutations,
];

const getActiveMutations = (): Mutation[] => {
  const filter = process.env[NEGATIVE_PROOF_FILTER_ENV]?.trim();
  if (!filter) {
    return MUTATIONS;
  }

  const tokens = filter.split(",").map((token) => token.trim()).filter(Boolean);
  return MUTATIONS.filter((mutation) =>
    tokens.some((token) => mutation.name.includes(token) || mutation.file.includes(token) || mutation.expectedNeedle.includes(token)));
};

const logNegativeProofProgress = (message: string): void => {
  if (process.env[NEGATIVE_PROOF_VERBOSE_ENV] === "1") {
    process.stdout.write(`${message}\n`);
  }
};

const shouldResetProjectForMutation = (mutationFile: string): boolean =>
  mutationFile.endsWith(".ts") || mutationFile.endsWith(".tsx") || mutationFile.endsWith(".js") || mutationFile.endsWith(".jsx") || mutationFile.endsWith(".mjs");

async function runInspectorProcess(input?: { resetProject?: boolean }): Promise<InspectorProcessResult> {
  process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";
  if (input?.resetProject) {
    resetAuditProject();
  }

  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspection = await collectIndexInspectionWithoutNegativeProof(context);
  const result = finalizeInspectorResult({
    inspector: "GrassEye Index Routing Inspector",
    inspectorId: "index-owner",
    capabilityDomain: "index",
    findings: inspection.findings,
    phases: inspection.phases,
    summary: buildIndexInspectionSummary(inspection.findings.length),
  });

  const stdoutLines = [`[${result.classification}] ${result.capabilityDomain}: ${result.summary}`];
  for (const finding of result.findings) {
    stdoutLines.push(`- ${finding.severity.toUpperCase()} ${finding.file}:${finding.line} ${finding.message}`);
  }

  return {
    status: !result.passed || hasBlockingFindings(result.findings) ? 1 : 0,
    stdout: `${stdoutLines.join("\n")}\n`,
    stderr: "",
  };
}

const formatInspectorOutput = (result: InspectorProcessResult): string => `${result.stdout}\n${result.stderr}`;

async function mutateAndVerify(mutation: Mutation, baseline: InspectorProcessResult): Promise<string> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  const resetProject = shouldResetProjectForMutation(mutation.file);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const failRun = await runInspectorProcess({ resetProject });
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

  let rollbackRun = await runInspectorProcess({ resetProject });
  for (let attempt = 0; rollbackRun.status !== baseline.status && attempt < 3; attempt += 1) {
    rollbackRun = await runInspectorProcess({ resetProject });
  }
  if (rollbackRun.status !== baseline.status) {
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
  try {
    const activeMutations = getActiveMutations();
    logNegativeProofProgress(`[index-negative-proof] baseline start (${activeMutations.length} mutations)`);
    const baseline = await runInspectorProcess({ resetProject: true });
    const baselineOutput = formatInspectorOutput(baseline);

    if (activeMutations.some((mutation) => baselineOutput.includes(mutation.expectedNeedle))) {
      return createFatalResult(
        "Index negative-proof harness baseline already contains a mutation target finding and cannot prove a delta safely.",
        "Index negative-proof harness cannot start because the baseline output already contains a mutation target finding.",
      );
    }

    const reports: string[] = [];
    for (const [index, mutation] of activeMutations.entries()) {
      logNegativeProofProgress(`[index-negative-proof] mutation ${index + 1}/${activeMutations.length}: ${mutation.name}`);
      reports.push(await mutateAndVerify(mutation, baseline));
    }

    return createPassResult(`Index negative-proof harness rejects ${reports.join(", ")}.`);
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Index negative-proof harness failed.",
      "Index negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}