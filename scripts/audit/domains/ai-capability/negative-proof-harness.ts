import { readFile } from "node:fs/promises";

import { createFinding, createPhase } from "../../core/result.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { Finding, InspectorPhase, InspectorResult } from "../../core/schema.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { writeProductionMutationProof } from "../_shared/production-mutation-proof-writer.js";
import { MUTATIONS, SKIP_NEGATIVE_PROOF_ENV, type Mutation } from "./negative-proof-definitions.js";
import { MUTATION_LAW_COVERAGE } from "./negative-proof-law-coverage.js";

type InspectorRun = {
  passed: boolean;
  violationCount: number;
  output: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/ai-capability/inspector.ts";

const formatInspectorOutput = (input: {
  mutationName?: string | undefined;
  result: InspectorResult;
}): string => [
  input.mutationName ? `mutationName: ${input.mutationName}` : "baseline",
  `classification: ${input.result.classification}`,
  `passed: ${input.result.passed}`,
  `violationCount: ${input.result.violationCount}`,
  `summary: ${input.result.summary}`,
  "",
  ...input.result.findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.lawId ?? "no-law"} ${finding.file}:${finding.line} ${finding.message}`),
  "",
].join("\n");

async function runInspector(mutationName?: string): Promise<InspectorRun> {
  const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
  process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";

  try {

    const artifacts = await loadGeneratedArtifacts();
    const context = await createInspectorContext(artifacts);
    const inspector = await loadInspector(INSPECTOR_ENTRY);
    const result = await inspector(context);
    return {
      passed: result.passed,
      violationCount: result.violationCount,
      output: formatInspectorOutput({ mutationName, result }),
    };
  } finally {
    if (previous === undefined) {
      delete process.env[SKIP_NEGATIVE_PROOF_ENV];
    } else {
      process.env[SKIP_NEGATIVE_PROOF_ENV] = previous;
    }
  }
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  const startedAt = new Date().toISOString();
  await applyAuditMutation(filePath, state.original, mutation);
  const mutatedContent = await readFile(filePath, "utf8");
  let failOutput = "";

  try {
    const result = await runInspector(mutation.name);
    failOutput = result.output;
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector(mutation.name);
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }

  const coverage = MUTATION_LAW_COVERAGE[mutation.name];
  if (coverage) {
    await writeProductionMutationProof({
      owner: "ai",
      ownerTitle: "AI",
      mutationName: mutation.name,
      scenarioId: mutation.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      coveredLawIds: coverage.coveredLawIds,
      coverageReasonByLawId: coverage.coverageReasonByLawId,
      mutatedFile: mutation.file,
      originalContent: state.original,
      mutatedContent,
      failOutput,
      passOutput: restored.output,
      startedAt,
      endedAt: new Date().toISOString(),
    });
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
        lawId: "GRASSEYE-AI-CAPABILITY-007-V1",
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

async function runMutations(runInspector: () => Promise<{ passed: boolean; violationCount: number }>): Promise<void> {
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
    process.stdout.write(`[NEGATIVE-PROOF] PASS ${mutation.name}\n`);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    if (MUTATIONS.length === 0) {
      return createFatalResult(
        "AI negative-proof mutations must not be empty.",
        "AI negative-proof harness has no mutation scenarios and cannot prove machine-blocking enforcement.",
      );
    }

    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "AI inspector baseline must pass before negative-proof mutation checks.",
        "AI negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations(runInspector);

    return createPassResult(
      "AI negative-proof harness rejects gate bypass, proof drop, output-boundary escape, disabled-child execute, internal gateway import, adapter import laundering, and type-escape mutations.",
    );
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "AI negative-proof harness failed.",
      "AI negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
