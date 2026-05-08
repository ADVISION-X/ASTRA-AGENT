import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import {
  STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL,
  STARTUP_PREPARATION_READY_ROUTE_LABEL,
} from "../../map-plugins/shared/startup-preparation.constants.js";
import { VISION_PAGE_PREPARATION_PROMPT_CONTRACT } from "./prompts/vision-page-preparation.v1.js";

type VisionPagePreparationRequest = Extract<LocalAiTaskRequest, { taskType: "vision.pagePreparation" }>;

export type VisionPagePreparationPromptParts = {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
};

const buildPagePreparationOutputTemplate = () => ({
  taskType: "vision.pagePreparation",
  promptId: "vision.pagePreparation.v1",
  promptVersion: "v1",
  schemaVersion: "vision.pagePreparation.schema.v1",
  decision: "no",
  routeLabel: STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL,
  nonExecutableSummary: "当前页面准备工作未完成，必须 fail-closed。",
  confidence: 0.18,
  reason: "one sentence explaining the startup preparation decision",
  evidenceObservations: ["describe only what is visibly present in the current page evidence"],
  readinessSignals: [],
  blockingSignals: ["one short blocking signal when decision=no"],
  mustReview: false,
});

export const buildPagePreparationPromptParts = (
  request: VisionPagePreparationRequest,
): VisionPagePreparationPromptParts => {
  const contract = VISION_PAGE_PREPARATION_PROMPT_CONTRACT;
  const userPrompt = [
    "Every key in the required schema is mandatory. The startup preparation route is binary: decision must be yes or no.",
    `routeLabel is mandatory and must come from the selected binary options: yes => ${STARTUP_PREPARATION_READY_ROUTE_LABEL}; no => ${STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL}.`,
    "nonExecutableSummary is mandatory and may only summarize evidence for logging. It must not introduce a third path, a human-review path, or any executable click/scroll/type instruction.",
    "confidence must be your own calibrated estimate as a JSON number from 0 to 1 based only on visible evidence; do not copy any placeholder or example value.",
    "If evidence is ambiguous, blocked, loading, wrong-page, login-gated, captcha-gated, or insufficient to proceed, choose no and explain the blocking evidence.",
    `If the sampled evidence clearly shows the page is ready for downstream seeding judgment, return decision=yes, routeLabel=${STARTUP_PREPARATION_READY_ROUTE_LABEL}, and mustReview=false.`,
    "Never return maybe, unknown, review_required, null decision, or mustReview=true for this governed startup task.",
    `Return JSON matching this schema: ${JSON.stringify(contract.requiredOutputSchema)}`,
    `Return JSON structurally similar to this template: ${JSON.stringify(buildPagePreparationOutputTemplate())}`,
    `Task input: ${JSON.stringify(request.input)}`,
    `Forbidden outputs: ${contract.forbiddenOutputs.join("; ")}`,
  ].join("\n\n");

  return {
    systemPrompt: contract.prompt,
    userPrompt,
    fullPrompt: [contract.prompt, userPrompt].join("\n\n"),
  };
};

export const buildPagePreparationPrompt = (request: VisionPagePreparationRequest): string =>
  buildPagePreparationPromptParts(request).fullPrompt;