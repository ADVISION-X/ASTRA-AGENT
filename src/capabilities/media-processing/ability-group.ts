import { randomUUID } from "node:crypto";

import type {
  MediaProcessingAbilityGroup,
  MediaProcessingExecutionContext,
} from "./contract.js";
import {
  MEDIA_PROCESSING_ABILITY_GROUP_ID,
  MediaProcessingAbilityInputSchema,
  MediaProcessingPublicRequestSchema,
  type MediaProcessingAbilityInput,
  type MediaProcessingChildCapabilityId,
  type MediaProcessingPublicRequest,
  type MediaProcessingResult,
  type ParsedMediaProcessingAbilityInput,
} from "./schema.js";
import {
  createMediaProcessingCapabilityRegistry,
  listMediaProcessingChildren,
} from "./registry.js";
import { buildMediaProcessingFailure } from "./runtime/result.js";
import { ensureMediaProcessingLatestDependenciesForUse } from "./dependency-readiness.js";

const stringOrFallback = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

const buildRecoveryInput = (input: MediaProcessingAbilityInput): ParsedMediaProcessingAbilityInput => ({
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: "optimize-image-for-web-once",
  missionId: stringOrFallback(input.missionId, "unknown"),
  runId: stringOrFallback(input.runId, "unknown"),
  capabilityCallId: stringOrFallback(input.capabilityCallId, "unknown"),
  inputFilePath: stringOrFallback(input.inputFilePath, "unknown"),
  quality: 82,
  posterTimestampSeconds: 1,
  timeoutMs: 120_000,
  artifactDisposition: "deliverable",
  outputFormat: "webp",
});

const inputParseFailure = (
  request: MediaProcessingAbilityInput,
  context: MediaProcessingExecutionContext,
): Promise<MediaProcessingResult> => buildMediaProcessingFailure(
    {
      input: buildRecoveryInput(request),
      dataDir: context.dataDir,
      startedAt: new Date().toISOString(),
      inputByteSize: null,
    },
    "input_schema_invalid",
    "Media processing input schema is invalid.",
    "invalid_input",
  );

const buildUnknownChildFailure = (
  input: ParsedMediaProcessingAbilityInput,
  context: MediaProcessingExecutionContext,
): Promise<MediaProcessingResult> => buildMediaProcessingFailure(
    { input, dataDir: context.dataDir, startedAt: new Date().toISOString(), inputByteSize: null },
    "unknown_child_capability",
    "Media processing child capability is not registered.",
    "invalid_input",
  );

const buildDependencyLatestRefreshFailure = (
  input: ParsedMediaProcessingAbilityInput,
  context: MediaProcessingExecutionContext,
  reason: string | null,
): Promise<MediaProcessingResult> => buildMediaProcessingFailure(
    { input, dataDir: context.dataDir, startedAt: new Date().toISOString(), inputByteSize: null },
    "media_processing_dependency_latest_refresh_failed",
    reason ?? "Media processing dependencies must be refreshed to latest before processing can run.",
    "review_required",
  );

const buildPublicRequestBase = (
  parsed: ReturnType<typeof MediaProcessingPublicRequestSchema.parse>,
) => ({
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  missionId: parsed.missionId,
  runId: parsed.runId,
  capabilityCallId: `${parsed.runId}_${parsed.childCapabilityId}_${randomUUID()}`,
  inputFilePath: parsed.inputFilePath,
  ...(parsed.presetId ? { presetId: parsed.presetId } : {}),
  ...(parsed.quality ? { quality: parsed.quality } : {}),
  ...(parsed.maxWidth ? { maxWidth: parsed.maxWidth } : {}),
  ...(parsed.maxHeight ? { maxHeight: parsed.maxHeight } : {}),
  ...(parsed.targetWidth ? { targetWidth: parsed.targetWidth } : {}),
  ...(parsed.targetHeight ? { targetHeight: parsed.targetHeight } : {}),
  ...(parsed.variantWidths ? { variantWidths: parsed.variantWidths } : {}),
  ...(parsed.targetMaxBytes ? { targetMaxBytes: parsed.targetMaxBytes } : {}),
  ...(parsed.targetBitrateKbps ? { targetBitrateKbps: parsed.targetBitrateKbps } : {}),
  posterTimestampSeconds: parsed.posterTimestampSeconds ?? 1,
  timeoutMs: parsed.timeoutMs,
  artifactDisposition: parsed.artifactPolicy,
});

