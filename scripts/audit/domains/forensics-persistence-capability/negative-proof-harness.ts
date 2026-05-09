import { mkdir, rm, writeFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState, type AuditMutation, type AuditFileState } from "../_shared/read-audit-file-state.js";

type RuntimeDirMutation = {
  kind: "runtime-dir";
  name: string;
  file: string;
  content: string;
};

type Mutation = AuditMutation | RuntimeDirMutation;

const isRuntimeDirMutation = (mutation: Mutation): mutation is RuntimeDirMutation => {
  return "kind" in mutation && mutation.kind === "runtime-dir";
};

const INSPECTOR_ENTRY = "scripts/audit/domains/forensics-persistence-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_FORENSICS_NEGATIVE_PROOF";
const LAW_ENFORCEMENT = "GRASSEYE-FORENSICS-PERSISTENCE-008-V2";

const MUTATIONS: Mutation[] = [
  {
    kind: "runtime-dir",
    name: "forbidden runtime directory mutation",
    file: "src/capabilities/forensics-persistence/runtime/negative-proof-runtime.ts",
    content: "export const forbiddenRuntimeMutation = true;\n",
  },
  {
    name: "legacy import mutation",
    file: "src/capabilities/forensics-persistence/children/finalize-browse-ledger/schema.ts",
    search: "import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema, ForensicsPlainObjectSchema } from \"../../shared/forensics-base-schema.js\";",
    replace: "import { BrowseLedgerEntrySchema } from \"../../../../types/evidence-packet.js\";\nimport { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema, ForensicsPlainObjectSchema } from \"../../shared/forensics-base-schema.js\";",
  },
  {
    name: "ai prompt contract mutation",
    file: "src/capabilities/forensics-persistence/children/write-ai-result-record/schema.ts",
    search: "  promptCatalogVersion: z.string().min(1),\n",
    replace: "",
  },
  {
    name: "action verification ref mutation",
    file: "src/capabilities/forensics-persistence/children/write-structured-action-log/schema.ts",
    search: "  postActionVerificationRef: z.string().min(1),\n",
    replace: "",
  },
  {
    name: "envelope chain mutation",
    file: "src/capabilities/forensics-persistence/shared/forensics-envelope-builder.ts",
    search: "  activationSnapshotRef: requireChainValue(\"activationSnapshotRef\", input.request.activationSnapshotRef),\n  capabilityCallId: requireChainValue(\"capabilityCallId\", input.request.capabilityCallId),\n  sourceAbilityGroupId: input.request.sourceAbilityGroupId,\n",
    replace: "  activationSnapshotRef: requireChainValue(\"activationSnapshotRef\", input.request.activationSnapshotRef),\n  sourceAbilityGroupId: input.request.sourceAbilityGroupId,\n",
  },
  {
    name: "proof activation snapshot mutation",
    file: "src/capabilities/forensics-persistence/shared/forensics-proof-builder.ts",
    search: "  activationSnapshotRef: resolveProofChainValue(\"activationSnapshotRef\", request.activationSnapshotRef, status),\n",
    replace: "",
  },
  {
    name: "proof integrity hash mutation",
    file: "src/capabilities/forensics-persistence/shared/forensics-proof-builder.ts",
    search: "  integrityHash: input.storedRecord?.envelope.integrityHash ?? null,\n",
    replace: "  integrityHash: null,\n",
  },
  {
    name: "runtime proof builder mutation",
    file: "src/capabilities/forensics-persistence/shared/forensics-result-builder.ts",
    search: "  runtimeProof: buildForensicsProof({\n",
    replace: "  runtimeProof: buildMissingProof({\n",
  },
  {
    name: "forensics write requested event mutation",
    file: "src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts",
    search: '    buildBoundaryEvent(request, "FORENSICS_RECORD_WRITE_REQUESTED", "started", [',
    replace: '    buildBoundaryEvent(request, "FORENSICS_RECORD_WRITE_PENDING", "started", [',
  },
  {
    name: "forensics written review-required gate mutation",
    file: "src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts",
    search: '  if (!emitter || result.status === "failed") {',
    replace: '  if (!emitter || result.status !== "success") {',
  },
  {
    name: "forensics review written success mutation",
    file: "src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts",
    search: '  const eventType = reviewRequired ? "FORENSICS_RECORD_WRITE_REVIEW_REQUIRED" : "FORENSICS_RECORD_WRITTEN";\n  const status = reviewRequired ? "review_required" : "success";\n',
    replace: '  const eventType = "FORENSICS_RECORD_WRITTEN";\n  const status = "success";\n',
  },
  {
    name: "forensics structured log bus wiring mutation",
    file: "src/lib/local-runtime/workbench-persistence-runtime.ts",
    search: "      structuredLogBus: boundaryEventEmitter,\n",
    replace: "",
  },
  {
    name: "forensics idempotency proof field mutation",
    file: "src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts",
    search: "      `idempotencyKey=${idempotencyKey}`,\n",
    replace: "",
  },
  {
    name: "generic storage port mutation",
    file: "src/capabilities/forensics-persistence/ports/forensics-storage-port.ts",
    search: "  writeRecord(input: ForensicsWriteRecordInput): Promise<StoredForensicsRecord>;\n",
    replace: "  appendRecord(envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord>;\n",
  },
  {
    name: "artifact promotion status mutation",
    file: "src/capabilities/forensics-persistence/shared/forensics-base-schema.ts",
    search: "  promotionStatus: ForensicsArtifactPromotionStatusSchema.default(\"not_promoted\"),\n",
    replace: "",
  },
];

async function applyRuntimeDirMutation(mutation: RuntimeDirMutation): Promise<AuditFileState> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await mkdir(pathFromRepoRoot("src/capabilities/forensics-persistence/runtime"), { recursive: true });
  await writeFile(filePath, mutation.content, "utf8");
  return state;
}

async function restoreRuntimeDirMutation(mutation: RuntimeDirMutation, state: AuditFileState): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  await restoreAuditFileState(filePath, state);
  await rm(pathFromRepoRoot("src/capabilities/forensics-persistence/runtime"), { recursive: true, force: true });
}

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
  process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";

  try {

    const artifacts = await loadGeneratedArtifacts();
    const context = await createInspectorContext(artifacts);
    const inspector = await loadInspector(INSPECTOR_ENTRY);
    const result = await inspector(context);
    return { passed: result.passed, violationCount: result.violationCount };
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
  const runtimeDirMutation = isRuntimeDirMutation(mutation);
  const state = runtimeDirMutation
    ? await applyRuntimeDirMutation(mutation)
    : await readAuditFileState(filePath);

  if (!runtimeDirMutation) {
    await applyAuditMutation(filePath, state.original, mutation);
  }

  try {
    const mutated = await runInspector();
    if (mutated.passed || mutated.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    if (runtimeDirMutation) {
      await restoreRuntimeDirMutation(mutation, state);
    } else {
      await restoreAuditFileState(filePath, state);
    }
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
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
        lawId: LAW_ENFORCEMENT,
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

async function runMutations(): Promise<void> {
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Forensics inspector baseline must pass before negative-proof mutation checks.",
        "Forensics negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Forensics negative-proof harness rejects runtime-dir relapse, structured-log write-boundary loss, structured-log bus unwiring, legacy contract leakage, chain-field removal, prompt/action ref weakening, proof removal, generic-port drift, and artifact-promotion lifecycle regression.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Forensics negative-proof harness failed.",
      "Forensics negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
