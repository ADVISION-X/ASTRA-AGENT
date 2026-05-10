import {
  CommentsEntryTargetCandidateTaskResultSchema,
  NextItemTargetCandidateTaskResultSchema,
  VisionTaskResultSchema,
} from "../../types/local-ai.js";
import type { RuntimeExecutionInput } from "./local-ai-runtime-task-support.js";

type VisionTaskPayload = unknown;

type VisionTaskRequest = RuntimeExecutionInput["request"];

const resolveTaskResultConfidence = (payload: VisionTaskPayload, fallback: number): number => {
  if (typeof payload === "object" && payload !== null && typeof (payload as { confidence?: unknown }).confidence === "number") {
    return (payload as { confidence: number }).confidence;
  }
  return fallback;
};

const buildTaskResultBase = (input: RuntimeExecutionInput, createdAt: string, payload: VisionTaskPayload, confidence: number) => ({
  id: input.request.id,
  taskType: input.request.taskType,
  modelRole: input.request.modelRole,
  provider: "local" as const,
  runtime: input.roleConfig.runtime,
  model: input.roleConfig.model,
  implementationStatus: "model_backed" as const,
  promptVersion: input.request.promptVersion,
  schemaVersion: input.request.schemaVersion,
  evidenceRefs: input.request.evidenceRefs,
  confidence,
  createdAt,
  result: payload,
});

const buildNextItemTargetCandidateTaskResult = (
  input: RuntimeExecutionInput,
  createdAt: string,
  payload: VisionTaskPayload,
) => NextItemTargetCandidateTaskResultSchema.parse({
  ...buildTaskResultBase(input, createdAt, payload, resolveTaskResultConfidence(payload, 0)),
});

const buildCommentsEntryTargetCandidateTaskResult = (
  input: RuntimeExecutionInput,
  createdAt: string,
  payload: VisionTaskPayload,
) => CommentsEntryTargetCandidateTaskResultSchema.parse({
  ...buildTaskResultBase(input, createdAt, payload, resolveTaskResultConfidence(payload, 0)),
});

const buildVisionProductPresenceTaskResult = (
  input: RuntimeExecutionInput,
  createdAt: string,
  payload: VisionTaskPayload,
) => VisionTaskResultSchema.parse({
  ...buildTaskResultBase(input, createdAt, payload, resolveTaskResultConfidence(payload, (payload as { confidence?: number }).confidence ?? 0)),
});

export const buildVisionTaskResult = (
  input: RuntimeExecutionInput,
  createdAt: string,
  payload: VisionTaskPayload,
) => {
  if (input.request.taskType === "vision.nextItemTargetCandidate") {
    return buildNextItemTargetCandidateTaskResult(input, createdAt, payload);
  }

  if (input.request.taskType === "vision.commentsEntryTargetCandidate") {
    return buildCommentsEntryTargetCandidateTaskResult(input, createdAt, payload);
  }

  return buildVisionProductPresenceTaskResult(input, createdAt, payload);
};

export const buildNextItemParsedDecision = (payload: { targetCandidates: unknown[] }) => `target_candidates:${payload.targetCandidates.length}`;

export const buildProductPresenceParsedDecision = (payload: { taskDecision: string; actionPlan: { actions: unknown[] } }) => `${payload.taskDecision}|actions:${payload.actionPlan.actions.length}`;
