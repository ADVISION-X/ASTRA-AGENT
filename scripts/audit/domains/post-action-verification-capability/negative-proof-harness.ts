import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { writeOwnerBindingProof } from "../_shared/owner-binding-proof-writer.js";
import { writeProductionMutationProof } from "../_shared/production-mutation-proof-writer.js";

import { LAW_IDS } from "./config.js";
import {
  OWNER_BINDING_MUTATION_NAMES,
  POST_ACTION_NEGATIVE_PROOF_MUTATIONS,
  MUTATION_LAW_COVERAGE,
  type NegativeProofMutation,
} from "./negative-proof-definitions.js";

type InspectorRun = {
  status: number | null;
  stdout: string;
  stderr: string;
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

export function getNegativeProofMutationPaths(): string[] {
  return POST_ACTION_NEGATIVE_PROOF_MUTATIONS.map((mutation) => pathFromRepoRoot(mutation.file));
}

function applyMutationOnce(source: string, mutation: NegativeProofMutation): string {
  const matchIndex = source.indexOf(mutation.oldText);
  if (matchIndex === -1) {
    throw new Error(`Mutation ${mutation.name} could not find target text in ${mutation.file}`);
  }

  return `${source.slice(0, matchIndex)}${mutation.newText}${source.slice(matchIndex + mutation.oldText.length)}`;
}

function runInspectorProcess(skipBuild = true): InspectorRun {
  const result = spawnSync(
    "node",
    ["--import", "tsx", "scripts/audit/domains/post-action-verification-capability/run-inspector.ts", ...(skipBuild ? ["--skip-build"] : [])],
    {
      cwd: pathFromRepoRoot("."),
      encoding: "utf8",
      env: { ...process.env, GRASSEYE_SKIP_POST_ACTION_NEGATIVE_PROOF: "1" },
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function formatProcessOutput(run: InspectorRun): string {
  return [run.stdout.trim(), run.stderr.trim()].filter(Boolean).join("\n\n") || `status=${run.status ?? "null"}`;
}

async function applyMutation(mutation: NegativeProofMutation): Promise<{ rollback: () => Promise<void>; originalContent: string; mutatedContent: string }> {
  const absolutePath = pathFromRepoRoot(mutation.file);
  const originalContent = await readFile(absolutePath, "utf8");
  const mutatedContent = applyMutationOnce(originalContent, mutation);
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
    const failRun = runInspectorProcess(mutation.skipBuild ?? true);
    failOutput = formatProcessOutput(failRun);
    if (failRun.status === 0) {
      throw new Error(`Mutation ${mutation.name} did not fail inspector as expected.\n${failRun.stdout}\n${failRun.stderr}`);
    }
  } finally {
    await applied.rollback();
  }

  const rollbackRun = runInspectorProcess(mutation.skipBuild ?? true);
  if (rollbackRun.status !== 0) {
    throw new Error(`Post Action Verification mutation ${mutation.name} did not restore inspector PASS after rollback.\n${rollbackRun.stdout}\n${rollbackRun.stderr}`);
  }

  return {
    mutation,
    originalContent: applied.originalContent,
    mutatedContent: applied.mutatedContent,
    failOutput,
    passOutput: formatProcessOutput(rollbackRun),
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
    owner: "post-action-verification",
    ownerTitle: "Post Action Verification",
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
    owner: "post-action-verification",
    title: "Post Action Verification",
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
      createFinding({ lawId: LAW_IDS.PACKAGE, file: "scripts/audit/domains/post-action-verification-capability/inspector.ts", line: 1, severity: "fatal", message }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const records: MutationProofRecord[] = [];
    for (const mutation of POST_ACTION_NEGATIVE_PROOF_MUTATIONS) {
      const record = await mutateAndVerify(mutation);
      records.push(record);
      await writeMutationProof(record);
    }
    await writeOwnerBindingBundle(records);

    return createPassResult("Post Action Verification negative-proof harness rejects baseline drift, child-boundary escape, local-runtime builder drift, observation-bundle integrity regressions, runtime-path leakage, external bundle-ref fabrication, and owner-boundary regression mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Post Action Verification negative-proof harness failed.",
      "Post Action Verification negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
