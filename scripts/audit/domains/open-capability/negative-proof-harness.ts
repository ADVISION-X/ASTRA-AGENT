import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { pathToFileURL } from "node:url";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { writeOwnerBindingProof } from "../_shared/owner-binding-proof-writer.js";
import { writeProductionMutationProof } from "../_shared/production-mutation-proof-writer.js";
import { MUTATIONS, MUTATION_LAW_COVERAGE, OWNER_BINDING_MUTATION_NAMES, type Mutation } from "./negative-proof-definitions.js";
import { collectOpenLawBaselineFindings } from "./negative-proof-law-baseline.js";
import { openInspectionConstants as config } from "./inspection-constants.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/open-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_OPEN_NEGATIVE_PROOF";

type MutationProofRecord = {
  mutation: Mutation;
  originalContent: string;
  mutatedContent: string;
  failOutput: string;
  passOutput: string;
  startedAt: string;
  endedAt: string;
};

async function runInspector(skipBuild = false): Promise<{ passed: boolean; violationCount: number; output: string }> {
  if (!skipBuild) {
    await buildAuditArtifacts();
  }
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  const previousSkip = process.env[SKIP_NEGATIVE_PROOF_ENV];
  process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";
  let result;
  try {
    result = await inspector(context);
  } finally {
    if (previousSkip === undefined) {
      delete process.env[SKIP_NEGATIVE_PROOF_ENV];
    } else {
      process.env[SKIP_NEGATIVE_PROOF_ENV] = previousSkip;
    }
  }
  const lawBaselineFindings = await collectOpenLawBaselineFindings();
  const findings = [...result.findings, ...lawBaselineFindings];

  return {
    passed: findings.length === 0,
    violationCount: findings.length,
    output: [
      `passed: ${findings.length === 0}`,
      `violationCount: ${findings.length}`,
      "",
      ...findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.lawId ?? "no-law"} ${finding.file}:${finding.line} ${finding.message}`),
      "",
    ].join("\n"),
  };
}

async function mutateAndVerify(mutation: Mutation): Promise<MutationProofRecord> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  const startedAt = new Date().toISOString();
  await applyAuditMutation(filePath, state.original, mutation);
  const mutatedContent = state.original.replace(mutation.search, mutation.replace);
  let failOutput = "";

  try {
    const result = await runInspector(mutation.skipBuild ?? false);
    failOutput = result.output;
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector(mutation.skipBuild ?? false);
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }

  return {
    mutation,
    originalContent: state.original,
    mutatedContent,
    failOutput,
    passOutput: restored.output,
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

async function writeMutationProof(record: MutationProofRecord): Promise<void> {
  const coverage = MUTATION_LAW_COVERAGE[record.mutation.name];
  if (!coverage) {
    return;
  }

  await writeProductionMutationProof({
    owner: "open",
    ownerTitle: "Open",
    mutationName: record.mutation.name,
    scenarioId: record.mutation.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    coveredLawIds: coverage.coveredLawIds,
    coverageReasonByLawId: coverage.coverageReasonByLawId,
    mutatedFile: record.mutation.file,
    originalContent: record.originalContent,
    mutatedContent: record.mutatedContent,
    failOutput: record.failOutput,
    passOutput: record.passOutput,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
  });
}

async function writeOwnerBindingBundle(records: MutationProofRecord[]): Promise<void> {
  const scenarios = OWNER_BINDING_MUTATION_NAMES.flatMap((mutationName) => {
    const record = records.find((candidate) => candidate.mutation.name === mutationName);
    return record
      ? [{
        scenario: mutationName.replace(/-/g, " "),
        outputFileName: `${mutationName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-fail.txt`,
        output: record.failOutput,
      }]
      : [];
  });

  await writeOwnerBindingProof({
    owner: "open",
    title: "Open",
    scenarios,
    rollbackOutput: records.at(-1)?.passOutput ?? "rollback restored baseline PASS",
  });
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
      createFinding({ lawId: config.LAW_ENFORCEMENT, file: INSPECTOR_ENTRY, line: 1, severity: "fatal", message }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      throw new Error("Baseline open-capability inspector must pass before negative proof.");
    }

    const records: MutationProofRecord[] = [];
    for (const mutation of MUTATIONS) {
      const record = await mutateAndVerify(mutation);
      records.push(record);
      await writeMutationProof(record);
    }

    await writeOwnerBindingBundle(records);

    return createPassResult("Open negative-proof harness rejects enforcement drift, open ownership leaks, forbidden imports, chain loss, runtime governance escape, missing page-state handoff, package-shape drift, and local-program regressions.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Open negative-proof harness failed.",
      "Open negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}

async function main(): Promise<void> {
  const result = await runNegativeProofHarness();
  if (!result.phase.passed) {
    throw new Error(result.findings[0]?.message ?? "Open negative-proof harness failed.");
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void main();
}
