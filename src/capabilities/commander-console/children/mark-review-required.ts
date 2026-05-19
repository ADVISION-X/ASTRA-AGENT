import { randomUUID } from "node:crypto";

import { MarkReviewRequiredInputSchema, type CommanderConsoleResult } from "../schema.js";
import type { CommanderChildContext } from "./context.js";
import { sendCommandEnvelope } from "./envelope.js";
import { buildCommanderChildFailure } from "./failure.js";

export const executeMarkReviewRequired = async (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
): Promise<CommanderConsoleResult> => {
  const parsed = MarkReviewRequiredInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return buildCommanderChildFailure({
      childCapabilityId: "mark-review-required",
      commandType: "mark-review-required",
      operatorRef,
      missionId: null,
      failureReason: `input_schema_invalid: ${parsed.error.message}`,
    });
  }
  const commandId = randomUUID();
  return sendCommandEnvelope({
    childCapabilityId: "mark-review-required",
    commandId,
    commandType: "mark-review-required",
    operatorRef,
    missionId: parsed.data.targetMissionId ?? null,
    userRequirementText: null,
    selectedPlatforms: [],
    requestedPlatformId: null,
    maxRounds: null,
    maxMinutes: null,
    payload: { reviewRequiredReason: parsed.data.reviewRequiredReason },
    idempotencyKey: `mark-review-required:${commandId}`,
    timeoutMs: 10_000,
  }, context.commandTransport);
};