const buildPublicRequestInput = (input: MediaProcessingPublicRequest): MediaProcessingAbilityInput => {
  const parsed = MediaProcessingPublicRequestSchema.parse(input);
  const imageOutputFormat = parsed.outputFormat === "jpeg" || parsed.outputFormat === "png" || parsed.outputFormat === "webp"
    ? parsed.outputFormat
    : "webp";
  const base = buildPublicRequestBase(parsed);
  switch (parsed.childCapabilityId) {
    case "optimize-image-for-web-once":
      return { ...base, childCapabilityId: "optimize-image-for-web-once", outputFormat: imageOutputFormat };
    case "resize-image-for-web-once":
      return { ...base, childCapabilityId: "resize-image-for-web-once", outputFormat: imageOutputFormat };
    case "generate-responsive-image-variants-once":
      return { ...base, childCapabilityId: "generate-responsive-image-variants-once", outputFormat: imageOutputFormat };
    case "optimize-video-for-web-once":
      return { ...base, childCapabilityId: "optimize-video-for-web-once", outputFormat: "mp4" };
    case "compress-video-for-web-once":
      return { ...base, childCapabilityId: "compress-video-for-web-once", outputFormat: "mp4" };
    case "generate-video-poster-once":
      return { ...base, childCapabilityId: "generate-video-poster-once", outputFormat: imageOutputFormat };
  }
};

const executeMediaProcessingRequest = async (input: {
  request: MediaProcessingAbilityInput;
  context: MediaProcessingExecutionContext;
  registry: ReturnType<typeof createMediaProcessingCapabilityRegistry>;
}): Promise<MediaProcessingResult> => {
  const parsed = MediaProcessingAbilityInputSchema.safeParse(input.request);
  if (!parsed.success) {
    return inputParseFailure(input.request, input.context);
  }
  const child = input.registry.get(parsed.data.childCapabilityId);
  if (!child) {
    return buildUnknownChildFailure(parsed.data, input.context);
  }
  const dependencyRefresh = await ensureMediaProcessingLatestDependenciesForUse();
  if (dependencyRefresh.status === "failed") {
    return buildDependencyLatestRefreshFailure(parsed.data, input.context, dependencyRefresh.reason);
  }
  return child.execute(parsed.data, input.context);
};

export const createMediaProcessingAbilityGroup = (
  context: MediaProcessingExecutionContext,
): MediaProcessingAbilityGroup => {
  const registry = createMediaProcessingCapabilityRegistry();
  return {
    abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
    listChildCapabilityIds(): MediaProcessingChildCapabilityId[] {
      return listMediaProcessingChildren();
    },
    processMedia(input: MediaProcessingPublicRequest): Promise<MediaProcessingResult> {
      return executeMediaProcessingRequest({
        request: buildPublicRequestInput(input),
        context,
        registry,
      });
    },
    execute(input: MediaProcessingAbilityInput): Promise<MediaProcessingResult> {
      return executeMediaProcessingRequest({ request: input, context, registry });
    },
  };
};

export const createMediaProcessingAbilityGroupFromFilesystem = (input: {
  dataDir: string;
  runtimeLogger?: import("../../lib/runtime-logs/index.js").RuntimeLogger;
}): MediaProcessingAbilityGroup =>
  createMediaProcessingAbilityGroup({
    dataDir: input.dataDir,
    ...(input.runtimeLogger ? { runtimeLogger: input.runtimeLogger } : {}),
  });
