import { randomUUID } from "node:crypto";

import { VisualMissionActionPlanOutputSchema } from "../../../types/visual-mission-action-plan.js";
import type { AiAbilityInput, AiAbilityResult } from "../contract.js";
import { parseAiJsonOutput } from "../runtime/json-extract.js";
import { buildHash, callLocalVisualMissionModel } from "../runtime/model-call.js";
import type { RuntimeLogger, TraceContext } from "../runtime/model-call.js";
import { buildAiResult } from "../runtime/result.js";
import { RuntimeLogEventType } from "../../../lib/runtime-logs/index.js";

const buildFailureResult = (input: {
  request: AiAbilityInput;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  modelName: string;
  runtime: string;
  timeoutMs: number | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  rawOutputText?: string | null;
  promptContractVersion: string;
  promptCatalogVersion: string;
  promptContractHash: string;
  modelConfigHash: string;
  status: AiAbilityResult["status"];
  reason: string;
  schemaIssueCount?: number;
}) => buildAiResult({
  request: input.request,
  status: input.status,
  output: null,
  rawOutputText: input.rawOutputText ?? null,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: input.durationMs,
  reason: input.reason,
  modelName: input.modelName,
  runtime: input.runtime,
  timeoutMs: input.timeoutMs,
  failureReason: input.failureReason ?? null,
  reviewRequiredReason: input.reviewRequiredReason ?? null,
  promptContractVersion: input.promptContractVersion,
  promptCatalogVersion: input.promptCatalogVersion,
  promptContractHash: input.promptContractHash,
  modelConfigHash: input.modelConfigHash,
  ...(input.schemaIssueCount !== undefined ? { schemaIssueCount: input.schemaIssueCount } : {}),
});

