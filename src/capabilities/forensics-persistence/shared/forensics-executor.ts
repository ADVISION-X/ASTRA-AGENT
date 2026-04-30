import type { ZodTypeAny } from "zod";

import type { ForensicsArtifactStoragePort } from "../ports/forensics-artifact-storage-port.js";
import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";
import type { ForensicsStoragePort } from "../ports/forensics-storage-port.js";
import type { ForensicsAbilityInput, ForensicsIntegrityDecision, ForensicsPolicyDecision, ForensicsResult } from "../schema.js";
import { ForensicsAbilityInputSchema } from "../schema.js";
import {
  buildForensicsDispatchFailure,
  buildForensicsEnvelope,
  buildForensicsIdempotencyKey,
  buildForensicsRecordId,
  buildForensicsResult,
  buildInvalidForensicsInputResult,
  evaluateForensicsIntegrity,
  evaluateForensicsPolicy,
  persistForensicsArtifacts,
  writeForensicsEnvelope,
  type ForensicsChildIntegritySpec,
  type ForensicsChildPolicySpec,
} from "./forensics-executor-support.js";

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

const buildPolicyViolationDecision = (input: {
  request: ForensicsAbilityInput;
  child: ForensicsChildDefinition;
  idempotencyKey: string;
}): ForensicsPolicyDecision => ({
  childCapabilityId: input.child.childCapabilityId,
  recordType: input.child.recordType,
  schemaVersion: input.request.schemaVersion ?? input.child.policy.schemaVersion,
  persistenceMode: input.request.persistencePolicy.mode,
  storageOperation: input.request.childCapabilityId === "update-runtime-snapshot" ? "update-runtime-snapshot" : "append-record",
  idempotencyKey: input.idempotencyKey,
  allowPartialRefs: input.request.persistencePolicy.allowPartialRefs,
  allowExternalArtifactRef: input.request.persistencePolicy.allowExternalArtifactRef,
  onArtifactWriteFailure: input.request.persistencePolicy.onArtifactWriteFailure,
});

const resolveStorageFailureCode = (error: unknown): "artifact_verification_failed" | "output_schema_invalid" | "storage_write_failed" => {
  if (error instanceof Error && error.message.includes("Artifact ref")) {
    return "artifact_verification_failed";
  }
  if (error instanceof Error && error.message.includes("output schema")) {
    return "output_schema_invalid";
  }
  return "storage_write_failed";
};

const writeStoredRecord = async (input: {
  request: ForensicsAbilityInput;
  context: ForensicsExecutionContext;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  idempotencyKey: string;
}) => {
  const persistedArtifacts = await persistForensicsArtifacts({
    artifactStorage: input.context.artifactStorage,
    artifactRefs: input.request.artifactRefs,
    policyDecision: input.policyDecision,
  });
  const envelope = buildForensicsEnvelope({
    request: { ...input.request, artifactRefs: persistedArtifacts },
    policyDecision: input.policyDecision,
    integrityDecision: input.integrityDecision,
    recordId: buildForensicsRecordId({ request: input.request, persistencePolicy: input.request.persistencePolicy, idempotencyKey: input.idempotencyKey }),
    clock: input.context.clock,
  });

  return writeForensicsEnvelope({ recordStorage: input.context.recordStorage, envelope, policyDecision: input.policyDecision });
};

const validateForensicsChildOutput = (input: {
  child: ForensicsChildDefinition;
  policyDecision: ForensicsPolicyDecision;
  storedRecord: Awaited<ReturnType<typeof writeStoredRecord>>;
}) => {
  input.child.outputSchema.parse({
    recordRef: input.storedRecord.recordRef,
    storageRef: input.storedRecord.storageRef,
    artifactRefs: input.storedRecord.artifactRefs,
    persistedAt: input.storedRecord.persistedAt,
    storageOperation: input.policyDecision.storageOperation,
    idempotencyKey: input.policyDecision.idempotencyKey,
  });
};

const buildIntegrityFailureResult = (input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  startedAt: string;
  clock: ForensicsClockPort;
}) => buildForensicsDispatchFailure({
  request: input.request,
  policyDecision: input.policyDecision,
  integrityDecision: input.integrityDecision,
  failureCode: "integrity_violation",
  failureMessage: input.integrityDecision.reason ?? "Forensics integrity gate failed.",
  startedAt: input.startedAt,
  endedAt: input.clock.now(),
  clock: input.clock,
});

