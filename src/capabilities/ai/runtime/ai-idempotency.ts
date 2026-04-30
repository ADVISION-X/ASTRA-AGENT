import { createHash } from "node:crypto";

import type { ParsedAiAbilityInput } from "../contract.js";
import { buildStableAiRef } from "../shared/ai-types.js";

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildAiRuntimeCallIdentity(request: ParsedAiAbilityInput): { runtimeCallId: string; requestHash: string } {
  const requestHash = hashPayload({
    sessionId: request.sessionId,
    roundId: request.roundId,
    videoVisitId: request.videoVisitId,
    taskType: request.taskType,
    promptContractId: request.promptContractId,
    expectedOutputSchema: request.expectedOutputSchema,
    input: request.input,
  });
  return {
    runtimeCallId: buildStableAiRef("ai-runtime-call", [request.sessionId, request.taskType, request.roundId, requestHash.slice(0, 16)]),
    requestHash,
  };
}
