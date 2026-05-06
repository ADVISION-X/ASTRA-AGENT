import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  createInspectorRunner,
  mutateAndVerify,
  writeMutationProofBundle as writeSharedMutationProofBundle,
  writeOwnerBindingBundle as writeSharedOwnerBindingBundle,
} from "../_shared/negative-proof-runtime.js";
import { MUTATIONS, MUTATION_LAW_COVERAGE, OWNER_BINDING_MUTATION_NAMES, type NegativeProofMutation } from "./negative-proof-definitions.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/geometry-guard-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_GEOMETRY_GUARD_NEGATIVE_PROOF";

type GeometryGuardMutationProofRecord = import("../_shared/negative-proof-runtime.js").MutationProofRecord<NegativeProofMutation>;

const createGeometryGuardInspectorRunner = async () =>
  createInspectorRunner({
    inspectorEntry: INSPECTOR_ENTRY,
    skipNegativeProofEnv: SKIP_NEGATIVE_PROOF_ENV,
  });

const writeMutationProof = async (record: GeometryGuardMutationProofRecord): Promise<void> => {
  await writeSharedMutationProofBundle({
    owner: "geometry-guard",
    ownerTitle: "Geometry Guard",
    record,
    coverageByMutationName: MUTATION_LAW_COVERAGE,
  });
};

const writeGeometryGuardOwnerBindingBundle = async (records: GeometryGuardMutationProofRecord[]): Promise<void> => {
  await writeSharedOwnerBindingBundle({
    owner: "geometry-guard",
    title: "Geometry Guard",
    ownerBindingMutationNames: OWNER_BINDING_MUTATION_NAMES,
    records,
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
    const runInspector = await createGeometryGuardInspectorRunner();
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Geometry Guard inspector baseline must pass before negative-proof mutation checks.",
        "Geometry Guard negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    const records: GeometryGuardMutationProofRecord[] = [];
    for (const mutation of MUTATIONS) {
      const record = await mutateAndVerify(runInspector, mutation);
      records.push(record);
      await writeMutationProof(record);
    }
    await writeGeometryGuardOwnerBindingBundle(records);

    return createPassResult("Geometry Guard negative-proof harness rejects law weakening, input chain drift, silent clamp, fabricated proof chain, output-boundary drift, and child boundary escape mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Geometry Guard negative-proof harness failed.",
      "Geometry Guard negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}