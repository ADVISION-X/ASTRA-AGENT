import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import { VISION_NEXT_ITEM_TARGET_CANDIDATE_PROMPT_CONTRACT } from "./prompts/vision-next-item-target-candidate.v1.js";

type NextItemTargetCandidateRequest = Extract<LocalAiTaskRequest, { taskType: "vision.nextItemTargetCandidate" }>;

type NextItemTargetCandidatePromptParts = {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
};

const buildOutputTemplate = (request: NextItemTargetCandidateRequest) => ({
  taskType: "vision.nextItemTargetCandidate",
  promptId: "vision.nextItemTargetCandidate.v1",
  promptVersion: "v1",
  schemaVersion: "vision.nextItemTargetCandidate.schema.v1",
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
  targetCandidates: [{
    candidateId: "candidate_1",
    targetType: "next_item_target_candidate",
    coordinateSpace: "browser_viewport",
    boundingBox: { x: 320, y: 480, width: 56, height: 56 },
    clickPoint: { x: 348, y: 508 },
    confidence: 0.75,
    visibleText: null,
    evidenceObservations: ["lower circular downward next-item control visible on the right edge"],
    uncertainty: [],
  }],
  nonExecutableSummary: "当前截图中可见一个可能的下一项切换控件候选。",
  confidence: 0.75,
  evidenceObservations: ["describe only the visible candidate evidence"],
  reason: "one sentence explaining why the candidate matches the next item target",
  uncertainty: [],
  mustReview: false,
});

export const buildNextItemTargetCandidatePromptParts = (
  request: NextItemTargetCandidateRequest,
) => {
  const contract = VISION_NEXT_ITEM_TARGET_CANDIDATE_PROMPT_CONTRACT;
  const userPrompt = [
    "Every key in the required schema is mandatory.",
    "Return targetCandidates as a JSON array. Use an empty array when no governed candidate is visible.",
    "If no reliable next-item control is visible, return targetCandidates as [] instead of inventing placeholder coordinates.",
    "Never return product_yes/product_no, any retired branch token, review_required, or any executable instruction.",
    "confidence must be a JSON number from 0 to 1 based only on visible evidence.",
    "All coordinates must be finite numbers within the visible image bounds and clickPoint must land inside the candidate boundingBox.",
    "Never copy template placeholder numbers such as x=0, y=0, width=10, height=10, clickPoint=(5,5), or any tiny upper-left corner box unless the visible next-item affordance is actually there.",
    "Do not reuse the illustrative template coordinates verbatim; measure the actual visible control in the current screenshot.",
    `Return JSON matching this schema: ${JSON.stringify(contract.requiredOutputSchema)}`,
    `Return JSON structurally similar to this template: ${JSON.stringify(buildOutputTemplate(request))}`,
    `Task input: ${JSON.stringify(request.input)}`,
    `Forbidden outputs: ${contract.forbiddenOutputs.join("; ")}`,
  ].join("\n\n");

  return {
    systemPrompt: contract.prompt,
    userPrompt,
    fullPrompt: [contract.prompt, userPrompt].join("\n\n"),
  };
};