type JsonRecord = Record<string, unknown>;

type VisionRuntimeDecisionState = {
  normalizedRootIsProductVideo: boolean | null | undefined;
  rootIsProductVideo: boolean | null;
  decision: "product_yes" | "product_no";
  routeLabel: string;
  nonExecutableSummary: string;
  confidence: number;
  uncertainty: string[];
  consistentDecision: {
    isProductVideo: boolean | null;
    mustReview: unknown;
  };
  isProductVideo: boolean | null;
};

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
  || decisionState.decision !== value.decision
  || decisionState.routeLabel !== value.routeLabel
  || decisionState.confidence !== value.confidence;

const hasVisionRuntimeContractIdentityAdjustment = (value: JsonRecord): boolean =>
  typeof value.taskType !== "string"
  || value.taskType !== "vision.productPresence"
  || value.promptId !== "vision.productPresence.v1"
  || value.promptVersion !== "v1"
  || value.schemaVersion !== "vision.productPresence.schema.v1";

const hasVisionRuntimeContractPayloadAdjustment = (
  value: JsonRecord,
  frameState: VisionRuntimeFrameState,
): boolean =>
  typeof value.nonExecutableSummary !== "string"
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
  promptId: "vision.productPresence.v1",
  promptVersion: "v1",
  schemaVersion: "vision.productPresence.schema.v1",
  isProductVideo: decisionState.isProductVideo,
  decision: decisionState.decision,
  routeLabel: decisionState.routeLabel,
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
