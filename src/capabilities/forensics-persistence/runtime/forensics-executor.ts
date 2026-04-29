import type { ZodTypeAny } from "zod";

import type { ForensicsArtifactStoragePort } from "../ports/forensics-artifact-storage-port.js";
import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";
import type { ForensicsStoragePort } from "../ports/forensics-storage-port.js";
import type {
  ForensicsAbilityInput,
  ForensicsIntegrityDecision,
  ForensicsPolicyDecision,
  ForensicsResult,
} from "../schema.js";
import { ForensicsAbilityInputSchema, ForensicsResultSchema } from "../schema.js";
import { buildForensicsIdempotencyKey, buildForensicsRecordId } from "./forensics-idempotency.js";
import { evaluateForensicsPolicy, type ForensicsChildPolicySpec } from "./forensics-policy-gate.js";
import { evaluateForensicsIntegrity, type ForensicsChildIntegritySpec } from "./forensics-integrity-gate.js";
import { buildForensicsEnvelope } from "./forensics-envelope-builder.js";
import { persistForensicsArtifacts, writeForensicsEnvelope } from "./forensics-write-gate.js";
import { buildForensicsResult } from "./forensics-result-builder.js";
import { buildForensicsDispatchFailure } from "./forensics-dispatch-failure.js";

export type ForensicsExecutionContext = {
  recordStorage: ForensicsStoragePort;
  artifactStorage: ForensicsArtifactStoragePort;
  clock: ForensicsClockPort;
};

export type ForensicsChildDefinition = {
  childCapabilityId: ForensicsAbilityInput["childCapabilityId"];
  recordType: ForensicsAbilityInput["recordType"];
  inputSchema: ZodTypeAny;
  outputSchema: ZodTypeAny;
  policy: ForensicsChildPolicySpec;
  integrity: ForensicsChildIntegritySpec;
};

