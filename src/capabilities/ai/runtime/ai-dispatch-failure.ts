import type { AiChildCapabilityId, AiDispatchFailureEnvelope, AiExecutionContext, AiProviderKind, AiTaskType } from "../contract.js";
import { AiDispatchFailureEnvelopeSchema, AiInputSchema, AiTaskTypeSchema } from "../schema.js";
import { buildStableAiRef } from "../shared/ai-types.js";
import type { z } from "zod";

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

function formatIssuePath(issue: z.ZodIssue): string {
  return issue.path.length > 0 ? issue.path.join(".") : "taskType";
}

function buildInputSchemaDiagnostics(rawInput: unknown, failureReason: string) {
  if (failureReason !== "input_schema_invalid") {
    return {
      schemaIssueCount: 0,
      schemaIssueRef: null,
      missingRequiredFields: [],
      invalidFieldPaths: [],
      actionableMessage: null,
    };
  }

  const parsed = AiInputSchema.safeParse(rawInput);
  const issues = parsed.success ? [] : parsed.error.issues;
  const invalidFieldPaths = [...new Set(issues.map(formatIssuePath))];
  const missingRequiredFields = [...new Set(issues
    .filter((issue) => issue.message.toLowerCase().includes("required") || issue.code === "invalid_type")
    .map(formatIssuePath))];
  return {
    schemaIssueCount: issues.length,
    schemaIssueRef: buildStableAiRef("ai-input-schema-issues", [
      readFailureEnvelopeStringField(rawInput, "missionId"),
      readFailureEnvelopeStringField(rawInput, "sessionId"),
      readFailureEnvelopeTaskType(rawInput),
      String(issues.length),
    ]),
    missingRequiredFields,
    invalidFieldPaths,
    actionableMessage: "Inspect AI input builder and promptInputRef resolution before retrying.",
  };
}

function buildDispatchFallbackProof(input: {
  trace: FailureEnvelopeTrace;
  taskType: AiTaskType | null;
  taskTypeSource: FailureEnvelopeTrace["taskTypeSource"];
  childCapabilityId: AiChildCapabilityId | null;
  providerKind: AiProviderKind | null;
  failureReason: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clockPortKind: "system-monotonic-clock";
}) {
  return {
    proofId: buildStableAiRef("ai-dispatch-proof", [input.trace.missionId, input.trace.sessionId, input.taskType, input.failureReason]),
    runId: buildStableAiRef("ai-dispatch-run", [input.trace.missionId, input.trace.sessionId, input.taskType]),
    missionId: input.trace.missionId,
    missionIdSource: input.trace.missionIdSource,
    sessionId: input.trace.sessionId,
    sessionIdSource: input.trace.sessionIdSource,
    childCapabilityId: input.childCapabilityId,
    childCapabilityIdSource: input.childCapabilityId === null ? "unavailable" as const : "parsed_route" as const,
    taskType: input.taskType,
    taskTypeSource: input.taskTypeSource,
    providerKind: input.providerKind,
    providerKindSource: input.providerKind === null ? "unavailable" as const : "registry_contract" as const,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: "failed" as const,
    failureReason: input.failureReason,
    clockPortKind: input.clockPortKind,
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
  implementationStatus?: string | null;
  errorKind?: string | null;
  runtimeCallId?: string | null;
  rawOutputRef?: string | null;
  rawOutputHash?: string | null;
  diagnosticPayloadRef?: string | null;
}): AiDispatchFailureEnvelope {
  const started = input.context.clock.startRun();
  const ended = input.context.clock.finishRun(started);
  const trace = parseFailureEnvelopeTrace(input.rawInput);
  const taskType = trace.taskType ?? input.taskType;
  const taskTypeSource = trace.taskType === null && input.taskType !== null ? "parsed_input" : trace.taskTypeSource;
  const childCapabilityId = input.childCapabilityId;
  const rawInputRef = buildStableAiRef("ai-raw-input", [trace.missionId, trace.sessionId, taskType, input.failureReason]);
  const schemaDiagnostics = buildInputSchemaDiagnostics(input.rawInput, input.failureReason);
  const fallbackProof = buildDispatchFallbackProof({
    trace,
    taskType,
    taskTypeSource,
    childCapabilityId,
    providerKind: input.providerKind,
    failureReason: input.failureReason,
    startedAt: started.startedAt,
    endedAt: ended.endedAt,
    durationMs: ended.durationMs,
    clockPortKind: ended.portKind,
  });

  return AiDispatchFailureEnvelopeSchema.parse({
    status: "failed",
    abilityGroupId: "ai",
    failureKind: "dispatch_failure",
    childCapabilityId,
    taskType,
    rawInputRef,
    parseFailureReason: input.statusMessage,
    ...schemaDiagnostics,
    implementationStatus: input.implementationStatus ?? null,
    errorKind: input.errorKind ?? null,
    runtimeCallId: input.runtimeCallId ?? null,
    rawOutputRef: input.rawOutputRef ?? null,
    rawOutputHash: input.rawOutputHash ?? null,
    diagnosticPayloadRef: input.diagnosticPayloadRef ?? input.rawOutputRef ?? null,
    fallbackProof,
    outputAuthority: "non_authoritative",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    createdAt: ended.endedAt,
  });
}
