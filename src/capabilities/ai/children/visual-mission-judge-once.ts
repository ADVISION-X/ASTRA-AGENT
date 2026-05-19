import { randomUUID } from "node:crypto";

import { VisualMissionActionPlanOutputSchema } from "../../../types/visual-mission-action-plan.js";
import type { VisualMissionActionPlanOutput } from "../../../types/visual-mission-action-plan.js";
import type { AiAbilityInput, AiAbilityResult } from "../contract.js";
import { parseAiJsonOutput } from "../runtime/json-extract.js";
import type { RuntimeLogger, TraceContext } from "../runtime/model-call.js";
import { callModelWithTransientRetry } from "./visual-mission-retry.js";
import { buildFailureResult, buildSuccessResult } from "./visual-mission-result.js";
import { emitAiDecisionSummary, emitAiErrorDebug, emitAiParseFailure, emitAiParseSuccess, type AiLogContext } from "./visual-mission-logs.js";

type ExecuteVisualMissionInput = {
  dataDir: string;
  request: AiAbilityInput;
  signal?: AbortSignal;
  runtimeLogger?: RuntimeLogger;
  traceContext?: TraceContext;
};

async function executeVisualMissionJudgeOnce(input: ExecuteVisualMissionInput): Promise<AiAbilityResult> {
  const startedAt = new Date().toISOString();
  const logContext = buildLogContext(input);
  try {
    return await executeVisualMissionSuccess(input, logContext, startedAt);
  } catch (error) {
    return buildVisualMissionFailure(input.request, logContext, startedAt, error);
  }
}

const buildLogContext = (input: ExecuteVisualMissionInput): AiLogContext => ({
  request: input.request,
  ...(input.runtimeLogger ? { logger: input.runtimeLogger } : {}),
  ...(input.traceContext ? { trace: input.traceContext } : {}),
  spanId: randomUUID(),
});

const executeVisualMissionSuccess = async (
  input: ExecuteVisualMissionInput,
  logContext: AiLogContext,
  startedAt: string,
): Promise<AiAbilityResult> => {
  const modelCall = await callModelWithTransientRetry({ ...input, spanId: logContext.spanId });
  const output = parseVisualMissionOutput(modelCall.rawOutputText, logContext);
  const endedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
  emitAiParseSuccess(logContext, output, durationMs);
  emitAiDecisionSummary(logContext, output, durationMs);
  return buildSuccessResult({ request: input.request, output, rawOutputText: modelCall.rawOutputText, startedAt, endedAt, durationMs, modelName: modelCall.modelName ?? "unknown", runtime: modelCall.runtime ?? "gemini-api", timeoutMs: modelCall.timeoutMs, runtimeCallId: modelCall.runtimeCallId ?? null, promptVersion: modelCall.promptVersion, modelConfig: modelCall.modelConfig });
};

const buildVisualMissionFailure = (
  request: AiAbilityInput,
  logContext: AiLogContext,
  startedAt: string,
  error: unknown,
): AiAbilityResult => {
  const endedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
  const message = error instanceof Error ? error.message : String(error);
  const status = message.includes("schema") || message.includes("JSON") ? "review_required" : "failed";
  emitAiErrorDebug(logContext, status, message, durationMs);
  return buildFailureResult({ request, startedAt, endedAt, durationMs, modelName: "unknown", runtime: "gemini-api", timeoutMs: null, failureReason: status === "failed" ? message : null, reviewRequiredReason: status === "review_required" ? message : null, status, reason: status === "review_required" ? "visual_mission_judgment_review_required" : "visual_mission_judgment_failed", schemaIssueCount: status === "review_required" ? 1 : 0 });
};

const parseVisualMissionOutput = (
  rawOutputText: string,
  logContext: AiLogContext,
): VisualMissionActionPlanOutput => {
  try {
    return parseAiJsonOutput(rawOutputText, VisualMissionActionPlanOutputSchema) as VisualMissionActionPlanOutput;
  } catch (error) {
    const parseMsg = error instanceof Error ? error.message : String(error);
    emitAiParseFailure(logContext, parseMsg);
    emitAiErrorDebug(logContext, "review_required", parseMsg, 0);
    throw error;
  }
};

export { executeVisualMissionJudgeOnce };
