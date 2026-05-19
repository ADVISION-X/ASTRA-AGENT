import { randomUUID } from "node:crypto";

import {
  checkAndReserveCommanderIdempotency,
  releaseCommanderIdempotency,
} from "../idempotency.js";
import { IssueHumanCommandInputSchema, type CommanderConsoleResult } from "../schema.js";
import type { CommanderChildContext } from "./context.js";
import { sendCommandEnvelope } from "./envelope.js";
import { buildCommanderChildFailure } from "./failure.js";
import { buildStartMissionOrchestrationPayload } from "./start-payload.js";

const issueInvalidInput = (operatorRef: string, failureReason: string): CommanderConsoleResult =>
  buildCommanderChildFailure({
    childCapabilityId: "issue-human-command",
    commandType: "start-mission",
    operatorRef,
    missionId: null,
    failureReason,
  });

export const executeIssueHumanCommand = async (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
): Promise<CommanderConsoleResult> => {
  const parsed = IssueHumanCommandInputSchema.safeParse(rawInput);
  if (!parsed.success) return issueInvalidInput(operatorRef, `input_schema_invalid: ${parsed.error.message}`);

  const commandId = randomUUID();
  const data = parsed.data;
  const idempotencyKey = `issue-human-command:${data.userRequirementText.slice(0, 40)}:${commandId}`;
  if (!checkAndReserveCommanderIdempotency(idempotencyKey)) return issueInvalidInput(operatorRef, "idempotency_replay");

  const result = await sendCommandEnvelope({
    childCapabilityId: "issue-human-command",
    commandId,
    commandType: "start-mission",
    operatorRef,
    missionId: null,
    userRequirementText: data.userRequirementText,
    selectedPlatforms: data.selectedPlatforms,
    requestedPlatformId: data.requestedPlatformId ?? null,
    maxRounds: data.maxRounds ?? null,
    maxMinutes: data.maxMinutes ?? null,
    payload: buildStartMissionOrchestrationPayload({
      ...data,
      requestedPlatformId: data.requestedPlatformId ?? null,
      maxRounds: data.maxRounds ?? null,
      maxMinutes: data.maxMinutes ?? null,
      operatorNote: data.operatorNote ?? null,
      initialPayload: data.initialPayload ?? null,
    }),
    idempotencyKey,
    timeoutMs: 30_000,
  }, context.commandTransport);

  if (result.status !== "success") releaseCommanderIdempotency(idempotencyKey);
  return result;
};
