import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import {
  VisionCommentsEntryTargetCandidatePayloadSchema,
  type VisionCommentsEntryTargetCandidate,
} from "../../types/vision-comments-entry-target-candidate.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { extractFirstJsonObject } from "./runtime-adapters/runtime-adapter-utils.js";

type JsonRecord = Record<string, unknown>;
type CommentsEntryTargetCandidateRequest = Extract<LocalAiTaskRequest, { taskType: "vision.commentsEntryTargetCandidate" }>;

type CommentsEntryTargetCandidateGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  clickX: number;
  clickY: number;
};

type CommentsEntryTargetCandidateContext = {
  rawCandidates: unknown[];
  targetCandidates: VisionCommentsEntryTargetCandidate[];
  evidenceObservations: string[];
  confidence: number;
  defaultSummary: string;
  defaultReason: string;
};

type CommentsEntryTargetCandidateBox = Pick<CommentsEntryTargetCandidateGeometry, "x" | "y" | "width" | "height">;
type CommentsEntryTargetCandidatePoint = Pick<CommentsEntryTargetCandidateGeometry, "clickX" | "clickY">;

const hasCompleteCandidateBox = (
  values: readonly [number | null, number | null, number | null, number | null],
): values is readonly [number, number, number, number] => values.every((value) => value !== null);

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
    throw new LocalAiRuntimeError("invalid_output", `Local AI returned invalid JSON for vision.commentsEntryTargetCandidate: ${message}`, text);
  }
};

const resolveCandidateBox = (entry: JsonRecord): CommentsEntryTargetCandidateBox | null => {
  const box = isRecord(entry.boundingBox) ? entry.boundingBox : null;
  if (!box) {
    return null;
  }

  const values = [
    toFiniteNumber(box.x),
    toFiniteNumber(box.y),
    toFiniteNumber(box.width),
    toFiniteNumber(box.height),
  ] as const;

  if (!hasCompleteCandidateBox(values)) {
    return null;
  }

  const [x, y, width, height] = values;
  return width <= 0 || height <= 0 ? null : { x, y, width, height };
};

const resolveCandidatePoint = (entry: JsonRecord): CommentsEntryTargetCandidatePoint | null => {
  const point = isRecord(entry.clickPoint) ? entry.clickPoint : null;
  const clickX = point ? toFiniteNumber(point.x) : null;
  const clickY = point ? toFiniteNumber(point.y) : null;

  return clickX === null || clickY === null ? null : { clickX, clickY };
};

const resolveCandidateGeometry = (entry: JsonRecord): CommentsEntryTargetCandidateGeometry | null => {
  const box = resolveCandidateBox(entry);
  const point = resolveCandidatePoint(entry);
  return box && point ? { ...box, ...point } : null;
};

const normalizeCandidate = (entry: unknown, index: number): VisionCommentsEntryTargetCandidate | null => {
  if (!isRecord(entry)) {
    return null;
  }

  const geometry = resolveCandidateGeometry(entry);
  if (geometry === null) {
    return null;
  }

  const candidateId = typeof entry.candidateId === "string" && entry.candidateId.length > 0
    ? entry.candidateId
    : `candidate_${index + 1}`;
  const coordinateSpace = entry.coordinateSpace === "source_image" ? "source_image" : "browser_viewport";

  return {
    candidateId,
    targetType: "comments_button",
    coordinateSpace,
    boundingBox: { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height },
    clickPoint: { x: geometry.clickX, y: geometry.clickY },
    confidence: normalizeConfidence(entry.confidence, 0),
    visibleText: typeof entry.visibleText === "string" && entry.visibleText.length > 0 ? entry.visibleText : null,
    evidenceObservations: toStringArray(entry.evidenceObservations),
    uncertainty: toStringArray(entry.uncertainty),
  };
};

const resolveCommentsEntryRuntimeContext = (value: JsonRecord): CommentsEntryTargetCandidateContext => {
  const rawCandidates = Array.isArray(value.targetCandidates) ? value.targetCandidates : [];
  const targetCandidates = rawCandidates
    .map((entry, index) => normalizeCandidate(entry, index))
    .filter((entry): entry is VisionCommentsEntryTargetCandidate => entry !== null);
  const evidenceObservations = toStringArray(value.evidenceObservations);
  const confidence = normalizeConfidence(value.confidence, targetCandidates[0]?.confidence ?? 0);

  return {
    rawCandidates,
    targetCandidates,
    evidenceObservations,
    confidence,
    defaultSummary: targetCandidates.length > 0
      ? `当前截图中识别到 ${targetCandidates.length} 个评论入口候选目标。`
      : "当前截图中未识别到可治理的评论入口候选目标。",
    defaultReason: targetCandidates.length > 0
      ? "当前截图中存在可见的评论入口候选目标。"
      : "当前截图中没有足够稳定的评论入口候选证据。",
  };
};

const buildCommentsEntryNormalizedOutput = (
  value: JsonRecord,
  request: CommentsEntryTargetCandidateRequest,
  context: CommentsEntryTargetCandidateContext,
) => ({
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
  targetCandidates: context.targetCandidates,
  nonExecutableSummary: typeof value.nonExecutableSummary === "string" && value.nonExecutableSummary.length > 0
    ? value.nonExecutableSummary
    : context.defaultSummary,
  confidence: context.confidence,
  evidenceObservations: context.evidenceObservations,
  reason: typeof value.reason === "string" && value.reason.length > 0 ? value.reason : context.defaultReason,
  uncertainty: toStringArray(value.uncertainty),
  mustReview: false,
});

const hasCommentsEntryContractDrift = (value: JsonRecord, context: CommentsEntryTargetCandidateContext): boolean =>
  !Array.isArray(value.targetCandidates)
  || context.targetCandidates.length !== context.rawCandidates.length
  || value.taskType !== "vision.commentsEntryTargetCandidate"
  || value.promptId !== "vision.commentsEntryTargetCandidate.v1"
  || value.promptVersion !== "v1"
  || value.schemaVersion !== "vision.commentsEntryTargetCandidate.schema.v1";

const normalizeRuntimeOutput = (value: unknown, request: CommentsEntryTargetCandidateRequest) => {
  if (!isRecord(value)) {
    return { adjusted: false, normalized: value };
  }

  const context = resolveCommentsEntryRuntimeContext(value);

  return {
    adjusted: hasCommentsEntryContractDrift(value, context),
    normalized: buildCommentsEntryNormalizedOutput(value, request, context),
  };
};

export function parseCommentsEntryTargetCandidateRuntimeOutput(
  text: string,
  request: CommentsEntryTargetCandidateRequest,
) {
  const parsed = parseRuntimeJsonOutput(text);
  const normalized = normalizeRuntimeOutput(parsed, request);
  const payload = VisionCommentsEntryTargetCandidatePayloadSchema.parse(normalized.normalized);
  return {
    payload,
    adjusted: normalized.adjusted,
    normalizedCandidateCount: payload.targetCandidates.length,
  };
}