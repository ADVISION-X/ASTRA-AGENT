import { createHash } from "node:crypto";

import type { VisualMissionActionPlanOutput } from "../../../types/visual-mission-action-plan.js";
import type { AiAbilityInput, AiAbilityResult } from "../contract.js";

const hashJson = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const hashText = (value: string) => createHash("sha256").update(value).digest("hex");

const buildBaseRuntimeProof = (input: {
  request: AiAbilityInput;
  status: AiAbilityResult["status"];
  startedAt: string;
  endedAt: string;
  durationMs: number;
  reason: string;
  rawOutputHash: string | null;
  timeoutMs: number | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  runtimeCallId?: string | null;
  promptContractHash: string;
  modelConfigHash: string;
  schemaIssueCount?: number;
}) => ({
  proofId: `${input.request.capabilityCallId}:ai-proof`,
  abilityGroupId: "ai" as const,
  childCapabilityId: "visual-mission-judge-once" as const,
  missionId: input.request.missionId,
  runId: input.request.runId,
  sessionId: input.request.sessionId,
  roundId: input.request.roundId ?? null,
  videoVisitId: input.request.videoVisitId ?? null,
  requestHash: hashJson({
    missionId: input.request.missionId,
    runId: input.request.runId,
    promptContractId: input.request.promptContractId,
    taskType: input.request.taskType,
  }),
  inputPayloadHash: hashJson(input.request.input),
  promptContractHash: input.promptContractHash,
  modelConfigHash: input.modelConfigHash,
  runtimeCallId: input.runtimeCallId ?? null,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: input.durationMs,
  status: input.status,
  reason: input.reason,
  failureReason: input.failureReason ?? null,
  reviewRequiredReason: input.reviewRequiredReason ?? null,
  inputRefs: input.request.inputRefs.map((entry) => entry.id),
  outputRefs: [],
  evidenceRefs: input.request.inputRefs.map((entry) => entry.id),
  rawOutputRef: null,
  rawOutputHash: input.rawOutputHash,
  timeoutMs: input.timeoutMs,
  attemptIndex: 0,
  retryCount: 0,
  circuitBreakerState: "not_applicable" as const,
  gatewayDurationMs: input.durationMs,
  actionLogRefs: [],
  nextAbilityGroup: null,
  nextChildAbility: null,
  schemaIssueCount: input.schemaIssueCount ?? 0,
  boundaryViolationCount: 0,
  qualityDecisionReason: null,
  dataQualityFlags: [],
  schemaDecision: input.status === "success" ? "passed" : "failed",
  qualityDecision: input.status === "success" ? "passed" : "not_applicable",
  outputBoundaryDecision: input.status === "success" ? "passed" : "blocked",
});

const buildAiResult = (input: {
  request: AiAbilityInput;
  status: AiAbilityResult["status"];
  output: VisualMissionActionPlanOutput | null;
  rawOutputText: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  reason: string;
  modelName: string;
  runtime: string;
  timeoutMs: number | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  runtimeCallId?: string | null;
  promptContractVersion: string;
  promptCatalogVersion: string;
  promptContractHash: string;
  modelConfigHash: string;
  schemaIssueCount?: number;
}): AiAbilityResult => {
  const rawOutputHash = input.rawOutputText ? hashText(input.rawOutputText) : null;
  return {
    abilityGroupId: "ai",
    childCapabilityId: "visual-mission-judge-once",
    status: input.status,
    taskType: input.request.taskType,
    missionId: input.request.missionId,
    runId: input.request.runId,
    modelProvider: "online",
    modelName: input.modelName,
    modelRole: "vision",
    runtime: input.runtime,
    implementationStatus: input.status === "success" ? "model_backed" : "online_ai_unavailable",
    output: input.output,
    rawOutputRef: null,
    rawOutputHash,
    schemaValidationStatus: input.output ? "valid" : input.status === "review_required" ? "invalid" : "not_applicable",
    confidence: input.output?.confidence ?? null,
    failureReason: input.failureReason ?? null,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    durationMs: input.durationMs,
    runtimeProof: buildBaseRuntimeProof({
      request: input.request,
      status: input.status,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMs: input.durationMs,
      reason: input.reason,
      rawOutputHash,
      timeoutMs: input.timeoutMs,
      failureReason: input.failureReason ?? null,
      reviewRequiredReason: input.reviewRequiredReason ?? null,
      runtimeCallId: input.runtimeCallId ?? null,
      promptContractHash: input.promptContractHash,
      modelConfigHash: input.modelConfigHash,
      ...(input.schemaIssueCount !== undefined ? { schemaIssueCount: input.schemaIssueCount } : {}),
    }),
    promptContractId: input.request.promptContractId,
    promptContractVersion: input.promptContractVersion,
    promptCatalogVersion: input.promptCatalogVersion,
    promptVersion: input.promptContractVersion,
    schemaVersion: input.output?.schemaVersion ?? "pureVisualRound.v1",
    createdAt: input.endedAt,
  };
};

export { buildAiResult, hashJson };
