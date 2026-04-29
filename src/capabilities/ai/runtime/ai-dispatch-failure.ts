import type { AiChildCapabilityId, AiDispatchFailureEnvelope, AiExecutionContext, AiProviderKind, AiTaskType } from "../contract.js";
import { AiDispatchFailureEnvelopeSchema, AiInputSchema, AiTaskTypeSchema } from "../schema.js";
import { buildStableAiRef } from "../shared/ai-types.js";

function readStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function readTaskType(value: unknown): AiTaskType | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const parsed = AiTaskTypeSchema.safeParse((value as Record<string, unknown>).taskType);
  return parsed.success ? parsed.data : null;
}

export function dispatchAiFailure(input: {
  rawInput: unknown;
  context: AiExecutionContext;
  childCapabilityId: AiChildCapabilityId | null;
  taskType: AiTaskType | null;
  providerKind: AiProviderKind | null;
  failureReason: string;
  statusMessage: string;
}): AiDispatchFailureEnvelope {
  const started = input.context.clock.startRun();
  const ended = input.context.clock.finishRun(started);
  const parsed = AiInputSchema.safeParse(input.rawInput);
  const missionId = parsed.success ? parsed.data.missionId : readStringField(input.rawInput, "missionId");
  const sessionId = parsed.success ? parsed.data.sessionId : readStringField(input.rawInput, "sessionId");
  const taskType = parsed.success ? parsed.data.taskType : (input.taskType ?? readTaskType(input.rawInput));
  const childCapabilityId = input.childCapabilityId;
  const rawInputRef = buildStableAiRef("ai-raw-input", [missionId, sessionId, taskType, input.failureReason]);

  return AiDispatchFailureEnvelopeSchema.parse({
    status: "failed",
    abilityGroupId: "ai",
    failureKind: "dispatch_failure",
    childCapabilityId,
    taskType,
    rawInputRef,
    parseFailureReason: input.statusMessage,
    fallbackProof: {
      proofId: buildStableAiRef("ai-dispatch-proof", [missionId, sessionId, taskType, input.failureReason]),
      runId: buildStableAiRef("ai-dispatch-run", [missionId, sessionId, taskType]),
      missionId,
      missionIdSource: missionId === null ? "unavailable" : "parsed_input",
      sessionId,
      sessionIdSource: sessionId === null ? "unavailable" : "parsed_input",
      childCapabilityId,
      childCapabilityIdSource: childCapabilityId === null ? "unavailable" : "parsed_route",
      taskType,
      taskTypeSource: taskType === null ? "unavailable" : "parsed_input",
      providerKind: input.providerKind,
      providerKindSource: input.providerKind === null ? "unavailable" : "registry_contract",
      startedAt: started.startedAt,
      endedAt: ended.endedAt,
      durationMs: ended.durationMs,
      status: "failed",
      failureReason: input.failureReason,
      clockPortKind: ended.portKind,
    },
    outputAuthority: "non_authoritative",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    createdAt: ended.endedAt,
  });
}
