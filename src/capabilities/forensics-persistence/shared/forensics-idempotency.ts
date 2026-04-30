import { createHash } from "node:crypto";

import type { ForensicsAbilityInput, ForensicsPersistencePolicy } from "../schema.js";
import { serializeCanonicalJson } from "./forensics-hash-builder.js";

function hashKey(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 20);
}

export function buildForensicsIdempotencyKey(input: {
  request: ForensicsAbilityInput;
  persistencePolicy: ForensicsPersistencePolicy;
}): string {
  return hashKey(serializeCanonicalJson({
    childCapabilityId: input.request.childCapabilityId,
    recordType: input.request.recordType,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId ?? null,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    persistenceMode: input.persistencePolicy.mode,
    payload: input.request.payload,
    sourceRecordRefs: input.request.sourceRecordRefs,
    parentRefs: input.request.parentRefs,
    artifactRefs: input.request.artifactRefs,
    existingRecordId: input.request.existingRecordId ?? null,
  }));
}

export function buildForensicsRecordId(input: {
  request: ForensicsAbilityInput;
  persistencePolicy: ForensicsPersistencePolicy;
  idempotencyKey: string;
}): string {
  return `${input.request.recordType}:${input.idempotencyKey}`;
}