import type { AiChildCapabilityId, AiDispatchFailureEnvelope, AiExecutionContext, AiProviderKind, AiTaskType } from "../contract.js";
import { AiDispatchFailureEnvelopeSchema, AiInputSchema, AiTaskTypeSchema } from "../schema.js";
import { buildStableAiRef } from "../shared/ai-types.js";

type FailureEnvelopeTrace = {
  missionId: string | null;
  missionIdSource: "parsed_input" | "unavailable";
  sessionId: string | null;
  sessionIdSource: "parsed_input" | "unavailable";
  taskType: AiTaskType | null;
  taskTypeSource: "parsed_input" | "unavailable";
};

function readFailureEnvelopeRawRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readFailureEnvelopeStringField(value: unknown, field: "missionId" | "sessionId"): string | null {
  const record = readFailureEnvelopeRawRecord(value);
  const candidate = record ? record[field] : null;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function readFailureEnvelopeTaskType(value: unknown): AiTaskType | null {
  const record = readFailureEnvelopeRawRecord(value);
  const parsed = AiTaskTypeSchema.safeParse(record ? record.taskType : null);
  return parsed.success ? parsed.data : null;
}

function parseFailureEnvelopeTrace(rawInput: unknown): FailureEnvelopeTrace {
  const parsed = AiInputSchema.safeParse(rawInput);
  if (parsed.success) {
    return {
      missionId: parsed.data.missionId,
      missionIdSource: parsed.data.missionId === null ? "unavailable" : "parsed_input",
      sessionId: parsed.data.sessionId,
      sessionIdSource: "parsed_input",
      taskType: parsed.data.taskType,
      taskTypeSource: "parsed_input",
    };
  }

  const missionId = readFailureEnvelopeStringField(rawInput, "missionId");
  const sessionId = readFailureEnvelopeStringField(rawInput, "sessionId");
  const taskType = readFailureEnvelopeTaskType(rawInput);
  return {
    missionId,
    missionIdSource: missionId === null ? "unavailable" : "parsed_input",
    sessionId,
    sessionIdSource: sessionId === null ? "unavailable" : "parsed_input",
    taskType,
    taskTypeSource: taskType === null ? "unavailable" : "parsed_input",
  };
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
  const trace = parseFailureEnvelopeTrace(input.rawInput);
  const taskType = trace.taskType ?? input.taskType;
  const taskTypeSource = trace.taskType === null && input.taskType !== null ? "parsed_input" : trace.taskTypeSource;
  const childCapabilityId = input.childCapabilityId;
  const rawInputRef = buildStableAiRef("ai-raw-input", [trace.missionId, trace.sessionId, taskType, input.failureReason]);

  return AiDispatchFailureEnvelopeSchema.parse({
    status: "failed",
    abilityGroupId: "ai",
    failureKind: "dispatch_failure",
    childCapabilityId,
    taskType,
    rawInputRef,
    parseFailureReason: input.statusMessage,
    fallbackProof: {
      proofId: buildStableAiRef("ai-dispatch-proof", [trace.missionId, trace.sessionId, taskType, input.failureReason]),
      runId: buildStableAiRef("ai-dispatch-run", [trace.missionId, trace.sessionId, taskType]),
      missionId: trace.missionId,
      missionIdSource: trace.missionIdSource,
      sessionId: trace.sessionId,
      sessionIdSource: trace.sessionIdSource,
      childCapabilityId,
      childCapabilityIdSource: childCapabilityId === null ? "unavailable" : "parsed_route",
      taskType,
      taskTypeSource,
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
