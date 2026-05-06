import { readFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "./read-audit-file-state.js";
import { writeOwnerBindingProof } from "./owner-binding-proof-writer.js";
import { writeProductionMutationProof } from "./production-mutation-proof-writer.js";

type AuditMutation = {
  name: string;
  file: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
};

type InspectorRunResult = {
  passed: boolean;
  violationCount: number;
  output: string;
};

type InspectorRunner = () => Promise<InspectorRunResult>;

type MutationCoverage = {
  coveredLawIds: string[];
  coverageReasonByLawId: Record<string, string>;
};

type MutationProofRecord<TMutation extends AuditMutation = AuditMutation> = {
  mutation: TMutation;
  originalContent: string;
  mutatedContent: string;
  failOutput: string;
  passOutput: string;
  startedAt: string;
  endedAt: string;
};

const toScenarioId = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const formatInspectorOutput = (result: {
  classification: string;
  passed: boolean;
  violationCount: number;
  summary: string;
  findings: Array<{ severity: string; lawId?: string | null; file: string; line: number; message: string }>;
}): string => [
  `classification: ${result.classification}`,
  `passed: ${result.passed}`,
  `violationCount: ${result.violationCount}`,
  `summary: ${result.summary}`,
  "",
  ...result.findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.lawId ?? "no-law"} ${finding.file}:${finding.line} ${finding.message}`),
  "",
].join("\n");

const createInspectorRunner = async (input: {
  inspectorEntry: string;
  skipNegativeProofEnv: string;
}): Promise<InspectorRunner> => {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(input.inspectorEntry);

  return async () => {
    const previous = process.env[input.skipNegativeProofEnv];
    process.env[input.skipNegativeProofEnv] = "1";

    try {
      const result = await inspector(context);
      return {
        passed: result.passed,
        violationCount: result.violationCount,
        output: formatInspectorOutput(result),
      };
    } finally {
      if (previous === undefined) {
        delete process.env[input.skipNegativeProofEnv];
      } else {
        process.env[input.skipNegativeProofEnv] = previous;
      }
    }
  };
};

const mutateAndVerify = async <TMutation extends AuditMutation>(
  runInspector: InspectorRunner,
  mutation: TMutation,
): Promise<MutationProofRecord<TMutation>> => {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  const startedAt = new Date().toISOString();
  await applyAuditMutation(filePath, state.original, mutation);
  const mutatedContent = await readFile(filePath, "utf8");
  let failOutput = "";

  try {
    const result = await runInspector();
    failOutput = result.output;
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

  return {
    mutation,
    originalContent: state.original,
    mutatedContent,
    failOutput,
    passOutput: restored.output,
    startedAt,
    endedAt: new Date().toISOString(),
  };
};

const writeMutationProofBundle = async <TMutation extends AuditMutation>(input: {
  owner: string;
  ownerTitle: string;
  record: MutationProofRecord<TMutation>;
  coverageByMutationName: Record<string, MutationCoverage>;
  scenarioIdByMutationName?: Record<string, string>;
}): Promise<void> => {
  const coverage = input.coverageByMutationName[input.record.mutation.name];
  if (!coverage) {
    return;
  }

  await writeProductionMutationProof({
    owner: input.owner,
    ownerTitle: input.ownerTitle,
    mutationName: input.record.mutation.name,
    scenarioId: input.scenarioIdByMutationName?.[input.record.mutation.name] ?? toScenarioId(input.record.mutation.name),
    coveredLawIds: coverage.coveredLawIds,
    coverageReasonByLawId: coverage.coverageReasonByLawId,
    mutatedFile: input.record.mutation.file,
    originalContent: input.record.originalContent,
    mutatedContent: input.record.mutatedContent,
    failOutput: input.record.failOutput,
    passOutput: input.record.passOutput,
    startedAt: input.record.startedAt,
    endedAt: input.record.endedAt,
  });
};

const writeOwnerBindingBundle = async <TMutation extends AuditMutation>(input: {
  owner: string;
  title: string;
  ownerBindingMutationNames: readonly string[];
  records: MutationProofRecord<TMutation>[];
  rollbackOutput?: string;
}): Promise<void> => {
  const scenarios = input.ownerBindingMutationNames.flatMap((mutationName) => {
    const record = input.records.find((candidate) => candidate.mutation.name === mutationName);
    return record
      ? [{
        scenario: mutationName.replace(/ mutation$/, ""),
        outputFileName: `${toScenarioId(mutationName)}-fail.txt`,
        output: record.failOutput,
      }]
      : [];
  });

  await writeOwnerBindingProof({
    owner: input.owner,
    title: input.title,
    scenarios,
    rollbackOutput: input.rollbackOutput ?? input.records.at(-1)?.passOutput ?? "rollback restored baseline PASS",
  });
};

export type {
  AuditMutation,
  InspectorRunner,
  MutationCoverage,
  MutationProofRecord,
};

export {
  createInspectorRunner,
  mutateAndVerify,
  writeMutationProofBundle,
  writeOwnerBindingBundle,
};