export async function executeForensicsChild(input: {
  rawRequest: unknown;
  child: ForensicsChildDefinition;
  context: ForensicsExecutionContext;
}): Promise<ForensicsResult> {
  const startedAt = input.context.clock.now();
  const parsedRequest = input.child.inputSchema.safeParse(input.rawRequest);
  if (!parsedRequest.success) {
    const endedAt = input.context.clock.now();
    return ForensicsResultSchema.parse({
      abilityGroupId: "forensics-persistence",
      childCapabilityId: input.child.childCapabilityId,
      status: "failed",
      recordType: input.child.recordType,
      recordRef: {
        recordType: input.child.recordType,
        recordId: `${input.child.recordType}:invalid-input`,
        storageRef: null,
      },
      storageRef: null,
      artifactRefs: [],
      output: null,
      failureReason: {
        code: "input_schema_invalid",
        message: "Forensics input failed schema validation.",
        detail: parsedRequest.error.message,
      },
      reviewRequiredReason: null,
      runtimeProof: {
        proofId: `forensics-proof:invalid-input:${input.child.childCapabilityId}`,
        runId: `invalid-input:${input.child.childCapabilityId}`,
        missionId: "invalid-input",
        sessionId: "invalid-session",
        roundId: "invalid-round",
        videoVisitId: null,
        abilityGroupId: "forensics-persistence",
        childCapabilityId: input.child.childCapabilityId,
        sourceAbilityGroupId: "invalid-input",
        sourceChildCapabilityId: "invalid-input",
        operationType: input.child.childCapabilityId,
        recordType: input.child.recordType,
        recordId: `${input.child.recordType}:invalid-input`,
        idempotencyKey: "invalid-input",
        startedAt,
        endedAt,
        durationMs: Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime()),
        status: "failed",
        storageOperation: input.child.childCapabilityId === "update-runtime-snapshot" ? "update-runtime-snapshot" : "append-record",
        inputRecordRefs: [],
        outputRecordRefs: [],
        artifactRefs: [],
        storageRef: null,
        integrityHash: null,
        policyDecision: {
          childCapabilityId: input.child.childCapabilityId,
          recordType: input.child.recordType,
          schemaVersion: input.child.policy.schemaVersion,
          persistenceMode: "append",
          storageOperation: input.child.childCapabilityId === "update-runtime-snapshot" ? "update-runtime-snapshot" : "append-record",
          idempotencyKey: "invalid-input",
          allowPartialRefs: false,
          allowExternalArtifactRef: false,
          onArtifactWriteFailure: input.child.policy.onArtifactWriteFailure,
        },
        integrityDecision: {
          status: "failed",
          reason: "Input schema validation failed.",
          requireSourceRecordRefs: input.child.integrity.requireSourceRecordRefs,
          requireParentRefs: input.child.integrity.requireParentRefs,
          requireArtifactRefs: input.child.integrity.requireArtifactRefs,
          requireStorageRef: input.child.integrity.requireStorageRef,
        },
        failureReason: {
          code: "input_schema_invalid",
          message: "Forensics input failed schema validation.",
          detail: parsedRequest.error.message,
        },
        dataQualityFlags: [],
      },
      integrityDecision: {
        status: "failed",
        reason: "Input schema validation failed.",
        requireSourceRecordRefs: input.child.integrity.requireSourceRecordRefs,
        requireParentRefs: input.child.integrity.requireParentRefs,
        requireArtifactRefs: input.child.integrity.requireArtifactRefs,
        requireStorageRef: input.child.integrity.requireStorageRef,
      },
      policyDecision: {
        childCapabilityId: input.child.childCapabilityId,
        recordType: input.child.recordType,
        schemaVersion: input.child.policy.schemaVersion,
        persistenceMode: "append",
        storageOperation: input.child.childCapabilityId === "update-runtime-snapshot" ? "update-runtime-snapshot" : "append-record",
        idempotencyKey: "invalid-input",
        allowPartialRefs: false,
        allowExternalArtifactRef: false,
        onArtifactWriteFailure: input.child.policy.onArtifactWriteFailure,
      },
    });
  }

  const request = ForensicsAbilityInputSchema.parse(parsedRequest.data);
  const idempotencyKey = buildForensicsIdempotencyKey({ request, persistencePolicy: request.persistencePolicy });
  let policyDecision: ForensicsPolicyDecision;
  try {
    policyDecision = evaluateForensicsPolicy({ request, childPolicy: input.child.policy, idempotencyKey });
  } catch (error) {
    return buildForensicsDispatchFailure({
      request,
      policyDecision: {
        childCapabilityId: input.child.childCapabilityId,
        recordType: input.child.recordType,
        schemaVersion: request.schemaVersion ?? input.child.policy.schemaVersion,
        persistenceMode: request.persistencePolicy.mode,
        storageOperation: request.childCapabilityId === "update-runtime-snapshot" ? "update-runtime-snapshot" : "append-record",
        idempotencyKey,
        allowPartialRefs: request.persistencePolicy.allowPartialRefs,
        allowExternalArtifactRef: request.persistencePolicy.allowExternalArtifactRef,
        onArtifactWriteFailure: request.persistencePolicy.onArtifactWriteFailure,
      },
      integrityDecision: {
        status: "failed",
        reason: "Policy gate failed before integrity checks.",
        requireSourceRecordRefs: input.child.integrity.requireSourceRecordRefs,
        requireParentRefs: input.child.integrity.requireParentRefs,
        requireArtifactRefs: input.child.integrity.requireArtifactRefs,
        requireStorageRef: input.child.integrity.requireStorageRef,
      },
      failureCode: "policy_violation",
      failureMessage: error instanceof Error ? error.message : "Forensics policy gate failed.",
      startedAt,
      endedAt: input.context.clock.now(),
      clock: input.context.clock,
    });
  }

  const integrityDecision = evaluateForensicsIntegrity({
    request,
    defaults: input.child.integrity,
    policyDecision,
  });
  if (integrityDecision.status === "failed") {
    return buildForensicsDispatchFailure({
      request,
      policyDecision,
      integrityDecision,
      failureCode: "integrity_violation",
      failureMessage: integrityDecision.reason ?? "Forensics integrity gate failed.",
      startedAt,
      endedAt: input.context.clock.now(),
      clock: input.context.clock,
    });
  }

  try {
    const persistedArtifacts = await persistForensicsArtifacts({
      artifactStorage: input.context.artifactStorage,
      artifactRefs: request.artifactRefs,
      policyDecision,
    });
    const envelope = buildForensicsEnvelope({
      request: { ...request, artifactRefs: persistedArtifacts },
      policyDecision,
      integrityDecision,
      recordId: buildForensicsRecordId({ request, persistencePolicy: request.persistencePolicy, idempotencyKey }),
      clock: input.context.clock,
    });
    const storedRecord = await writeForensicsEnvelope({
      recordStorage: input.context.recordStorage,
      envelope,
      policyDecision,
    });
    input.child.outputSchema.parse({
      recordRef: storedRecord.recordRef,
      storageRef: storedRecord.storageRef,
      artifactRefs: storedRecord.artifactRefs,
      persistedAt: storedRecord.persistedAt,
      storageOperation: policyDecision.storageOperation,
      idempotencyKey: policyDecision.idempotencyKey,
    });
    return buildForensicsResult({
      request,
      policyDecision,
      integrityDecision,
      storedRecord,
      startedAt,
      endedAt: input.context.clock.now(),
      failureReason: null,
      reviewRequiredReason: integrityDecision.status === "review_required" ? integrityDecision.reason : null,
      clock: input.context.clock,
    });
  } catch (error) {
    const failureCode = error instanceof Error && error.message.includes("Artifact ref")
      ? "artifact_verification_failed"
      : error instanceof Error && error.message.includes("output schema")
        ? "output_schema_invalid"
        : "storage_write_failed";
    return buildForensicsDispatchFailure({
      request,
      policyDecision,
      integrityDecision,
      failureCode,
      failureMessage: error instanceof Error ? error.message : "Forensics write failed.",
      startedAt,
      endedAt: input.context.clock.now(),
      clock: input.context.clock,
    });
  }
}
