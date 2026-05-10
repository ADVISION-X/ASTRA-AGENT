import { parseCommentsEntryTargetCandidateRuntimeOutput } from "./local-ai-runtime-comments-entry-target-candidate.js";
import { parseNextItemTargetCandidateRuntimeOutput } from "./local-ai-runtime-target-candidate.js";
import { parseVisionRuntimeOutput } from "./local-ai-runtime-vision.js";
import { buildPromptPreview, type RuntimeExecutionInput } from "./local-ai-runtime-task-support.js";
import {
  buildNextItemParsedDecision,
  buildProductPresenceParsedDecision,
  buildVisionTaskResult,
} from "./local-ai-runtime-vision-task-result.js";

type VisionProductPresenceRequest = Extract<RuntimeExecutionInput["request"], { taskType: "vision.productPresence" }>;
type NextItemTargetCandidateRequest = Extract<RuntimeExecutionInput["request"], { taskType: "vision.nextItemTargetCandidate" }>;
type CommentsEntryTargetCandidateRequest = Extract<RuntimeExecutionInput["request"], { taskType: "vision.commentsEntryTargetCandidate" }>;

type SupportedVisionRequest = VisionProductPresenceRequest | NextItemTargetCandidateRequest | CommentsEntryTargetCandidateRequest;

export async function handleVisionTargetCandidateRuntimeTask(
  input: RuntimeExecutionInput,
  createdAt: string,
  request: NextItemTargetCandidateRequest | CommentsEntryTargetCandidateRequest,
  responseText: string,
) {
  const visionOutput = request.taskType === "vision.commentsEntryTargetCandidate"
    ? parseCommentsEntryTargetCandidateRuntimeOutput(responseText, request)
    : parseNextItemTargetCandidateRuntimeOutput(responseText, request);
  await input.debugHook?.({
    eventType: "local_ai_output_normalized",
    detail: `taskType=${request.taskType}; adjusted=${String(visionOutput.adjusted)}; normalizedTargetCandidates=${visionOutput.normalizedCandidateCount}`,
    taskType: request.taskType,
    rawResponsePreview: buildPromptPreview(responseText),
    rawResponseText: responseText,
    parsedJson: visionOutput.payload,
    parsedDecision: buildNextItemParsedDecision(visionOutput.payload),
  });
  const payload = visionOutput.payload;
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; confidence=${payload.confidence}; targetCandidates=${payload.targetCandidates.length}; reason=${buildPromptPreview(payload.reason)}`,
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: buildNextItemParsedDecision(payload),
  });
  return buildVisionTaskResult(input, createdAt, payload);
}

export async function handleVisionProductPresenceRuntimeTask(
  input: RuntimeExecutionInput,
  createdAt: string,
  request: VisionProductPresenceRequest,
  responseText: string,
) {
  const visionOutput = parseVisionRuntimeOutput(responseText, request);
  await input.debugHook?.({
    eventType: "local_ai_output_normalized",
    detail: `taskType=${request.taskType}; adjusted=${String(visionOutput.adjusted)}; normalizedFrameLevelObservations=${visionOutput.normalizedFrameCount}; ${visionOutput.normalizationSummary}`,
    taskType: request.taskType,
    rawResponsePreview: buildPromptPreview(responseText),
    rawResponseText: responseText,
    parsedJson: visionOutput.payload,
    parsedDecision: visionOutput.parsedDecision,
    parserErrors: visionOutput.parserIssues,
  });
  const payload = visionOutput.payload;
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; confidence=${payload.confidence}; isProductVideo=${String(payload.isProductVideo)}; taskDecision=${payload.taskDecision}; actions=${payload.actionPlan.actions.map((action) => action.actionCode).join(",")}; reason=${buildPromptPreview(payload.reason)}`,
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: visionOutput.parsedDecision,
    parserErrors: visionOutput.parserIssues,
  });
  return buildVisionTaskResult(input, createdAt, payload);
}
