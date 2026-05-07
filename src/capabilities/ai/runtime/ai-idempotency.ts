import { createHash } from "node:crypto";

import type { ParsedAiAbilityInput } from "../contract.js";
import { buildStableAiRef } from "../shared/ai-types.js";

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildAiRuntimeCallIdentity(request: ParsedAiAbilityInput): { runtimeCallId: string; requestHash: string } {
  const requestHash = hashPayload({
    sessionId: request.sessionId,
    runId: request.runId,
    roundId: request.roundId,
    stepId: request.stepId,
    videoVisitId: request.videoVisitId,
    taskType: request.taskType,
    capabilityCallId: request.capabilityCallId,
    nerveBusEnvelopeId: request.nerveBusEnvelopeId,
    promptContractId: request.promptContractId,
    mapPackageId: request.mapPackageId,
    mapPackageVersion: request.mapPackageVersion,
    selectedMapId: request.selectedMapId,
    selectedMapVersion: request.selectedMapVersion,
    activationSnapshotRef: request.activationSnapshotRef,
    promptCatalogVersion: request.promptCatalogVersion,
    expectedOutputSchema: request.expectedOutputSchema,
    input: request.input,
  });
  return {
    runtimeCallId: buildStableAiRef("ai-runtime-call", [request.sessionId, request.taskType, request.stepId, request.capabilityCallId, requestHash.slice(0, 16)]),
    requestHash,
  };
}
