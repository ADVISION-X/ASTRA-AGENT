import { createHash } from "node:crypto";

import type { VisualMissionActionPlanOutput } from "../../../types/visual-mission-action-plan.js";
import type { AiAbilityInput, AiAbilityResult } from "../contract.js";

const hashJson = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const hashText = (value: string) => createHash("sha256").update(value).digest("hex");

type BuildBaseRuntimeProofInput = {
  request: AiAbilityInput;
  status: AiAbilityResult["status"];
  startedAt: string;
  endedAt: string;
  durationMs: number;
  reason: string;
  timeoutMs: number | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  runtimeCallId?: string | null;
  promptContractHash: string;
  modelConfigHash: string;
  schemaIssueCount?: number;
};

type BuildAiResultInput = BuildBaseRuntimeProofInput & {
  output: VisualMissionActionPlanOutput | null;
  rawOutputText: string | null;
  modelName: string;
  runtime: string;
  promptContractVersion: string;
  promptCatalogVersion: string;
};

const buildProofRequestFields = (input: BuildBaseRuntimeProofInput) => ({
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
});

const buildProofRuntimeFields = (
  input: BuildBaseRuntimeProofInput,
  rawOutputHash: string | null,
) => ({
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
  rawOutputHash,
  timeoutMs: input.timeoutMs,
  attemptIndex: 0,
  retryCount: 0,
  circuitBreakerState: "not_applicable" as const,
  gatewayDurationMs: input.durationMs,
  actionLogRefs: [],
  nextAbilityGroup: null,
  nextChildAbility: null,
});

const buildProofDecisionFields = (input: BuildBaseRuntimeProofInput) => ({
  schemaIssueCount: input.schemaIssueCount ?? 0,
  boundaryViolationCount: 0,
  qualityDecisionReason: null,
  dataQualityFlags: [],
  schemaDecision: input.status === "success" ? "passed" : "failed",
  qualityDecision: input.status === "success" ? "passed" : "not_applicable",
  outputBoundaryDecision: input.status === "success" ? "passed" : "blocked",
});

const buildBaseRuntimeProof = (
  input: BuildBaseRuntimeProofInput,
  rawOutputHash: string | null,
) => ({
  ...buildProofRequestFields(input),
  ...buildProofRuntimeFields(input, rawOutputHash),
  ...buildProofDecisionFields(input),
});

const buildAiIdentityFields = (
  input: BuildAiResultInput,
  rawOutputHash: string | null,
) => ({
  abilityGroupId: "ai" as const,
  childCapabilityId: "visual-mission-judge-once" as const,
  status: input.status,
  taskType: input.request.taskType,
  missionId: input.request.missionId,
  runId: input.request.runId,
  modelProvider: "online" as const,
  modelName: input.modelName,
  modelRole: "vision" as const,
  runtime: input.runtime,
  implementationStatus:
    input.status === "success" ? "model_backed" : "online_ai_unavailable",
  output: input.output,
  rawOutputRef: null,
  rawOutputHash,
});

const resolveSchemaValidationStatus = (
  input: BuildAiResultInput,
): AiAbilityResult["schemaValidationStatus"] => {
  if (input.output) {
    return "valid";
  }
  return input.status === "review_required" ? "invalid" : "not_applicable";
};

const buildAiOutcomeFields = (
  input: BuildAiResultInput,
  rawOutputHash: string | null,
) => ({
  schemaValidationStatus: resolveSchemaValidationStatus(input),
  confidence: input.output?.confidence ?? null,
  failureReason: input.failureReason ?? null,
  reviewRequiredReason: input.reviewRequiredReason ?? null,
  durationMs: input.durationMs,
  runtimeProof: buildBaseRuntimeProof(input, rawOutputHash),
});

const buildAiPromptFields = (input: BuildAiResultInput) => ({
  promptContractId: input.request.promptContractId,
  promptContractVersion: input.promptContractVersion,
  promptCatalogVersion: input.promptCatalogVersion,
  promptVersion: input.promptContractVersion,
  schemaVersion: input.output?.schemaVersion ?? "pureVisualRound.v1",
  createdAt: input.endedAt,
});

const buildAiResult = (input: BuildAiResultInput): AiAbilityResult => {
  const rawOutputHash = input.rawOutputText ? hashText(input.rawOutputText) : null;
  return {
    ...buildAiIdentityFields(input, rawOutputHash),
    ...buildAiOutcomeFields(input, rawOutputHash),
    ...buildAiPromptFields(input),
  };
};

export { buildAiResult, hashJson };
