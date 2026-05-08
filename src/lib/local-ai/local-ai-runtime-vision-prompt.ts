import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import type { VideoFrameSamplePointLabel } from "../../types/multi-frame-evidence.js";
import {
  PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
  PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL,
} from "../../map-plugins/route-plans/product-discovery-route-plan.constants.js";
import { VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT } from "./prompts/vision-product-presence.v1.js";

type VisionProductPresenceRequest = Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>;

export type VisionPromptParts = {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
};

export const resolveExpectedFrameLabels = (request: VisionProductPresenceRequest): VideoFrameSamplePointLabel[] => {
  if (request.input.samplingStrategy === "fixed_3_6") {
    return ["frame_3s", "frame_6s"];
  }
  if (request.input.samplingStrategy === "fixed_3_6_10") {
    return ["frame_3s", "frame_6s", "frame_10s"];
  }

  return ["adaptive_first", "adaptive_mid", "adaptive_late"];
};

const buildVisionOutputTemplate = (request: VisionProductPresenceRequest) => ({
  taskType: "vision.productPresence",
  promptId: "vision.productPresence.v1",
  promptVersion: "v1",
  schemaVersion: "vision.productPresence.schema.v1",
  inputMode: request.input.inputMode,
  multiFrameEvidenceSetId: request.input.multiFrameEvidenceSetId,
  contactSheetEvidenceId: request.input.contactSheetEvidenceId,
  frameEvidenceIds: request.input.frameEvidenceIds,
  screenshotEvidenceId: request.input.screenshotEvidenceId,
  sampledFrameCount: request.input.sampledFrameCount,
  validFrameCount: request.input.validFrameCount,
  expectedFrameCount: request.input.expectedFrameCount,
  fallbackReason: request.input.fallbackReason,
  missingFrames: request.input.missingFrames,
  isProductVideo: null,
  decision: "product_no",
  routeLabel: PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
  nonExecutableSummary: "当前证据未证明产品展示，选择非产品路线标签。",
  confidence: "AI_ESTIMATE_NUMBER_0_TO_1_DO_NOT_COPY_THIS_PLACEHOLDER",
  visibleProductTypes: [],
  evidenceObservations: ["describe only what is visibly present in the sampled frames"],
  reason: "one sentence explaining the product-presence decision",
  frameLevelObservations: [{
    frameLabel: resolveExpectedFrameLabels(request)[0] ?? "adaptive_first",
    hasVisibleProduct: null,
    visibleProductTypes: [],
    observations: ["one short frame-level observation"],
  }],
  aggregateReason: "one sentence summarizing all sampled frames together",
  uncertainty: [],
  mustReview: false,
});

export const buildVisionPromptParts = (request: VisionProductPresenceRequest): VisionPromptParts => {
  const contract = VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT;
  const expectedFrameLabels = resolveExpectedFrameLabels(request);
  const userPrompt = [
    "Every key in the required schema is mandatory. The product-presence route is binary: decision must be product_yes or product_no.",
    `routeLabel is mandatory and must come from the selected binary options: product_yes => ${PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL}; product_no => ${PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL}.`,
    "nonExecutableSummary is mandatory and may only summarize evidence for logging. It must not introduce a third path, a human-review path, or any executable click/scroll/type instruction.",
    "confidence must be your own calibrated estimate as a JSON number from 0 to 1 based only on visible evidence; do not copy any placeholder or example value.",
    "Do not reserve confidence around 0.5 to avoid deciding. If evidence is ambiguous, blocked, too partial, text-only, or not enough to prove product presence, choose product_no with lower confidence and describe the limitation.",
    `If the sampled evidence clearly shows no concrete product being demonstrated, featured, used, unboxed, compared, worn, held, installed, assembled, displayed for sale, or presented, return isProductVideo=false, decision=product_no, routeLabel=${PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL}, and mustReview=false.`,
    "For decision=product_no, isProductVideo must be false. For decision=product_yes, isProductVideo must be true.",
    "Never return product_uncertain, review_required, null decision, skip_or_operator_review, or mustReview=true for this automated discovery task.",
    "Use uncertainty only as explanatory evidence for why a product_no decision was chosen; uncertainty must never request human review.",
    "Never copy instructional placeholder text into uncertainty, evidenceObservations, reason, aggregateReason, or frameLevelObservations.",
    `frameLevelObservations[].frameLabel must use only these labels: ${expectedFrameLabels.join(", ")}.`,
    "frameLevelObservations[].hasVisibleProduct must be true, false, or null.",
    `Return JSON matching this schema: ${JSON.stringify(contract.requiredOutputSchema)}`,
    `Return JSON structurally similar to this template: ${JSON.stringify(buildVisionOutputTemplate(request))}`,
    `Task input: ${JSON.stringify(request.input)}`,
    `Forbidden outputs: ${contract.forbiddenOutputs.join("; ")}`,
  ].join("\n\n");

  return {
    systemPrompt: contract.prompt,
    userPrompt,
    fullPrompt: [contract.prompt, userPrompt].join("\n\n"),
  };
};

export const buildVisionPrompt = (request: VisionProductPresenceRequest): string => buildVisionPromptParts(request).fullPrompt;
