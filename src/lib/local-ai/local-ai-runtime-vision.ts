import { z } from "zod";

import type { LocalAiTaskRequest } from "../../types/local-ai.js";
import type { VideoFrameSamplePointLabel } from "../../types/multi-frame-evidence.js";
import { VisionProductPresencePayloadSchema } from "../../types/vision-product-presence.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { extractFirstJsonObject } from "./runtime-adapters/runtime-adapter-utils.js";
import { resolveExpectedFrameLabels } from "./local-ai-runtime-vision-prompt.js";

type JsonRecord = Record<string, unknown>;
type VisionProductPresenceRequest = Extract<LocalAiTaskRequest, { taskType: "vision.productPresence" }>;
type VisionFrameObservation = z.infer<typeof VisionProductPresencePayloadSchema>[
  "frameLevelObservations"
][number];

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

const isExpectedFrameLabel = (
  value: string,
  expectedFrameLabels: VideoFrameSamplePointLabel[],
): value is VideoFrameSamplePointLabel => expectedFrameLabels.includes(value as VideoFrameSamplePointLabel);

const normalizeNullableBoolean = (value: unknown): boolean | null | undefined => {
  if (typeof value === "boolean" || value === null) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  if (normalized === "null") {
    return null;
  }

  return undefined;
};

const parseRuntimeJsonOutput = (text: string, taskType: string): unknown => {
  const extractedJson = extractFirstJsonObject(text);
  try {
    return JSON.parse(extractedJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError("invalid_output", `Local AI returned invalid JSON for ${taskType}: ${message}`, text);
  }
};

const createFallbackFrameObservation = (
  input: {
    expectedFrameLabels: VideoFrameSamplePointLabel[];
    evidenceObservations: string[];
    isProductVideo: boolean | null;
    visibleProductTypes: string[];
  },
): VisionFrameObservation => ({
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

const normalizeFrameObservation = (
  entry: unknown,
  index: number,
  expectedFrameLabels: VideoFrameSamplePointLabel[],
  fallbackObservation: VisionFrameObservation,
): { adjusted: boolean; observation: VisionFrameObservation } => {
  if (!isRecord(entry)) {
    return {
      adjusted: true,
      observation: {
        ...fallbackObservation,
        frameLabel: expectedFrameLabels[index] ?? fallbackObservation.frameLabel,
      },
    };
  }

  const rawFrameLabel = typeof entry.frameLabel === "string" ? entry.frameLabel : null;
  const normalizedFrameLabel = rawFrameLabel && isExpectedFrameLabel(rawFrameLabel, expectedFrameLabels)
    ? rawFrameLabel
    : (expectedFrameLabels[index] ?? fallbackObservation.frameLabel);
  const normalizedEntryHasVisibleProduct = normalizeNullableBoolean(entry.hasVisibleProduct);
  const hasVisibleProduct = normalizedEntryHasVisibleProduct === undefined
    ? fallbackObservation.hasVisibleProduct
    : normalizedEntryHasVisibleProduct;
  const visibleProductTypes = toStringArray(entry.visibleProductTypes);
  const observations = toStringArray(entry.observations);
  const adjusted = normalizedFrameLabel !== rawFrameLabel
    || hasVisibleProduct !== entry.hasVisibleProduct
    || hasEntryCollectionAdjustment(entry, visibleProductTypes, observations);

  return {
    adjusted,
    observation: {
      frameLabel: normalizedFrameLabel,
      hasVisibleProduct,
      visibleProductTypes,
      observations,
    },
  };
};

const normalizeFrameObservations = (
  request: VisionProductPresenceRequest,
  value: JsonRecord,
  expectedFrameLabels: VideoFrameSamplePointLabel[],
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

const normalizeVisionRuntimeOutput = (
  value: unknown,
  request: VisionProductPresenceRequest,
): { adjusted: boolean; normalized: unknown } => {
  if (!isRecord(value)) {
    return { adjusted: false, normalized: value };
  }

  const expectedFrameLabels = resolveExpectedFrameLabels(request);
  const visibleProductTypes = toStringArray(value.visibleProductTypes);
  const evidenceObservations = toStringArray(value.evidenceObservations);
  const normalizedRootIsProductVideo = normalizeNullableBoolean(value.isProductVideo);
  const isProductVideo = normalizedRootIsProductVideo === undefined ? null : normalizedRootIsProductVideo;
  const fallbackObservation = createFallbackFrameObservation({
    expectedFrameLabels,
    evidenceObservations,
    isProductVideo,
    visibleProductTypes,
  });
  const normalizedFrameObservations = normalizeFrameObservations(
    request,
    value,
    expectedFrameLabels,
    fallbackObservation,
  );

  return {
    adjusted: normalizedRootIsProductVideo !== value.isProductVideo || normalizedFrameObservations.adjusted,
    normalized: {
      ...value,
      isProductVideo,
      frameLevelObservations: normalizedFrameObservations.observations,
    },
  };
};

export const parseVisionRuntimeOutput = (text: string, request: VisionProductPresenceRequest): {
  adjusted: boolean;
  normalizedFrameCount: number;
  payload: z.infer<typeof VisionProductPresencePayloadSchema>;
} => {
  const parsed = parseRuntimeJsonOutput(text, request.taskType);
  const normalizedOutput = normalizeVisionRuntimeOutput(parsed, request);

  try {
    const payload = VisionProductPresencePayloadSchema.parse(normalizedOutput.normalized);
    return {
      adjusted: normalizedOutput.adjusted,
      normalizedFrameCount: payload.frameLevelObservations.length,
      payload,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError(
      "invalid_output",
      `Local AI output failed schema validation for ${request.taskType}: ${message}`,
      extractFirstJsonObject(text),
    );
  }
};