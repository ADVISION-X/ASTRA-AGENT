import { RuntimeLogEventType } from "../../../lib/runtime-logs/index.js";
import type { VisualMissionActionPlanOutput } from "../../../types/visual-mission-action-plan.js";
import type { AiAbilityInput, AiAbilityResult } from "../contract.js";
import type { RuntimeLogger, TraceContext } from "../runtime/model-call.js";

export type AiLogContext = {
  request: AiAbilityInput;
  logger?: RuntimeLogger;
  trace?: TraceContext;
  spanId: string;
};

const getTraceId = (context: AiLogContext): string =>
  context.trace?.traceId ?? context.request.missionId ?? "no-trace";

const baseLogFields = (context: AiLogContext) => ({
  owner: "ai-capability" as const,
  spanId: context.spanId,
  ...(context.request.missionId ? { missionId: context.request.missionId } : {}),
});

export const emitAiParseFailure = (
  context: AiLogContext,
  parseMsg: string,
): void => {
  context.logger?.emit({
    eventType: RuntimeLogEventType.AI_PARSE_RESULT_DEBUG,
    level: "warn",
    modeVisibility: ["DEBUG", "TRACE"],
    traceId: getTraceId(context),
    ...baseLogFields(context),
    status: "review_required",
    reason: "json_parse_failed",
    payload: { parserErrors: [parseMsg], schemaStatus: "invalid", schemaIssueCount: 1 },
  });
};

export const emitAiParseSuccess = (
  context: AiLogContext,
  output: VisualMissionActionPlanOutput,
  durationMs: number,
): void => {
  context.logger?.emit({
    eventType: RuntimeLogEventType.AI_PARSE_RESULT_DEBUG,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    traceId: getTraceId(context),
    ...baseLogFields(context),
    status: "success",
    reason: "json_parse_success",
    metrics: { actionCount: output.nextAction ? 1 : 0, schemaIssueCount: 0, durationMs },
    payload: { schemaStatus: "valid", parserErrors: [] },
  });
};

export const emitAiDecisionSummary = (
  context: AiLogContext,
  output: VisualMissionActionPlanOutput,
  durationMs: number,
): void => {
  context.logger?.emit({
    eventType: RuntimeLogEventType.AI_DECISION_SUMMARY,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    traceId: getTraceId(context),
    ...baseLogFields(context),
    status: "success",
    reason: `goalMatched=${String(output.goalMatched)} save=${String(output.save)} decision=${String(output.decision)} nextAction=${output.nextAction?.actionCode ?? "none"}`,
    metrics: { actionCount: output.nextAction ? 1 : 0, durationMs },
  });
};

export const emitAiErrorDebug = (
  context: AiLogContext,
  status: AiAbilityResult["status"],
  message: string,
  durationMs: number,
): void => {
  context.logger?.emit({
    eventType: RuntimeLogEventType.AI_ERROR_DEBUG,
    level: status === "review_required" ? "warn" : "error",
    modeVisibility: ["DEBUG", "TRACE"],
    traceId: getTraceId(context),
    ...baseLogFields(context),
    status,
    reason: status === "review_required" ? "visual_mission_judgment_review_required" : "visual_mission_judgment_failed",
    actionableMessage: message,
    ownerResponsible: "ai-capability",
    metrics: { durationMs },
  });
};
