import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import type { VideoFrameSamplePointLabel } from "../../types/multi-frame-evidence.js";
import { getVisionProductPresencePromptContract } from "./prompt-registry.js";

type VisionProductPresenceRequest = Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>;

export type VisionPromptParts = {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
};

export const resolveExpectedFrameLabels = (request: VisionProductPresenceRequest): VideoFrameSamplePointLabel[] => {
  if (request.input.samplingStrategy === "fixed_3_6_10") {
    return ["frame_3s", "frame_6s", "frame_10s"];
  }

  return ["adaptive_first", "adaptive_mid", "adaptive_late"];
};

const buildVisionOutputExample = (request: VisionProductPresenceRequest) => ({
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
  confidence: 0.5,
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
  suggestedNextAction: "skip_or_operator_review",
  uncertainty: ["use this only when visibility is partial or ambiguous"],
  mustReview: true,
});

export const buildVisionPromptParts = (request: VisionProductPresenceRequest): VisionPromptParts => {
  const contract = getVisionProductPresencePromptContract();
  const expectedFrameLabels = resolveExpectedFrameLabels(request);
  const userPrompt = [
    "Every key in the required schema is mandatory. If uncertain, keep the key and use null, [], or review_required-compatible values instead of omitting fields.",
    `frameLevelObservations[].frameLabel must use only these labels: ${expectedFrameLabels.join(", ")}.`,
    "frameLevelObservations[].hasVisibleProduct must be true, false, or null.",
    `Return JSON matching this schema: ${JSON.stringify(contract.requiredOutputSchema)}`,
    `Return JSON structurally similar to this example: ${JSON.stringify(buildVisionOutputExample(request))}`,
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