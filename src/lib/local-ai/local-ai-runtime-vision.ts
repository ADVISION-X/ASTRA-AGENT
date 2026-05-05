import { z } from "zod";

import {
  LocalAiVisionProductPresencePayloadSchema,
  type LocalAiVisionFrameSamplePointLabel,
  type LocalAiVisionTaskRequest,
} from "../../types/local-ai-runtime-vision-contract.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { extractFirstJsonObject } from "./runtime-adapters/runtime-adapter-utils.js";
import { resolveExpectedFrameLabels } from "./local-ai-runtime-vision-prompt.js";

type JsonRecord = Record<string, unknown>;
type VisionProductPresenceRequest = Extract<LocalAiVisionTaskRequest, { taskType: "vision.productPresence" }>;
type VisionFrameObservation = z.infer<typeof LocalAiVisionProductPresencePayloadSchema>[
  "frameLevelObservations"
][number];

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

const NULLABLE_BOOLEAN_BY_TEXT = {
  true: true,
  false: false,
  null: null,
} as const;

const isExpectedFrameLabel = (
  value: string,
  expectedFrameLabels: LocalAiVisionFrameSamplePointLabel[],
): value is LocalAiVisionFrameSamplePointLabel => expectedFrameLabels.includes(value as LocalAiVisionFrameSamplePointLabel);

const normalizeNullableBoolean = (value: unknown): boolean | null | undefined => {
  if (typeof value === "boolean" || value === null) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized in NULLABLE_BOOLEAN_BY_TEXT
    ? NULLABLE_BOOLEAN_BY_TEXT[normalized as keyof typeof NULLABLE_BOOLEAN_BY_TEXT]
    : undefined;
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
    expectedFrameLabels: LocalAiVisionFrameSamplePointLabel[];
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
  expectedFrameLabels: LocalAiVisionFrameSamplePointLabel[],
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

const normalizeProductDecision = (value: JsonRecord, isProductVideo: boolean | null) => {
  const rawDecision = typeof value.decision === "string" ? value.decision : null;
  if (rawDecision === "product_yes" || rawDecision === "product_no" || rawDecision === "product_uncertain") {
    return rawDecision;
  }
  if (isProductVideo === true) {
    return "product_yes";
  }
  if (isProductVideo === false) {
    return "product_no";
  }
  return "product_uncertain";
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
  const decision = normalizeProductDecision(value, isProductVideo);
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
    adjusted: normalizedRootIsProductVideo !== value.isProductVideo || decision !== value.decision || normalizedFrameObservations.adjusted,
    normalized: {
      ...value,
      isProductVideo,
      decision,
      frameLevelObservations: normalizedFrameObservations.observations,
    },
  };
};

export const parseVisionRuntimeOutput = (text: string, request: VisionProductPresenceRequest): {
  adjusted: boolean;
  normalizedFrameCount: number;
  payload: z.infer<typeof LocalAiVisionProductPresencePayloadSchema>;
} => {
  const parsed = parseRuntimeJsonOutput(text, request.taskType);
  const normalizedOutput = normalizeVisionRuntimeOutput(parsed, request);

  try {
    const payload = LocalAiVisionProductPresencePayloadSchema.parse(normalizedOutput.normalized);
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
