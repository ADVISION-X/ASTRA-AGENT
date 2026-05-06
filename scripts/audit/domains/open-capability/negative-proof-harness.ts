import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { pathToFileURL } from "node:url";
import {
  createInspectorRunner,
  mutateAndVerify,
  writeMutationProofBundle as writeSharedMutationProofBundle,
  writeOwnerBindingBundle as writeSharedOwnerBindingBundle,
} from "../_shared/negative-proof-runtime.js";
import { MUTATIONS, MUTATION_LAW_COVERAGE, OWNER_BINDING_MUTATION_NAMES, type Mutation } from "./negative-proof-definitions.js";
import { collectOpenLawBaselineFindings } from "./negative-proof-law-baseline.js";
import { openInspectionConstants as config } from "./inspection-constants.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/open-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_OPEN_NEGATIVE_PROOF";

type OpenMutationProofRecord = import("../_shared/negative-proof-runtime.js").MutationProofRecord<Mutation>;

const appendLawBaselineToOutput = (
  baseOutput: string,
  lawBaselineFindings: Finding[],
): string => {
  if (lawBaselineFindings.length === 0) {
    return baseOutput;
  }

  return [
    baseOutput.trimEnd(),
    ...lawBaselineFindings.map((finding) => `${finding.severity.toUpperCase()} ${finding.lawId ?? "no-law"} ${finding.file}:${finding.line} ${finding.message}`),
    "",
  ].join("\n");
};

const createOpenInspectorRunner = async () => {
  const runInspector = await createInspectorRunner({
    inspectorEntry: INSPECTOR_ENTRY,
    skipNegativeProofEnv: SKIP_NEGATIVE_PROOF_ENV,
  });

  return async () => {
    const result = await runInspector();
    const lawBaselineFindings = await collectOpenLawBaselineFindings();
    return {
      passed: result.passed && lawBaselineFindings.length === 0,
      violationCount: result.violationCount + lawBaselineFindings.length,
      output: appendLawBaselineToOutput(result.output, lawBaselineFindings),
    };
  };
};

async function writeMutationProof(record: OpenMutationProofRecord): Promise<void> {
  await writeSharedMutationProofBundle({
    owner: "open",
    ownerTitle: "Open",
    record,
    coverageByMutationName: MUTATION_LAW_COVERAGE,
  });
}

async function writeOpenOwnerBindingBundle(records: OpenMutationProofRecord[]): Promise<void> {
  await writeSharedOwnerBindingBundle({
    owner: "open",
    title: "Open",
    ownerBindingMutationNames: OWNER_BINDING_MUTATION_NAMES,
    records,
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
    const runInspector = await createOpenInspectorRunner();
    const baseline = await runInspector();
    if (!baseline.passed) {
      throw new Error("Baseline open-capability inspector must pass before negative proof.");
    }

    const records: OpenMutationProofRecord[] = [];
    for (const mutation of MUTATIONS) {
      const record = await mutateAndVerify(runInspector, mutation);
      records.push(record);
      await writeMutationProof(record);
    }

    await writeOpenOwnerBindingBundle(records);

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
