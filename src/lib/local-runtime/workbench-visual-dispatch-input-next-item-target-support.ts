import { createHash } from "node:crypto";

import type { AiVisualTargetCandidateOutputSummary } from "../../capabilities/ai/index.js";

type VisualTargetCandidate = AiVisualTargetCandidateOutputSummary["targetCandidates"] extends readonly (infer TCandidate)[]
  ? TCandidate
  : never;

type NextItemTargetCandidate = Extract<VisualTargetCandidate, { targetType: "next_item_target_candidate" }>;

const normalizeCandidateText = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

const NEXT_ITEM_DIRECTION_HINTS = [
  "next",
  "advance",
  "down",
  "downward",
  "lower",
  "bottom",
  "right",
  "forward",
  "next-item",
  "next item",
  "down-arrow",
  "down arrow",
  "bottom-right",
  "lower-right",
] as const;

const NOT_NEXT_ITEM_DIRECTION_HINTS = [
  "previous",
  "prev",
  "back",
  "up",
  "upward",
  "upper",
  "top",
  "left",
  "close",
  "dismiss",
] as const;

const buildHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const buildCompactRef = (prefix: string, value: unknown) =>
  `${prefix}:${buildHash(value).slice(0, 24)}`;

const countDirectionHints = (text: string, hints: readonly string[]) =>
  hints.reduce((count, hint) => (text.includes(hint) ? count + 1 : count), 0);

const buildNextItemCandidateSortScore = (candidate: {
  visibleText: string | null;
  evidenceObservations: readonly string[];
  uncertainty: readonly string[];
  clickPoint: { x: number; y: number };
  confidence: number;
}) => {
  const semanticText = normalizeCandidateText([
    candidate.visibleText,
    ...candidate.evidenceObservations,
    ...candidate.uncertainty,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" "));
  const positiveHintCount = countDirectionHints(semanticText, NEXT_ITEM_DIRECTION_HINTS);
  const negativeHintCount = countDirectionHints(semanticText, NOT_NEXT_ITEM_DIRECTION_HINTS);

  return {
    positiveHintCount,
    negativeHintCount,
    clickY: candidate.clickPoint.y,
    clickX: candidate.clickPoint.x,
    confidence: candidate.confidence,
  };
};

const sortNextItemCandidates = <TCandidate extends {
  visibleText: string | null;
  evidenceObservations: readonly string[];
  uncertainty: readonly string[];
  clickPoint: { x: number; y: number };
  confidence: number;
}>(candidates: readonly TCandidate[]) => [...candidates].sort((left, right) => {
  const leftScore = buildNextItemCandidateSortScore(left);
  const rightScore = buildNextItemCandidateSortScore(right);

  if (rightScore.positiveHintCount !== leftScore.positiveHintCount) {
    return rightScore.positiveHintCount - leftScore.positiveHintCount;
  }

  if (leftScore.negativeHintCount !== rightScore.negativeHintCount) {
    return leftScore.negativeHintCount - rightScore.negativeHintCount;
  }

  if (rightScore.clickY !== leftScore.clickY) {
    return rightScore.clickY - leftScore.clickY;
  }

  if (rightScore.clickX !== leftScore.clickX) {
    return rightScore.clickX - leftScore.clickX;
  }

  return rightScore.confidence - leftScore.confidence;
});

