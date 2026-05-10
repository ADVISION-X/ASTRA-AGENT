import type { VisionRuntimeDecisionState } from "./local-ai-runtime-vision-normalization-decision.js";

type JsonRecord = Record<string, unknown>;

type VisionRuntimeFrameState = {
  normalizedFrameObservations: { adjusted: boolean; observations: Array<{ frameLabel: string; hasVisibleProduct: boolean | null; visibleProductTypes: string[]; observations: string[] }> };
};

const hasUnexpectedExecutableField = (value: JsonRecord): boolean =>
  typeof value.suggestedNextAction === "string"
  || typeof value.nextIntent === "string"
  || typeof value.actionIntent === "string"
  || typeof value.action_intent === "string";

const hasVisionRuntimeContentAdjustment = (
  value: JsonRecord,
  decisionState: VisionRuntimeDecisionState,
  frameState: VisionRuntimeFrameState,
): boolean =>
  decisionState.normalizedRootIsProductVideo !== value.isProductVideo
  || decisionState.consistentDecision.isProductVideo !== decisionState.rootIsProductVideo
  || decisionState.consistentDecision.mustReview !== value.mustReview
  || decisionState.taskDecision !== value.taskDecision
  || decisionState.pageStateDecision !== value.pageStateDecision
  || decisionState.confidence !== value.confidence;

const hasVisionRuntimeContractIdentityAdjustment = (value: JsonRecord): boolean =>
  typeof value.taskType !== "string"
  || value.taskType !== "vision.productPresence"
  || value.promptId !== "visual-mission-judge.v1"
  || value.promptVersion !== "v1"
  || value.schemaVersion !== "visual-mission-judge.schema.v1";

const hasVisionRuntimeContractPayloadAdjustment = (
  value: JsonRecord,
  frameState: VisionRuntimeFrameState,
): boolean =>
  typeof value.nonExecutableSummary !== "string"
  || typeof value.actionPlan !== "object"
  || value.actionPlan === null
  || frameState.normalizedFrameObservations.adjusted
  || typeof value.reason !== "string"
  || hasUnexpectedExecutableField(value);

const hasVisionRuntimeContractAdjustment = (
  value: JsonRecord,
  frameState: VisionRuntimeFrameState,
): boolean =>
  hasVisionRuntimeContractIdentityAdjustment(value)
  || hasVisionRuntimeContractPayloadAdjustment(value, frameState);

export const isVisionRuntimeOutputAdjusted = (
  value: JsonRecord,
  decisionState: VisionRuntimeDecisionState,
  frameState: VisionRuntimeFrameState,
): boolean =>
  hasVisionRuntimeContentAdjustment(value, decisionState, frameState)
  || hasVisionRuntimeContractAdjustment(value, frameState);

export const buildVisionRuntimeNormalizedOutput = (
  value: JsonRecord,
  decisionState: VisionRuntimeDecisionState,
  frameState: VisionRuntimeFrameState,
) => ({
  ...value,
  taskType: "vision.productPresence",
  promptId: "visual-mission-judge.v1",
  promptVersion: "v1",
  schemaVersion: "visual-mission-judge.schema.v1",
  isProductVideo: decisionState.isProductVideo,
  taskDecision: decisionState.taskDecision,
  pageStateDecision: decisionState.pageStateDecision,
  actionPlan: decisionState.actionPlan,
  nonExecutableSummary: decisionState.nonExecutableSummary,
  confidence: decisionState.confidence,
  reason: typeof value.reason === "string" && value.reason.length > 0
    ? value.reason
    : (typeof value.aggregateReason === "string" && value.aggregateReason.length > 0
      ? value.aggregateReason
      : "Local vision model did not provide a separate reason field; aggregateReason was unavailable."),
  frameLevelObservations: frameState.normalizedFrameObservations.observations,
  uncertainty: decisionState.uncertainty,
  mustReview: decisionState.consistentDecision.mustReview,
});
