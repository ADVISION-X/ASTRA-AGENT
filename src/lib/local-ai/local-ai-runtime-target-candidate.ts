import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import {
  VisionNextItemTargetCandidatePayloadSchema,
  type VisionNextItemTargetCandidate,
} from "../../types/vision-next-item-target-candidate.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { extractFirstJsonObject } from "./runtime-adapters/runtime-adapter-utils.js";
import { normalizeRuntimeOutput } from "./local-ai-runtime-target-candidate-normalization.js";

type JsonRecord = Record<string, unknown>;
type NextItemTargetCandidateRequest = Extract<LocalAiTaskRequest, { taskType: "vision.nextItemTargetCandidate" }>;

const parseRuntimeJsonOutput = (text: string): unknown => {
  const extractedJson = extractFirstJsonObject(text);
  try {
    return JSON.parse(extractedJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError("invalid_output", `Local AI returned invalid JSON for vision.nextItemTargetCandidate: ${message}`, text);
  }
};

export function parseNextItemTargetCandidateRuntimeOutput(
  text: string,
  request: NextItemTargetCandidateRequest,
) {
  const parsed = parseRuntimeJsonOutput(text);
  const normalized = normalizeRuntimeOutput(parsed, request);
  const payload = VisionNextItemTargetCandidatePayloadSchema.parse(normalized.normalized as JsonRecord);
  return {
    payload,
    adjusted: normalized.adjusted,
    normalizedCandidateCount: payload.targetCandidates.length,
  };
}
