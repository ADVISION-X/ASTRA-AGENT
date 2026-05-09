import { z } from "zod";

import {
  LocalAiVisionProductPresencePayloadSchema,
  type LocalAiVisionFrameSamplePointLabel,
  type LocalAiVisionTaskRequest,
} from "../../types/local-ai-runtime-vision-contract.js";
import { resolveExpectedFrameLabels } from "./local-ai-runtime-vision-prompt.js";
import {
  buildVisionRuntimeNormalizedOutput,
  isVisionRuntimeOutputAdjusted,
} from "./local-ai-runtime-vision-normalization-output.js";
import {
  resolveVisionRuntimeDecisionState,
  type VisionRuntimeDecisionState,
} from "./local-ai-runtime-vision-normalization-decision.js";

type JsonRecord = Record<string, unknown>;
type VisionProductPresenceRequest = Extract<LocalAiVisionTaskRequest, { taskType: "vision.productPresence" }>;
type VisionFrameObservation = z.infer<typeof LocalAiVisionProductPresencePayloadSchema>["frameLevelObservations"][number];

type VisionRuntimeFrameState = {
  fallbackObservation: VisionFrameObservation;
  normalizedFrameObservations: { adjusted: boolean; observations: VisionFrameObservation[] };
};

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

const createFallbackFrameObservation = (input: {
  expectedFrameLabels: LocalAiVisionFrameSamplePointLabel[];
  evidenceObservations: string[];
  isProductVideo: boolean | null;
  visibleProductTypes: string[];
}): VisionFrameObservation => ({
  frameLabel: input.expectedFrameLabels[0] ?? "adaptive_first",
  hasVisibleProduct: input.isProductVideo,
  visibleProductTypes: input.visibleProductTypes,
  observations: input.evidenceObservations.slice(0, 1),
});

const hasEntryCollectionAdjustment = (
  entry: JsonRecord,
  visibleProductTypes: string[],
  observations: string[],
): boolean => {
  const visibleTypeCount = Array.isArray(entry.visibleProductTypes) ? entry.visibleProductTypes.length : 0;
  if (visibleProductTypes.length !== visibleTypeCount) {
    return true;
  }

  const observationCount = Array.isArray(entry.observations) ? entry.observations.length : 0;
  return observations.length !== observationCount;
};

type ResolvedFrameObservation = {
  rawFrameLabel: string | null;
  observation: VisionFrameObservation;
};

const resolveNormalizedFrameObservation = (
  entry: unknown,
  index: number,
  expectedFrameLabels: LocalAiVisionFrameSamplePointLabel[],
  fallbackObservation: VisionFrameObservation,
): ResolvedFrameObservation => {
  if (!isRecord(entry)) {
    return {
      rawFrameLabel: null,
      observation: {
        ...fallbackObservation,
        frameLabel: expectedFrameLabels[index] ?? fallbackObservation.frameLabel,
      },
    };
  }

  const rawFrameLabel = typeof entry.frameLabel === "string" ? entry.frameLabel : null;
  const frameLabel = rawFrameLabel && expectedFrameLabels.includes(rawFrameLabel as LocalAiVisionFrameSamplePointLabel)
    ? rawFrameLabel
    : (expectedFrameLabels[index] ?? fallbackObservation.frameLabel);
  const hasVisibleProduct = typeof entry.hasVisibleProduct === "boolean" || entry.hasVisibleProduct === null
    ? entry.hasVisibleProduct
    : fallbackObservation.hasVisibleProduct;

  return {
    rawFrameLabel,
    observation: {
      frameLabel,
      hasVisibleProduct,
      visibleProductTypes: toStringArray(entry.visibleProductTypes),
      observations: toStringArray(entry.observations),
    },
  };
};

const normalizeFrameObservation = (
  entry: unknown,
  index: number,
  expectedFrameLabels: LocalAiVisionFrameSamplePointLabel[],
  fallbackObservation: VisionFrameObservation,
): { adjusted: boolean; observation: VisionFrameObservation } => {
  const resolved = resolveNormalizedFrameObservation(entry, index, expectedFrameLabels, fallbackObservation);
  if (!isRecord(entry)) {
    return { adjusted: true, observation: resolved.observation };
  }

  const adjusted = resolved.observation.frameLabel !== resolved.rawFrameLabel
    || resolved.observation.hasVisibleProduct !== entry.hasVisibleProduct
    || hasEntryCollectionAdjustment(entry, resolved.observation.visibleProductTypes, resolved.observation.observations);

  return {
    adjusted,
    observation: resolved.observation,
  };
};

const normalizeFrameObservations = (
  request: VisionProductPresenceRequest,
  value: JsonRecord,
  expectedFrameLabels: LocalAiVisionFrameSamplePointLabel[],
  fallbackObservation: VisionFrameObservation,
): { adjusted: boolean; observations: VisionFrameObservation[] } => {
  const incomingFrameObservations = Array.isArray(value.frameLevelObservations) ? value.frameLevelObservations : [];
  if (incomingFrameObservations.length === 0) {
    return {
      adjusted: !Array.isArray(value.frameLevelObservations) && request.input.validFrameCount > 0,
      observations: request.input.validFrameCount > 0 ? [fallbackObservation] : [],
    };
  }

  let adjusted = false;
  const observations = incomingFrameObservations.map((entry, index) => {
    const normalizedEntry = normalizeFrameObservation(entry, index, expectedFrameLabels, fallbackObservation);
    adjusted = adjusted || normalizedEntry.adjusted;
    return normalizedEntry.observation;
  });

  return { adjusted, observations };
};

const resolveVisionRuntimeFrameState = (
  request: VisionProductPresenceRequest,
  value: JsonRecord,
  expectedFrameLabels: LocalAiVisionFrameSamplePointLabel[],
  decisionState: VisionRuntimeDecisionState,
): VisionRuntimeFrameState => {
  const fallbackObservation = createFallbackFrameObservation({
    expectedFrameLabels,
    evidenceObservations: decisionState.evidenceObservations,
    isProductVideo: decisionState.isProductVideo,
    visibleProductTypes: decisionState.visibleProductTypes,
  });

  return {
    fallbackObservation,
    normalizedFrameObservations: normalizeFrameObservations(
      request,
      value,
      expectedFrameLabels,
      fallbackObservation,
    ),
  };
};

export const normalizeVisionRuntimeOutput = (
  value: unknown,
  request: VisionProductPresenceRequest,
): { adjusted: boolean; normalized: unknown } => {
  if (!isRecord(value)) {
    return { adjusted: false, normalized: value };
  }

  const expectedFrameLabels = resolveExpectedFrameLabels(request);
  const decisionState = resolveVisionRuntimeDecisionState(value);
  const frameState = resolveVisionRuntimeFrameState(request, value, expectedFrameLabels, decisionState);

  return {
    adjusted: isVisionRuntimeOutputAdjusted(value, decisionState, frameState),
    normalized: buildVisionRuntimeNormalizedOutput(value, decisionState, frameState),
  };
};
