import { VisualMissionActionPlanOutputSchema } from "../../../types/visual-mission-action-plan.js";
import type { AiAbilityInput, AiAbilityResult } from "../contract.js";
import { parseAiJsonOutput } from "../runtime/json-extract.js";
import { buildHash, callLocalVisualMissionModel } from "../runtime/model-call.js";
import { buildAiResult } from "../runtime/result.js";

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
  schemaIssueCount: input.schemaIssueCount,
});

async function executeVisualMissionJudgeOnce(input: {
  request: AiAbilityInput;
  signal?: AbortSignal;
  emitDebugEvent?: import("../../../lib/local-ai/index.js").LocalAiDebugHook;
}): Promise<AiAbilityResult> {
  const startedAt = new Date().toISOString();

  try {
    const modelCall = await callLocalVisualMissionModel(input);
    const output = parseAiJsonOutput(modelCall.rawOutputText, VisualMissionActionPlanOutputSchema);
    const endedAt = new Date().toISOString();
    const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));

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
      promptCatalogVersion: input.request.promptCatalogVersion ?? input.request.promptContractId,
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
      promptCatalogVersion: input.request.promptCatalogVersion ?? input.request.promptContractId,
      promptContractHash: buildHash(input.request.promptContractId),
      modelConfigHash: buildHash("model-config-unavailable"),
      status: failureStatus,
      reason: failureStatus === "review_required" ? "visual_mission_judgment_review_required" : "visual_mission_judgment_failed",
      schemaIssueCount: failureStatus === "review_required" ? 1 : 0,
    });
  }
}

export { executeVisualMissionJudgeOnce };