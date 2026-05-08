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
  confidence: 0.24,
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
  const evidenceMetadata = {
    inputMode: request.input.inputMode,
    sampledFrameCount: request.input.sampledFrameCount,
    validFrameCount: request.input.validFrameCount,
    expectedFrameCount: request.input.expectedFrameCount,
    frameLabels: expectedFrameLabels,
  };
  const userPrompt = [
    "Binary route only: decision must be product_yes or product_no, and every required key must be present.",
    `routeLabel is mandatory: product_yes => ${PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL}; product_no => ${PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL}.`,
    "Use only the visible sampled evidence. One clearly visible product frame is enough for product_yes; do not require all frames to show the product.",
    "If a concrete product is clearly being demonstrated, displayed, used, unboxed, compared, worn, held, installed, assembled, or shown for sale, return decision=product_yes, isProductVideo=true, and list the visible product types.",
    `If the sampled evidence does not visibly show that kind of product presentation, return decision=product_no, isProductVideo=false, routeLabel=${PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL}, and explain the missing visual proof.`,
    "nonExecutableSummary is logging-only. confidence must be a JSON number from 0 to 1. mustReview must stay false. uncertainty may explain a no decision but must never become a third branch.",
    "Never copy placeholders into confidence, evidenceObservations, reason, aggregateReason, uncertainty, or frameLevelObservations.",
    `Evidence metadata: ${JSON.stringify(evidenceMetadata)}`,
    `Return JSON structurally similar to this template: ${JSON.stringify(buildVisionOutputTemplate(request))}`,
  ].join("\n\n");

  return {
    systemPrompt: contract.prompt,
    userPrompt,
    fullPrompt: [contract.prompt, userPrompt].join("\n\n"),
  };
};

export const buildVisionPrompt = (request: VisionProductPresenceRequest): string => buildVisionPromptParts(request).fullPrompt;