const buildPolicyFailureResult = (input: {
  request: ForensicsAbilityInput;
  child: ForensicsChildDefinition;
  idempotencyKey: string;
  startedAt: string;
  clock: ForensicsClockPort;
  error: unknown;
}) => buildForensicsDispatchFailure({
  request: input.request,
  policyDecision: buildPolicyViolationDecision({ request: input.request, child: input.child, idempotencyKey: input.idempotencyKey }),
  integrityDecision: {
    status: "failed",
    reason: "Input schema validation failed.",
    requireSourceRecordRefs: input.child.integrity.requireSourceRecordRefs,
    requireParentRefs: input.child.integrity.requireParentRefs,
    requireArtifactRefs: input.child.integrity.requireArtifactRefs,
    requireStorageRef: input.child.integrity.requireStorageRef,
  },
  failureCode: "policy_violation",
  failureMessage: input.error instanceof Error ? input.error.message : "Forensics policy gate failed.",
  startedAt: input.startedAt,
  endedAt: input.clock.now(),
  clock: input.clock,
});

const parseForensicsRequest = (input: {
  child: ForensicsChildDefinition;
  rawRequest: unknown;
  startedAt: string;
  clock: ForensicsClockPort;
}): ForensicsResult | ForensicsAbilityInput => {
  const parsedRequest = input.child.inputSchema.safeParse(input.rawRequest);
  if (!parsedRequest.success) {
    return buildInvalidForensicsInputResult({ child: input.child, startedAt: input.startedAt, endedAt: input.clock.now(), detail: parsedRequest.error.message });
  }

  return ForensicsAbilityInputSchema.parse(parsedRequest.data);
};

const persistForensicsRequest = async (input: {
  request: ForensicsAbilityInput;
  child: ForensicsChildDefinition;
  context: ForensicsExecutionContext;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  idempotencyKey: string;
  startedAt: string;
}): Promise<ForensicsResult> => {
  try {
    const storedRecord = await writeStoredRecord(input);
    validateForensicsChildOutput({ child: input.child, policyDecision: input.policyDecision, storedRecord });
    return buildForensicsResult({
      request: input.request,
      policyDecision: input.policyDecision,
      integrityDecision: input.integrityDecision,
      storedRecord,
      startedAt: input.startedAt,
      endedAt: input.context.clock.now(),
      failureReason: null,
      reviewRequiredReason: input.integrityDecision.status === "review_required" ? input.integrityDecision.reason : null,
      clock: input.context.clock,
    });
  } catch (error) {
    return buildForensicsDispatchFailure({
      request: input.request,
      policyDecision: input.policyDecision,
      integrityDecision: input.integrityDecision,
      failureCode: resolveStorageFailureCode(error),
      failureMessage: error instanceof Error ? error.message : "Forensics write failed.",
      startedAt: input.startedAt,
      endedAt: input.context.clock.now(),
      clock: input.context.clock,
    });
  }
};

export async function executeForensicsChild(input: {
  rawRequest: unknown;
  child: ForensicsChildDefinition;
  context: ForensicsExecutionContext;
}): Promise<ForensicsResult> {
  const startedAt = input.context.clock.now();
  const request = parseForensicsRequest({ child: input.child, rawRequest: input.rawRequest, startedAt, clock: input.context.clock });
  if ("status" in request) {
    return request;
  }

  const idempotencyKey = buildForensicsIdempotencyKey({ request, persistencePolicy: request.persistencePolicy });
  let policyDecision: ForensicsPolicyDecision;
  try {
    policyDecision = evaluateForensicsPolicy({ request, childPolicy: input.child.policy, idempotencyKey });
  } catch (error) {
    return buildPolicyFailureResult({ request, child: input.child, idempotencyKey, startedAt, clock: input.context.clock, error });
  }

  const integrityDecision = evaluateForensicsIntegrity({ request, defaults: input.child.integrity, policyDecision });
  if (integrityDecision.status === "failed") {
    return buildIntegrityFailureResult({ request, policyDecision, integrityDecision, startedAt, clock: input.context.clock });
  }

  return persistForensicsRequest({
    request,
    child: input.child,
    context: input.context,
    policyDecision,
    integrityDecision,
    idempotencyKey,
    startedAt,
  });
}