import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import type { VideoFrameSamplePointLabel } from "../../types/multi-frame-evidence.js";
import { VISION_PRODUCT_PRESENCE_PROMPT_CONTRACT } from "./prompts/vision-product-presence.v1.js";

type VisionProductPresenceRequest = Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>;

type VisionPromptParts = {
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

const buildVisionOutputFieldGuide = (request: VisionProductPresenceRequest): string[] => {
  const firstFrameLabel = resolveExpectedFrameLabels(request)[0] ?? "adaptive_first";
  return [
    'taskType = "vision.productPresence"',
    'promptId = "visual-mission-judge.v1"',
    'promptVersion = "v1"',
    'schemaVersion = "visual-mission-judge.schema.v1"',
    `inputMode = ${JSON.stringify(request.input.inputMode)}`,
    `multiFrameEvidenceSetId = ${JSON.stringify(request.input.multiFrameEvidenceSetId)}`,
    `contactSheetEvidenceId = ${JSON.stringify(request.input.contactSheetEvidenceId)}`,
    `frameEvidenceIds = ${JSON.stringify(request.input.frameEvidenceIds)}`,
    `screenshotEvidenceId = ${JSON.stringify(request.input.screenshotEvidenceId)}`,
    `sampledFrameCount = ${String(request.input.sampledFrameCount)}`,
    `validFrameCount = ${String(request.input.validFrameCount)}`,
    `expectedFrameCount = ${String(request.input.expectedFrameCount)}`,
    `fallbackReason = ${JSON.stringify(request.input.fallbackReason)}`,
    `missingFrames = ${JSON.stringify(request.input.missingFrames)}`,
    `userRequirementRef = ${JSON.stringify(request.input.userRequirementRef ?? `user-requirement:${request.id}`)}`,
    'isProductVideo = true when the visible frame shows a concrete product presentation; otherwise false',
    'taskDecision = "YES_SEEDING_VIDEO_FLOW" when isProductVideo=true, otherwise "NO_SEEDING_VIDEO_FLOW"',
    'pageStateDecision = "ready"',
    'actionPlan = one object that follows visualMissionActionPlan.v1 and contains exactly one action whose actionCode equals taskDecision',
    'nonExecutableSummary = one short grounded Chinese sentence describing what is visibly shown',
    'confidence = one grounded JSON number from 0 to 1',
    'visibleProductTypes = concrete visible product/category names, or [] when none are visible',
    'evidenceObservations = 1 to 3 short grounded observations from the visible frame only',
    'reason = one grounded Chinese sentence explaining the decision',
    `frameLevelObservations = array with one object for ${firstFrameLabel} using grounded observations`,
    'aggregateReason = one grounded Chinese sentence summarizing the visible evidence',
    'uncertainty = [] unless a specific visible limitation matters',
    'mustReview = false',
  ];
};

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
    "Return a governed action plan only: taskDecision must be YES_SEEDING_VIDEO_FLOW or NO_SEEDING_VIDEO_FLOW, and every required key must be present.",
    "Use only the visible sampled evidence. One clearly visible product frame is enough for product_yes; do not require all frames to show the product.",
    "If a concrete product is clearly being demonstrated, displayed, used, unboxed, compared, worn, held, installed, assembled, or shown for sale, return isProductVideo=true, taskDecision=YES_SEEDING_VIDEO_FLOW, and actionPlan.actions[0].actionCode=YES_SEEDING_VIDEO_FLOW.",
    "If the sampled evidence does not visibly show that kind of product presentation, return isProductVideo=false, taskDecision=NO_SEEDING_VIDEO_FLOW, and actionPlan.actions[0].actionCode=NO_SEEDING_VIDEO_FLOW.",
    "pageStateDecision must stay ready. nonExecutableSummary is logging-only. confidence must be a JSON number from 0 to 1. mustReview must stay false. uncertainty may explain a no decision but must never become a third branch.",
    "Do not echo schema instructions, placeholder wording, or translated template text. Every output string must be grounded in the visible image content.",
    `Evidence metadata: ${JSON.stringify(evidenceMetadata)}`,
    "Return one JSON object with exactly these fields and grounded values:",
    ...buildVisionOutputFieldGuide(request),
  ].join("\n\n");

  return {
    systemPrompt: contract.prompt,
    userPrompt,
    fullPrompt: [contract.prompt, userPrompt].join("\n\n"),
  };
};

const buildVisionPrompt = (request: VisionProductPresenceRequest): string => buildVisionPromptParts(request).fullPrompt;
