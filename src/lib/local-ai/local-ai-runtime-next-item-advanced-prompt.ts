import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import { VISION_NEXT_ITEM_ADVANCED_PROMPT_CONTRACT } from "./prompts/vision-next-item-advanced.v1.js";

type VisionNextItemAdvancedRequest = Extract<LocalAiTaskRequest, { taskType: "vision.nextItemAdvanced" }>;

export type VisionNextItemAdvancedPromptParts = {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
};

const buildNextItemAdvancedOutputTemplate = () => ({
  taskType: "vision.nextItemAdvanced",
  promptId: "vision.nextItemAdvanced.v1",
  promptVersion: "v1",
  schemaVersion: "vision.nextItemAdvanced.schema.v1",
  decision: "no",
  nonExecutableSummary: "当前证据未证明已经推进到下一条视频，必须 fail-closed。",
  confidence: 0.22,
  reason: "one sentence explaining whether the next-item action advanced to a new item",
  evidenceObservations: ["describe only what is visibly present in the current post-click viewport evidence"],
  readinessSignals: [],
  blockingSignals: ["one short blocking signal when decision=no"],
  mustReview: false,
});

export const buildNextItemAdvancedPromptParts = (
  request: VisionNextItemAdvancedRequest,
): VisionNextItemAdvancedPromptParts => {
  const contract = VISION_NEXT_ITEM_ADVANCED_PROMPT_CONTRACT;
  const evidenceMetadata = {
    inputMode: request.input.inputMode,
    sampledFrameCount: request.input.sampledFrameCount,
    validFrameCount: request.input.validFrameCount,
    expectedFrameCount: request.input.expectedFrameCount,
  };
  const userPrompt = [
    "Binary decision only: decision must be yes or no, and every required key must be present.",
    "Use only the visible post-click viewport evidence. If the viewport clearly shows a different feed item, return yes. If the same item may still be present, or the evidence is blocked, loading, wrong-surface, or weak, return no.",
    "nonExecutableSummary is logging-only. confidence must be a JSON number from 0 to 1. mustReview must stay false. Never return maybe, unknown, or a review path.",
    `Evidence metadata: ${JSON.stringify(evidenceMetadata)}`,
    `Return JSON structurally similar to this template: ${JSON.stringify(buildNextItemAdvancedOutputTemplate())}`,
  ].join("\n\n");

  return {
    systemPrompt: contract.prompt,
    userPrompt,
    fullPrompt: [contract.prompt, userPrompt].join("\n\n"),
  };
};

export const buildNextItemAdvancedPrompt = (request: VisionNextItemAdvancedRequest): string =>
  buildNextItemAdvancedPromptParts(request).fullPrompt;