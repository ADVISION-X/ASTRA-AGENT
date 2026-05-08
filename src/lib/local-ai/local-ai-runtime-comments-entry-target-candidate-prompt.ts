import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import { VISION_COMMENTS_ENTRY_TARGET_CANDIDATE_PROMPT_CONTRACT } from "./prompts/vision-comments-entry-target-candidate.v1.js";

type CommentsEntryTargetCandidateRequest = Extract<LocalAiTaskRequest, { taskType: "vision.commentsEntryTargetCandidate" }>;

export type CommentsEntryTargetCandidatePromptParts = {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
};

const buildOutputTemplate = (request: CommentsEntryTargetCandidateRequest) => ({
  taskType: "vision.commentsEntryTargetCandidate",
  promptId: "vision.commentsEntryTargetCandidate.v1",
  promptVersion: "v1",
  schemaVersion: "vision.commentsEntryTargetCandidate.schema.v1",
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
    targetType: "comments_button",
    coordinateSpace: "browser_viewport",
    boundingBox: { x: 0, y: 0, width: 10, height: 10 },
    clickPoint: { x: 5, y: 5 },
    confidence: 0.75,
    visibleText: null,
    evidenceObservations: ["describe the visible comments-entry affordance only"],
    uncertainty: [],
  }],
  nonExecutableSummary: "当前截图中可见一个可能的评论入口控件候选。",
  confidence: 0.75,
  evidenceObservations: ["describe only the visible candidate evidence"],
  reason: "one sentence explaining why the candidate matches the comments entry target",
  uncertainty: [],
  mustReview: false,
});

export const buildCommentsEntryTargetCandidatePromptParts = (
  request: CommentsEntryTargetCandidateRequest,
): CommentsEntryTargetCandidatePromptParts => {
  const contract = VISION_COMMENTS_ENTRY_TARGET_CANDIDATE_PROMPT_CONTRACT;
  const userPrompt = [
    "Every key in the required schema is mandatory.",
    "Return targetCandidates as a JSON array. Use an empty array when no governed candidate is visible.",
    "Never return routeLabel, review_required, or any executable instruction.",
    "confidence must be a JSON number from 0 to 1 based only on visible evidence.",
    "All coordinates must be finite numbers within the visible image bounds and clickPoint must land inside the candidate boundingBox.",
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