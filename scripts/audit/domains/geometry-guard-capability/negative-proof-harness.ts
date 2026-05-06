import { readFile, writeFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts } from "../../core/runtime.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { writeOwnerBindingProof } from "../_shared/owner-binding-proof-writer.js";
import { writeProductionMutationProof } from "../_shared/production-mutation-proof-writer.js";
import { runGeometryGuardChecks } from "./run-geometry-guard-checks.js";
import { MUTATIONS, MUTATION_LAW_COVERAGE, OWNER_BINDING_MUTATION_NAMES, type NegativeProofMutation, type ReplaceMutation } from "./negative-proof-definitions.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/geometry-guard-capability/inspector.ts";
const LAW_FILE = ".github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md";

type InspectorRun = {
  passed: boolean;
  violationCount: number;
  output: string;
};

type MutationProofRecord = {
  mutation: NegativeProofMutation;
  originalContent: string;
  mutatedContent: string;
  failOutput: string;
  passOutput: string;
  startedAt: string;
  endedAt: string;
};

async function collectLawBaselineFindings(): Promise<Finding[]> {
  const content = await readFile(pathFromRepoRoot(LAW_FILE), "utf8");
  const findings: Finding[] = [];

  if (content.includes("enforcementMode: manual-first")) {
    findings.push({
      lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
      file: LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Geometry Guard active laws must remain machine-blocking.",
    });
  }
  if (content.includes("tier: P1")) {
    findings.push({
      lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
      file: LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Geometry Guard active laws must remain P0.",
    });
  }
  if (content.includes("evidenceMode: law\n") || content.includes("evidenceMode: law\r\n")) {
    findings.push({
      lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
      file: LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Geometry Guard active laws must keep law+inspector+negative-proof evidence mode.",
    });
  }

  return findings;
}

async function runInspector(): Promise<InspectorRun> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "geometry-guard-capability",
    inspectorId: "geometry-guard-capability-owner",
    inspectorEntry: INSPECTOR_ENTRY,
  });
  const lawBaselineFindings = await collectLawBaselineFindings();
  const checks = await runGeometryGuardChecks();
  const findings = [...base.findings, ...lawBaselineFindings, ...checks.findings];
  const passed = findings.length === 0;

  return {
    passed,
    violationCount: findings.length,
    output: [
      `passed: ${passed}`,
      `violationCount: ${findings.length}`,
      "",
      ...findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.lawId ?? "no-law"} ${finding.file}:${finding.line} ${finding.message}`),
      "",
    ].join("\n"),
  };
}

function applyReplaceMutation(source: string, mutation: ReplaceMutation): string {
  const matchIndex = source.indexOf(mutation.oldText);
  if (matchIndex === -1) {
    throw new Error(`Mutation ${mutation.name} could not find target text in ${mutation.file}`);
  }

  return `${source.slice(0, matchIndex)}${mutation.newText}${source.slice(matchIndex + mutation.oldText.length)}`;
}

async function applyMutation(mutation: NegativeProofMutation): Promise<{ rollback: () => Promise<void>; originalContent: string; mutatedContent: string }> {
  const absolutePath = pathFromRepoRoot(mutation.file);
  const originalContent = await readFile(absolutePath, "utf8");
  const mutatedContent = applyReplaceMutation(originalContent, mutation);
  await writeFile(absolutePath, mutatedContent, "utf8");
  return {
    rollback: async () => {
      await writeFile(absolutePath, originalContent, "utf8");
    },
    originalContent,
    mutatedContent,
  };
}

async function mutateAndVerify(mutation: NegativeProofMutation): Promise<MutationProofRecord> {
  const startedAt = new Date().toISOString();
  const applied = await applyMutation(mutation);
  let failOutput = "";
  try {
    const mutated = await runInspector();
    failOutput = mutated.output;
    if (mutated.passed || mutated.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await applied.rollback();
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }

  return {
    mutation,
    originalContent: applied.originalContent,
    mutatedContent: applied.mutatedContent,
    failOutput,
    passOutput: restored.output,
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

const writeMutationProof = async (record: MutationProofRecord): Promise<void> => {
  const coverage = MUTATION_LAW_COVERAGE[record.mutation.name];
  if (!coverage) {
    return;
  }

  await writeProductionMutationProof({
    owner: "geometry-guard",
    ownerTitle: "Geometry Guard",
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
};

const writeOwnerBindingBundle = async (records: MutationProofRecord[]): Promise<void> => {
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
    owner: "geometry-guard",
    title: "Geometry Guard",
    scenarios,
    rollbackOutput: records.at(-1)?.passOutput ?? "rollback restored baseline PASS",
  });
};

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
        lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
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
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Geometry Guard inspector baseline must pass before negative-proof mutation checks.",
        "Geometry Guard negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    const records: MutationProofRecord[] = [];
    for (const mutation of MUTATIONS) {
      const record = await mutateAndVerify(mutation);
      records.push(record);
      await writeMutationProof(record);
    }
    await writeOwnerBindingBundle(records);

    return createPassResult("Geometry Guard negative-proof harness rejects law weakening, input chain drift, silent clamp, fabricated proof chain, output-boundary drift, and child boundary escape mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Geometry Guard negative-proof harness failed.",
      "Geometry Guard negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}