import type { VisualMissionActionPlanOutput } from "../../../types/visual-mission-action-plan.js";
import type { AiAbilityInput, AiAbilityResult } from "../contract.js";
import { buildHash } from "../runtime/model-call.js";
import { buildAiResult } from "../runtime/result.js";

type SuccessInput = {
  request: AiAbilityInput;
  output: VisualMissionActionPlanOutput;
  rawOutputText: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  modelName: string;
  runtime: string;
  timeoutMs: number | null;
  runtimeCallId: string | null;
  promptVersion: string;
  modelConfig: unknown;
};

type FailureInput = {
  request: AiAbilityInput;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  modelName: string;
  runtime: string;
  timeoutMs: number | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  status: AiAbilityResult["status"];
  reason: string;
  schemaIssueCount?: number;
};

const promptCatalogVersion = (request: AiAbilityInput): string =>
  (typeof request.promptCatalogVersion === "string" ? request.promptCatalogVersion : null) ?? request.promptContractId;

export const buildSuccessResult = (input: SuccessInput): AiAbilityResult => buildAiResult({
  request: input.request,
  status: "success",
  output: input.output,
  rawOutputText: input.rawOutputText,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: input.durationMs,
  reason: "visual_mission_judgment_completed",
  modelName: input.modelName,
  runtime: input.runtime,
  timeoutMs: input.timeoutMs,
  runtimeCallId: input.runtimeCallId,
  promptContractVersion: input.promptVersion,
  promptCatalogVersion: promptCatalogVersion(input.request),
  promptContractHash: buildHash(JSON.stringify({
    promptContractId: input.request.promptContractId,
    promptContractVersion: input.promptVersion,
    expectedOutputSchema: input.request.expectedOutputSchema,
  })),
  modelConfigHash: buildHash(JSON.stringify(input.modelConfig)),
});

export const buildFailureResult = (input: FailureInput): AiAbilityResult => buildAiResult({
  request: input.request,
  status: input.status,
  output: null,
  rawOutputText: null,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: input.durationMs,
  reason: input.reason,
  modelName: input.modelName,
  runtime: input.runtime,
  timeoutMs: input.timeoutMs,
  failureReason: input.failureReason ?? null,
  reviewRequiredReason: input.reviewRequiredReason ?? null,
  promptContractVersion: "v1",
  promptCatalogVersion: promptCatalogVersion(input.request),
  promptContractHash: buildHash(input.request.promptContractId),
  modelConfigHash: buildHash("model-config-unavailable"),
  ...(input.schemaIssueCount !== undefined ? { schemaIssueCount: input.schemaIssueCount } : {}),
});
