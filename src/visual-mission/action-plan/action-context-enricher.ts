import type { ScreenshotGridSpec } from "../../capabilities/screenshot/contract.js";
import { resolveScreenshotStructuredDataRefPayload } from "../../capabilities/screenshot/runtime/screenshot-structured-data-ref.js";
import type { AtomicMuscleMemoryEntry } from "../../muscle-memory/catalog/muscle-memory-catalog.schema.js";
import { resolveVisualMissionPlatformTarget } from "../platform-target-registry.js";
import type {
  VisualMissionExecutablePlan,
  VisualMissionExecutablePlanContextRefs,
} from "./executable-plan.schema.js";

type PayloadRefRecord = Record<string, unknown>;

export type VisualMissionActionRuntimeContext = {
  payloadRefs: PayloadRefRecord;
  planContextRefs: VisualMissionExecutablePlanContextRefs;
  platform: VisualMissionExecutablePlan["platform"];
  sourceAiResultRef: string | null;
};

type SystemFieldResolver = (input: {
  payloadRefs: PayloadRefRecord;
  planContextRefs: VisualMissionExecutablePlanContextRefs;
  platform: VisualMissionExecutablePlan["platform"];
  sourceAiResultRef: string | null;
}) => unknown;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readPayloadRefString = (payloadRefs: PayloadRefRecord, key: string): string | null =>
  readString(payloadRefs[key]);

const resolvePlatformBinding = (platform: VisualMissionExecutablePlan["platform"]) =>
  resolveVisualMissionPlatformTarget(platform);

const resolveGridSpec = (input: {
  payloadRefs: PayloadRefRecord;
  planContextRefs: VisualMissionExecutablePlanContextRefs;
}): ScreenshotGridSpec | null => {
  const directGridSpec = input.payloadRefs.gridSpec;
  if (isRecord(directGridSpec)) {
    return directGridSpec as ScreenshotGridSpec;
  }

  const gridSpecRef = readPayloadRefString(input.payloadRefs, "gridSpecRef") ?? input.planContextRefs.gridSpecRef;
  return resolveScreenshotStructuredDataRefPayload<ScreenshotGridSpec>(gridSpecRef);
};

const SYSTEM_FIELD_RESOLVERS: Record<string, SystemFieldResolver> = {
  requestedPlatformId: ({ payloadRefs, platform }) => (
    readPayloadRefString(payloadRefs, "requestedPlatformId") ?? platform
  ),
  targetUrl: ({ payloadRefs, platform }) => (
    readPayloadRefString(payloadRefs, "targetUrl") ?? resolvePlatformBinding(platform)?.targetUrl ?? null
  ),
  targetTitle: ({ payloadRefs, platform }) => (
    readPayloadRefString(payloadRefs, "targetTitle") ?? resolvePlatformBinding(platform)?.targetTitle ?? null
  ),
  targetProfileRef: ({ payloadRefs, platform }) => (
    readPayloadRefString(payloadRefs, "targetProfileRef") ?? resolvePlatformBinding(platform)?.targetProfileRef ?? null
  ),
  screenshotEvidenceRef: ({ payloadRefs, planContextRefs }) => (
    readPayloadRefString(payloadRefs, "screenshotEvidenceRef")
    ?? readPayloadRefString(payloadRefs, "originalScreenshotRef")
    ?? planContextRefs.originalScreenshotRef
    ?? planContextRefs.coordinateGridScreenshotRef
    ?? null
  ),
  productPresenceAiResultRef: ({ payloadRefs, planContextRefs, sourceAiResultRef }) => (
    readPayloadRefString(payloadRefs, "productPresenceAiResultRef")
    ?? readPayloadRefString(payloadRefs, "aiResultRef")
    ?? readPayloadRefString(payloadRefs, "sourceAiResultRef")
    ?? sourceAiResultRef
    ?? planContextRefs.aiResultRef
    ?? null
  ),
  gridSpec: ({ payloadRefs, planContextRefs }) => resolveGridSpec({ payloadRefs, planContextRefs }),
  gridSpecRef: ({ payloadRefs, planContextRefs }) => (
    readPayloadRefString(payloadRefs, "gridSpecRef") ?? planContextRefs.gridSpecRef ?? null
  ),
  pageStateRef: ({ payloadRefs }) => readPayloadRefString(payloadRefs, "pageStateRef"),
  coordinateSpace: ({ payloadRefs, planContextRefs }) => resolveGridSpec({ payloadRefs, planContextRefs })?.sourceCoordinateSpace ?? null,
};

export function buildVisualMissionActionRuntimeContext(input: {
  plan: VisualMissionExecutablePlan;
  payloadRefs?: PayloadRefRecord;
  sourceAiResultRef?: string | null;
}): VisualMissionActionRuntimeContext {
  return {
    payloadRefs: input.payloadRefs ?? {},
    planContextRefs: input.plan.contextRefs,
    platform: input.plan.platform,
    sourceAiResultRef: input.sourceAiResultRef ?? input.plan.contextRefs.aiResultRef ?? null,
  };
}

export function enrichVisualMissionActionInput(input: {
  entry: AtomicMuscleMemoryEntry;
  actionInput: Record<string, unknown>;
  runtimeContext: VisualMissionActionRuntimeContext;
}): Record<string, unknown> {
  const enrichedInput = { ...input.actionInput };
  const candidateFields = [...input.entry.inputContract.requiredFields, ...input.entry.inputContract.optionalFields];

  for (const field of candidateFields) {
    if (field in enrichedInput) {
      continue;
    }
    const resolver = SYSTEM_FIELD_RESOLVERS[field];
    if (!resolver) {
      continue;
    }
    const resolvedValue = resolver(input.runtimeContext);
    if (resolvedValue !== null && resolvedValue !== undefined) {
      enrichedInput[field] = resolvedValue;
    }
  }

  return enrichedInput;
}