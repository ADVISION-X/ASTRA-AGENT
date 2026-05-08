import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import {
  VisionNextItemTargetCandidatePayloadSchema,
  type VisionNextItemTargetCandidate,
} from "../../types/vision-next-item-target-candidate.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { extractFirstJsonObject } from "./runtime-adapters/runtime-adapter-utils.js";

type JsonRecord = Record<string, unknown>;
type NextItemTargetCandidateRequest = Extract<LocalAiTaskRequest, { taskType: "vision.nextItemTargetCandidate" }>;

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeConfidence = (value: unknown, fallback: number) => {
  const candidate = toFiniteNumber(value);
  if (candidate === null) {
    return fallback;
  }
  return Math.min(Math.max(candidate, 0), 1);
};

const parseRuntimeJsonOutput = (text: string): unknown => {
  const extractedJson = extractFirstJsonObject(text);
  try {
    return JSON.parse(extractedJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError("invalid_output", `Local AI returned invalid JSON for vision.nextItemTargetCandidate: ${message}`, text);
  }
};

const normalizeCandidate = (entry: unknown, index: number): VisionNextItemTargetCandidate | null => {
  if (!isRecord(entry)) {
    return null;
  }

  const box = isRecord(entry.boundingBox) ? entry.boundingBox : null;
  const point = isRecord(entry.clickPoint) ? entry.clickPoint : null;
  const x = box ? toFiniteNumber(box.x) : null;
  const y = box ? toFiniteNumber(box.y) : null;
  const width = box ? toFiniteNumber(box.width) : null;
  const height = box ? toFiniteNumber(box.height) : null;
  const clickX = point ? toFiniteNumber(point.x) : null;
  const clickY = point ? toFiniteNumber(point.y) : null;

  if (x === null || y === null || width === null || height === null || clickX === null || clickY === null || width <= 0 || height <= 0) {
    return null;
  }

  const candidateId = typeof entry.candidateId === "string" && entry.candidateId.length > 0
    ? entry.candidateId
    : `candidate_${index + 1}`;
  const coordinateSpace = entry.coordinateSpace === "source_image" ? "source_image" : "browser_viewport";

  return {
    candidateId,
    targetType: "next_item_target_candidate",
    coordinateSpace,
    boundingBox: { x, y, width, height },
    clickPoint: { x: clickX, y: clickY },
    confidence: normalizeConfidence(entry.confidence, 0),
    visibleText: typeof entry.visibleText === "string" && entry.visibleText.length > 0 ? entry.visibleText : null,
    evidenceObservations: toStringArray(entry.evidenceObservations),
    uncertainty: toStringArray(entry.uncertainty),
  };
};

const normalizeRuntimeOutput = (value: unknown, request: NextItemTargetCandidateRequest) => {
  if (!isRecord(value)) {
    return { adjusted: false, normalized: value };
  }

  const rawCandidates = Array.isArray(value.targetCandidates) ? value.targetCandidates : [];
  const targetCandidates = rawCandidates
    .map((entry, index) => normalizeCandidate(entry, index))
    .filter((entry): entry is VisionNextItemTargetCandidate => entry !== null);
  const evidenceObservations = toStringArray(value.evidenceObservations);
  const confidence = normalizeConfidence(value.confidence, targetCandidates[0]?.confidence ?? 0);
  const defaultSummary = targetCandidates.length > 0
    ? `当前截图中识别到 ${targetCandidates.length} 个下一项候选目标。`
    : "当前截图中未识别到可治理的下一项候选目标。";
  const defaultReason = targetCandidates.length > 0
    ? "当前截图中存在可见的下一项切换候选目标。"
    : "当前截图中没有足够稳定的下一项切换候选证据。";

  return {
    adjusted: !Array.isArray(value.targetCandidates)
      || targetCandidates.length !== rawCandidates.length
      || value.taskType !== "vision.nextItemTargetCandidate"
      || value.promptId !== "vision.nextItemTargetCandidate.v1"
      || value.promptVersion !== "v1"
      || value.schemaVersion !== "vision.nextItemTargetCandidate.schema.v1",
    normalized: {
      ...value,
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
      targetCandidates,
      nonExecutableSummary:
        typeof value.nonExecutableSummary === "string" && value.nonExecutableSummary.length > 0 ? value.nonExecutableSummary : defaultSummary,
      confidence,
      evidenceObservations,
      reason: typeof value.reason === "string" && value.reason.length > 0 ? value.reason : defaultReason,
      uncertainty: toStringArray(value.uncertainty),
      mustReview: false,
    },
  };
};

export function parseNextItemTargetCandidateRuntimeOutput(
  text: string,
  request: NextItemTargetCandidateRequest,
) {
  const parsed = parseRuntimeJsonOutput(text);
  const normalized = normalizeRuntimeOutput(parsed, request);
  const payload = VisionNextItemTargetCandidatePayloadSchema.parse(normalized.normalized);
  return {
    payload,
    adjusted: normalized.adjusted,
    normalizedCandidateCount: payload.targetCandidates.length,
  };
}