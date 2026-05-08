import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import {
  NEXT_ITEM_ADVANCED_ROUTE_LABEL,
  NEXT_ITEM_NOT_ADVANCED_ROUTE_LABEL,
} from "../../map-plugins/route-plans/product-discovery-route-plan.constants.js";
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
  routeLabel: NEXT_ITEM_NOT_ADVANCED_ROUTE_LABEL,
  nonExecutableSummary: "当前证据未证明已经推进到下一条视频，必须 fail-closed。",
  confidence: "AI_ESTIMATE_NUMBER_0_TO_1_DO_NOT_COPY_THIS_PLACEHOLDER",
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
  const userPrompt = [
    "Every key in the required schema is mandatory. The next-item advancement route is binary: decision must be yes or no.",
    `routeLabel is mandatory and must come from the selected binary options: yes => ${NEXT_ITEM_ADVANCED_ROUTE_LABEL}; no => ${NEXT_ITEM_NOT_ADVANCED_ROUTE_LABEL}.`,
    "nonExecutableSummary is mandatory and may only summarize evidence for logging. It must not introduce a third path, a human-review path, or any executable click/scroll/type instruction.",
    "confidence must be your own calibrated estimate as a JSON number from 0 to 1 based only on visible evidence; do not copy any placeholder or example value.",
    "If evidence is ambiguous, blocked, loading, wrong-surface, or insufficient to prove advancement safely, choose no and explain the blocking evidence.",
    `If the sampled evidence clearly shows a new feed item after the governed next-item action, return decision=yes, routeLabel=${NEXT_ITEM_ADVANCED_ROUTE_LABEL}, and mustReview=false.`,
    "Never return maybe, unknown, review_required, null decision, or mustReview=true for this governed post-click observation task.",
    `Return JSON matching this schema: ${JSON.stringify(contract.requiredOutputSchema)}`,
    `Return JSON structurally similar to this template: ${JSON.stringify(buildNextItemAdvancedOutputTemplate())}`,
    `Task input: ${JSON.stringify(request.input)}`,
    `Forbidden outputs: ${contract.forbiddenOutputs.join("; ")}`,
  ].join("\n\n");

  return {
    systemPrompt: contract.prompt,
    userPrompt,
    fullPrompt: [contract.prompt, userPrompt].join("\n\n"),
  };
};

export const buildNextItemAdvancedPrompt = (request: VisionNextItemAdvancedRequest): string =>
  buildNextItemAdvancedPromptParts(request).fullPrompt;