const readSummaryString = (summary: Record<string, unknown> | null, key: string): string | null => {
  const value = summary?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const readSummaryNumber = (summary: Record<string, unknown> | null, key: string): number | null => {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const mapPreparedInputCoordinateSpace = (value: string | null) => {
  if (value === "desktop_screen_pixels") {
    return "desktop_screen" as const;
  }
  return value === "browser_viewport_pixels"
    ? "browser_viewport" as const
    : value === "source_image_pixels"
      ? "source_image" as const
      : null;
};

export const buildAiInputScaleMapping = (summary: Record<string, unknown> | null) => {
  const sourceCoordinateSpace = mapPreparedInputCoordinateSpace(
    readSummaryString(summary, "preparedInputSourceCoordinateSpace"),
  );
  const targetCoordinateSpace = readSummaryString(summary, "preparedInputTargetCoordinateSpace");
  const sourceScreenshotEvidenceId = readSummaryString(summary, "sourceScreenshotEvidenceId");
  const sourceWidth = readSummaryNumber(summary, "preparedInputSourceWidth");
  const sourceHeight = readSummaryNumber(summary, "preparedInputSourceHeight");
  const targetWidth = readSummaryNumber(summary, "preparedInputTargetWidth");
  const targetHeight = readSummaryNumber(summary, "preparedInputTargetHeight");
  const cropOffsetX = readSummaryNumber(summary, "preparedInputCropOffsetX");
  const cropOffsetY = readSummaryNumber(summary, "preparedInputCropOffsetY");

  if (
    !sourceCoordinateSpace
    || targetCoordinateSpace !== "ai_input_pixels"
    || !sourceScreenshotEvidenceId
    || sourceWidth === null
    || sourceHeight === null
    || targetWidth === null
    || targetHeight === null
    || cropOffsetX === null
    || cropOffsetY === null
  ) {
    return null;
  }

  return {
    sourceScreenshotEvidenceId,
    sourceCoordinateSpace,
    targetCoordinateSpace: "ai_input" as const,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    cropOffsetX,
    cropOffsetY,
    scaleX: sourceWidth / targetWidth,
    scaleY: sourceHeight / targetHeight,
  };
};

const clampToRange = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const clampCandidateToBounds = (input: {
  candidate: NextItemTargetCandidate;
  boundsWidth: number;
  boundsHeight: number;
}) => {
  const maxX = Math.max(input.boundsWidth - 1, 0);
  const maxY = Math.max(input.boundsHeight - 1, 0);
  const x = clampToRange(input.candidate.boundingBox.x, 0, maxX);
  const y = clampToRange(input.candidate.boundingBox.y, 0, maxY);
  const width = clampToRange(input.candidate.boundingBox.width, 1, Math.max(input.boundsWidth - x, 1));
  const height = clampToRange(input.candidate.boundingBox.height, 1, Math.max(input.boundsHeight - y, 1));
  const clickPoint = {
    x: clampToRange(input.candidate.clickPoint.x, x, x + width),
    y: clampToRange(input.candidate.clickPoint.y, y, y + height),
  };

  return {
    ...input.candidate,
    boundingBox: {
      x,
      y,
      width,
      height,
    },
    clickPoint,
  };
};

const isNextItemTargetCandidate = (candidate: VisualTargetCandidate): candidate is NextItemTargetCandidate =>
  candidate.targetType === "next_item_target_candidate";

export const buildNextItemVisualCandidates = (input: {
  governedAiResultRef: string;
  capturedAt: string;
  sourceFrameRef: string;
  sourceProofRef: string;
  imageWidth: number;
  imageHeight: number;
  aiInputScaleMapping: ReturnType<typeof buildAiInputScaleMapping>;
  targetCandidates: AiVisualTargetCandidateOutputSummary["targetCandidates"];
}) => sortNextItemCandidates(input.targetCandidates.filter(isNextItemTargetCandidate)).map((candidate) => {
  const boundedCandidate = clampCandidateToBounds({
    candidate,
    boundsWidth: input.aiInputScaleMapping?.targetWidth ?? input.imageWidth,
    boundsHeight: input.aiInputScaleMapping?.targetHeight ?? input.imageHeight,
  });

  return {
    candidateRef: buildCompactRef("visual-target-candidate", [input.governedAiResultRef, candidate.candidateId, "next-item"]),
    candidateKind: "ai_candidate",
    targetType: "next_item_target_candidate",
    boundingBox: boundedCandidate.boundingBox,
    clickPoint: boundedCandidate.clickPoint,
    confidence: candidate.confidence,
    coordinateSpace: input.aiInputScaleMapping ? "ai_input" : candidate.coordinateSpace,
    sourceProofRef: input.sourceProofRef,
    capturedAt: input.capturedAt,
    sourceFrameRef: input.sourceFrameRef,
    detectionMethod: "ai_visual_target_candidate_analysis",
    visibleText: candidate.visibleText,
    uncertainty: candidate.uncertainty,
    blockedReason: null,
    isVisible: true,
    scaleMapping: input.aiInputScaleMapping,
    dataQualityFlags: [],
  };
});