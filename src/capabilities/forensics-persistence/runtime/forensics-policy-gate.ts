import type { ForensicsAbilityInput, ForensicsPersistencePolicy, ForensicsPolicyDecision } from "../schema.js";

export type ForensicsChildPolicySpec = {
  childCapabilityId: ForensicsAbilityInput["childCapabilityId"];
  recordType: ForensicsAbilityInput["recordType"];
  schemaVersion: string;
  allowedPersistenceModes: readonly ForensicsPersistencePolicy["mode"][];
  allowExternalArtifactRef: boolean;
  onArtifactWriteFailure: ForensicsPersistencePolicy["onArtifactWriteFailure"];
};

export function evaluateForensicsPolicy(input: {
  request: ForensicsAbilityInput;
  childPolicy: ForensicsChildPolicySpec;
  idempotencyKey: string;
}): ForensicsPolicyDecision {
  if (input.request.childCapabilityId !== input.childPolicy.childCapabilityId || input.request.recordType !== input.childPolicy.recordType) {
    throw new Error(`Forensics child contract mismatch for ${input.childPolicy.childCapabilityId}.`);
  }

  if (!input.childPolicy.allowedPersistenceModes.includes(input.request.persistencePolicy.mode)) {
    throw new Error(`Forensics child ${input.childPolicy.childCapabilityId} does not allow ${input.request.persistencePolicy.mode}.`);
  }

  const storageOperation = input.request.childCapabilityId === "update-runtime-snapshot"
    ? "update-runtime-snapshot"
    : input.request.persistencePolicy.mode === "append"
      ? "append-record"
      : input.request.persistencePolicy.mode === "replace-by-round"
        ? "replace-record-by-round"
        : "replace-record-by-session";

  return {
    childCapabilityId: input.childPolicy.childCapabilityId,
    recordType: input.childPolicy.recordType,
    schemaVersion: input.request.schemaVersion ?? input.childPolicy.schemaVersion,
    persistenceMode: input.request.persistencePolicy.mode,
    storageOperation,
    idempotencyKey: input.idempotencyKey,
    allowPartialRefs: input.request.persistencePolicy.allowPartialRefs,
    allowExternalArtifactRef: input.request.persistencePolicy.allowExternalArtifactRef || input.childPolicy.allowExternalArtifactRef,
    onArtifactWriteFailure: input.request.persistencePolicy.onArtifactWriteFailure ?? input.childPolicy.onArtifactWriteFailure,
  };
}