async function executeVisualMissionJudgeOnce(input: {
  request: AiAbilityInput;
  signal?: AbortSignal;
  runtimeLogger?: RuntimeLogger;
  traceContext?: TraceContext;
}): Promise<AiAbilityResult> {
  const startedAt = new Date().toISOString();
  const logger = input.runtimeLogger;
  const trace = input.traceContext;
  const spanId = randomUUID();

  try {
    const modelCall = await callLocalVisualMissionModel({
      request: input.request,
      ...(input.signal ? { signal: input.signal } : {}),
      ...(logger ? { runtimeLogger: logger } : {}),
      ...(trace ? { traceContext: trace } : {}),
    });

    let output: import("../../../types/visual-mission-action-plan.js").VisualMissionActionPlanOutput;
    let parserErrors: string[] = [];
    let schemaStatus: "valid" | "invalid" = "valid";
    let schemaIssueCount = 0;

    try {
      output = parseAiJsonOutput(modelCall.rawOutputText, VisualMissionActionPlanOutputSchema) as import("../../../types/visual-mission-action-plan.js").VisualMissionActionPlanOutput;
    } catch (parseError) {
      const parseMsg = parseError instanceof Error ? parseError.message : String(parseError);
      parserErrors = [parseMsg];
      schemaStatus = "invalid";
      schemaIssueCount = 1;

      // ── AI_PARSE_RESULT_DEBUG (parse failure) ──────────────────────────
      logger?.emit({
        eventType: RuntimeLogEventType.AI_PARSE_RESULT_DEBUG,
        level: "warn",
        modeVisibility: ["DEBUG", "TRACE"],
        owner: "ai-capability",
        traceId: trace?.traceId ?? input.request.missionId ?? "no-trace",
        spanId,
        ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
        status: "review_required",
        reason: "json_parse_failed",
        payload: { parserErrors, schemaStatus, schemaIssueCount },
      });

      // ── AI_ERROR_DEBUG (before throw) ──────────────────────────────────
      logger?.emit({
        eventType: RuntimeLogEventType.AI_ERROR_DEBUG,
        level: "warn",
        modeVisibility: ["DEBUG", "TRACE"],
        owner: "ai-capability",
        traceId: trace?.traceId ?? input.request.missionId ?? "no-trace",
        spanId,
        ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
        status: "review_required",
        reason: "visual_mission_judgment_review_required",
        actionableMessage: parseMsg,
        ownerResponsible: "ai-capability",
      });

      throw parseError;
    }

    const endedAt = new Date().toISOString();
    const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));

    // ── AI_PARSE_RESULT_DEBUG (success) ──────────────────────────────────
    logger?.emit({
      eventType: RuntimeLogEventType.AI_PARSE_RESULT_DEBUG,
      level: "debug",
      modeVisibility: ["DEBUG", "TRACE"],
      owner: "ai-capability",
      traceId: trace?.traceId ?? input.request.missionId ?? "no-trace",
      spanId,
      ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
      status: "success",
      reason: "json_parse_success",
      metrics: {
        actionCount: Array.isArray(output.actions) ? output.actions.length : 0,
        schemaIssueCount: 0,
        durationMs,
      },
      payload: {
        schemaStatus: "valid",
        parserErrors: [],
      },
    });

    return buildAiResult({
      request: input.request,
      status: "success",
      output,
      rawOutputText: modelCall.rawOutputText,
      startedAt,
      endedAt,
      durationMs,
      reason: "visual_mission_judgment_completed",
      modelName: modelCall.modelName ?? "unknown",
      runtime: modelCall.runtime ?? "ollama",
      timeoutMs: modelCall.timeoutMs,
      promptContractVersion: modelCall.promptVersion,
      promptCatalogVersion: (typeof input.request.promptCatalogVersion === "string" ? input.request.promptCatalogVersion : null) ?? input.request.promptContractId,
      promptContractHash: buildHash(JSON.stringify({
        promptContractId: input.request.promptContractId,
        promptContractVersion: modelCall.promptVersion,
        expectedOutputSchema: input.request.expectedOutputSchema,
      })),
      modelConfigHash: buildHash(JSON.stringify(modelCall.modelConfig)),
    });
  } catch (error) {
    const endedAt = new Date().toISOString();
    const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
    const message = error instanceof Error ? error.message : String(error);
    const failureStatus = message.includes("schema") || message.includes("JSON")
      ? "review_required"
      : "failed";

    // ── AI_ERROR_DEBUG (outer catch — covers model failures too) ─────────
    logger?.emit({
      eventType: RuntimeLogEventType.AI_ERROR_DEBUG,
      level: failureStatus === "review_required" ? "warn" : "error",
      modeVisibility: ["DEBUG", "TRACE"],
      owner: "ai-capability",
      traceId: trace?.traceId ?? input.request.missionId ?? "no-trace",
      spanId,
      ...(input.request.missionId ? { missionId: input.request.missionId } : {}),
      status: failureStatus,
      reason: failureStatus === "review_required" ? "visual_mission_judgment_review_required" : "visual_mission_judgment_failed",
      actionableMessage: message,
      ownerResponsible: "ai-capability",
      metrics: { durationMs },
    });

    return buildFailureResult({
      request: input.request,
      startedAt,
      endedAt,
      durationMs,
      modelName: "unknown",
      runtime: "ollama",
      timeoutMs: null,
      failureReason: failureStatus === "failed" ? message : null,
      reviewRequiredReason: failureStatus === "review_required" ? message : null,
      promptContractVersion: "v1",
      promptCatalogVersion: (typeof input.request.promptCatalogVersion === "string" ? input.request.promptCatalogVersion : null) ?? input.request.promptContractId,
      promptContractHash: buildHash(input.request.promptContractId),
      modelConfigHash: buildHash("model-config-unavailable"),
      status: failureStatus,
      reason: failureStatus === "review_required" ? "visual_mission_judgment_review_required" : "visual_mission_judgment_failed",
      schemaIssueCount: failureStatus === "review_required" ? 1 : 0,
    });
  }
}

export { executeVisualMissionJudgeOnce };