import { StructuredRuntimeEventSchema, type StructuredRuntimeEvent } from "../../types/structured-log.js";
import type { WorkbenchAiDebugEvent } from "./workbench-ai-debug-support.js";

const AI_DEBUG_DURABLE_ENV = "GRASSEYE_AI_DEBUG_DURABLE";

const DURABLE_COMMANDER_DEBUG_EVENT_TYPES = new Set([
  "MISSION_ACTIVATION_SNAPSHOT_FROZEN",
]);

const DEFAULT_DURABLE_AI_DEBUG_EVENT_TYPES = new Set<WorkbenchAiDebugEvent["eventType"]>([
  "AI_RESPONSE_DEBUG",
  "AI_ERROR_DEBUG",
  "AI_INPUT_DEBUG_REJECTED",
]);

export const isAiDebugDurableEnabled = (): boolean => process.env[AI_DEBUG_DURABLE_ENV] === "1";

export const shouldDurablyPersistCommanderDebugEvent = (eventType: string): boolean => DURABLE_COMMANDER_DEBUG_EVENT_TYPES.has(eventType);

export const shouldDurablyPersistAiDebugEvent = (eventType: WorkbenchAiDebugEvent["eventType"]): boolean => (
  isAiDebugDurableEnabled() || DEFAULT_DURABLE_AI_DEBUG_EVENT_TYPES.has(eventType)
);

export const buildAiDebugDurableRuntimeEvent = (
  entry: StructuredRuntimeEvent,
): StructuredRuntimeEvent => {
  if (isAiDebugDurableEnabled()) {
    return entry;
  }

  return StructuredRuntimeEventSchema.parse({
    ...entry,
    providerConfigRef: null,
    secretRef: null,
    promptDebugRef: null,
    systemPromptHash: null,
    userPromptHash: null,
    promptPreview: null,
    promptDebugBundleRef: null,
    providerRequestBodyRedacted: null,
    providerRequestDebugRef: null,
    rawResponsePreview: null,
    rawResponseHash: null,
    rawResponseRef: null,
    sourceScreenshotEvidenceId: null,
    aiInputArtifactRef: null,
    imageInputs: [],
    tokenEstimate: null,
    refs: [],
    inputRefs: [],
    outputRefs: [],
    evidenceRefs: [],
    proofRefs: [],
    artifactRefs: [],
    actionLogRefs: [],
    dataQualityFlags: [],
    parserErrors: [],
  });
};