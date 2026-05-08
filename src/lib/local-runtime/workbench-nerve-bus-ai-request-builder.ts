import type {
  AiRequestDispatchInput,
} from "../../capabilities/nerve-bus/contract.js";
import { recordAiInputProofSummary, resolveAiInputProofSummary } from "../../capabilities/ai/index.js";
import { resolveAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import { getDevelopmentMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";

import {
  payloadDocumentToObject,
  payloadValueToString,
} from "./workbench-payload.js";

type WorkbenchAiRequestEnvelope = AiRequestDispatchInput["envelope"];
type WorkbenchAiPayloadDocument = AiRequestDispatchInput["inputPayload"];
type WorkbenchAiExecuteInput = Parameters<import("./workbench-contract.js").WorkbenchRuntime["aiAbilityGroup"]["execute"]>[0];

const PAGE_PREPARATION_TASK_TYPE = "page_preparation_judgment";
const PRODUCT_PRESENCE_TASK_TYPE = "product_presence_judgment";
const SUPPORTED_WORKBENCH_AI_TASK_TYPES = [
  "page_preparation_judgment",
  "product_presence_judgment",
  "visual_observation",
  "visual_target_candidate_analysis",
  "ocr_cleanup",
  "comment_signal_summary",
  "product_signal_summary",
  "evidence_packet_analysis",
  "map_authoring",
  "schema_validation_only",
] as const;

type SupportedWorkbenchAiTaskType = (typeof SUPPORTED_WORKBENCH_AI_TASK_TYPES)[number];

const isSupportedWorkbenchAiTaskType = (taskType: string): taskType is SupportedWorkbenchAiTaskType =>
  SUPPORTED_WORKBENCH_AI_TASK_TYPES.some((candidate) => candidate === taskType);

const resolveAiTaskType = (envelope: WorkbenchAiRequestEnvelope): (typeof SUPPORTED_WORKBENCH_AI_TASK_TYPES)[number] => {
  const taskType = envelope.taskType;
  if (isSupportedWorkbenchAiTaskType(taskType)) {
    return taskType;
  }
  throw new Error(`Workbench AI request has unsupported taskType: ${taskType}`);
};

const buildWorkbenchAiInputRefs = (
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
) => envelope.aiInputRefs.map((ref) => {
  const proof = resolveAiInputProofSummary(ref);
  return {
    id: ref,
    kind: "video-screenshot" as const,
    summary: inputPayload.summary,
    ...(proof?.aiInputStorageRef ? { filePath: proof.aiInputStorageRef } : {}),
  };
});

const requireChainField = (value: string | null | undefined): string => {
  if (!value) {
    throw new Error("Workbench AI request is missing required active map chain fields.");
  }

  return value;
};

const buildDefaultAiInputPayload = (inputPayload: WorkbenchAiPayloadDocument) => {
  return payloadDocumentToObject(inputPayload);
};

const buildVisionImageCollectionInputPayload = (
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const preparedInputRef = payloadValueToString(payload.promptInputRef) ?? envelope.aiInputRefs[0] ?? null;
  const proof = resolveAiInputProofSummary(preparedInputRef) ?? null;
  const screenshotEvidenceId = proof?.sourceScreenshotEvidenceId ?? payloadValueToString(payload.screenshotEvidenceRef) ?? preparedInputRef;
  const aiInputRefs = envelope.aiInputRefs.length > 0 ? envelope.aiInputRefs : (preparedInputRef ? [preparedInputRef] : []);
  const inputMode = aiInputRefs.length > 1 ? "multi_image" : "single_frame_fallback";
  const samplingStrategy = aiInputRefs.length > 1 ? "route_plan_or_ability_owned_sampling" : "single_frame_fallback";
  const frameCount = Math.max(aiInputRefs.length, 1);

  return {
    inputMode,
    multiFrameEvidenceSetId: null,
    contactSheetEvidenceId: inputMode === "multi_image" ? null : preparedInputRef,
    frameEvidenceIds: inputMode === "multi_image" ? aiInputRefs : [],
    screenshotEvidenceId,
    screenshotRegion: null,
    sourceUrl: payloadValueToString(payload.targetUrl) ?? "workbench://local-runtime/product-presence",
    samplingStrategy,
    sampledFrameCount: frameCount,
    validFrameCount: aiInputRefs.length,
    expectedFrameCount: frameCount,
    fallbackReason: inputMode === "single_frame_fallback" ? "workbench_single_frame_dispatch" : null,
    missingFrames: [],
    summary: inputPayload.summary,
    tags: ["workbench", envelope.promptContractId],
  };
};

const buildSchemaValidationInputPayload = (
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
) => ({
  candidate: {
    diagnostic: true,
    status: "success",
    sourceSummary: inputPayload.summary,
    promptContractId: envelope.promptContractId,
    expectedOutputSchema: envelope.outputSchemaRef,
    inputRefs: envelope.aiInputRefs,
  },
  sourceRef: envelope.aiInputRefs[0] ?? inputPayload.documentRef,
  validationContextRef: `${envelope.envelopeId}:schema-validation-only`,
});

const buildWorkbenchAiInputPayload = (
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
) => {
  return envelope.taskType === "schema_validation_only"
    ? buildSchemaValidationInputPayload(envelope, inputPayload)
    : envelope.taskType === PAGE_PREPARATION_TASK_TYPE || envelope.taskType === PRODUCT_PRESENCE_TASK_TYPE
    ? buildVisionImageCollectionInputPayload(envelope, inputPayload)
    : buildDefaultAiInputPayload(inputPayload);
};

const resolveWorkbenchAiInputModality = (taskType: SupportedWorkbenchAiTaskType) =>
  taskType === "schema_validation_only" ? "structured_record" as const : "image_collection" as const;

const resolveWorkbenchAiProviderPolicy = (taskType: SupportedWorkbenchAiTaskType) =>
  taskType === "schema_validation_only"
    ? { requireLocalOnly: true, allowPaidProvider: false, providerAllowlist: ["internal-schema-validator"], operatorApprovalRef: null }
    : { requireLocalOnly: true, allowPaidProvider: false, providerAllowlist: ["local-vision-ai"], operatorApprovalRef: null };

const resolveWorkbenchAiQualityPolicy = (taskType: SupportedWorkbenchAiTaskType) =>
  taskType === PAGE_PREPARATION_TASK_TYPE || taskType === PRODUCT_PRESENCE_TASK_TYPE
    ? { minimumConfidence: null, requireSchemaValidation: true }
    : { minimumConfidence: 0.6, requireSchemaValidation: true };

const resolveWorkbenchAiSafetyPolicy = (taskType: SupportedWorkbenchAiTaskType) =>
  taskType === PAGE_PREPARATION_TASK_TYPE || taskType === PRODUCT_PRESENCE_TASK_TYPE
    ? { reviewOnLowConfidence: false, reviewOnSchemaFailure: true, reviewOnPolicyViolation: true }
    : { reviewOnLowConfidence: true, reviewOnSchemaFailure: true, reviewOnPolicyViolation: true };

const collectAiInputProofRefs = (
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
): string[] => {
  const payload = payloadDocumentToObject(inputPayload);
  return [
    ...envelope.aiInputRefs,
    payloadValueToString(payload.promptInputRef),
  ].filter((ref): ref is string => typeof ref === "string" && ref.length > 0);
};

function ensureSingleWorkbenchAiInputProof(promptInputRef: string): void {
  if (!promptInputRef || resolveAiInputProofSummary(promptInputRef)) {
    return;
  }

  const summary = resolveAbilityResultProofSummary(promptInputRef);
  const aiInputArtifactRef = payloadValueToString(summary?.aiInputArtifactRef);
  const aiInputStorageRef = payloadValueToString(summary?.aiInputStorageRef) ?? payloadValueToString(summary?.artifactStorageRef);
  const sourceScreenshotEvidenceId = payloadValueToString(summary?.sourceScreenshotEvidenceId);
  const sourceStorageRef = payloadValueToString(summary?.sourceStorageRef);
  const preparedImageHash = payloadValueToString(summary?.preparedImageHash);
  const preparedImageWidth = typeof summary?.preparedImageWidth === "number" ? summary.preparedImageWidth : null;
  const preparedImageHeight = typeof summary?.preparedImageHeight === "number" ? summary.preparedImageHeight : null;
  const coordinateSpace = summary?.coordinateSpace === "ai_input_pixels" ? summary.coordinateSpace : null;
  if (aiInputArtifactRef && aiInputStorageRef && sourceScreenshotEvidenceId && sourceStorageRef && preparedImageHash && preparedImageWidth && preparedImageHeight && coordinateSpace) {
    recordAiInputProofSummary({
      promptInputRef,
      aiInputArtifactRef,
      aiInputStorageRef,
      sourceScreenshotEvidenceId,
      sourceStorageRef,
      preparedImageHash,
      preparedImageWidth,
      preparedImageHeight,
      coordinateSpace,
    });
  }
}

function ensureWorkbenchAiInputProof(envelope: WorkbenchAiRequestEnvelope, inputPayload: WorkbenchAiPayloadDocument): void {
  for (const promptInputRef of new Set(collectAiInputProofRefs(envelope, inputPayload))) {
    ensureSingleWorkbenchAiInputProof(promptInputRef);
  }
}

export const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new Error(typeof signal.reason === "string" ? signal.reason : "Transport aborted before AI completion.");
  }
};

export const buildWorkbenchAiAbilityRequest = (
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
): WorkbenchAiExecuteInput => {
  const mapRecord = getDevelopmentMapPluginRegistry().active.getActiveOperationalMapRecord(envelope.mapId);
  const taskType = resolveAiTaskType(envelope);
  ensureWorkbenchAiInputProof(envelope, inputPayload);

  return {
    abilityGroupId: "ai" as const,
    missionId: envelope.missionId,
    taskType,
    inputModality: resolveWorkbenchAiInputModality(taskType),
    inputRefs: buildWorkbenchAiInputRefs(envelope, inputPayload),
    promptContractId: envelope.promptContractId,
    expectedOutputSchema: envelope.outputSchemaRef,
    requestedBy: "orchestration" as const,
    transportedBy: "nerve-bus" as const,
    sessionId: envelope.sessionId,
    runId: envelope.runId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    stepId: envelope.stepId,
    capabilityCallId: envelope.capabilityCallId,
    nerveBusEnvelopeId: envelope.envelopeId,
    mapPackageId: envelope.mapPackageId,
    mapPackageVersion: envelope.mapPackageVersion,
    selectedMapId: envelope.mapId,
    selectedMapVersion: envelope.selectedMapVersion,
    activationSnapshotRef: requireChainField(mapRecord?.activationSnapshotRef),
    promptCatalogVersion: requireChainField(mapRecord?.promptCatalogVersion),
    qualityPolicy: resolveWorkbenchAiQualityPolicy(taskType),
    providerPolicy: resolveWorkbenchAiProviderPolicy(taskType),
    costPolicy: { maxEstimatedCost: 0 },
    dataPolicy: { allowExternalTransmission: false, redactSensitiveData: true },
    safetyPolicy: resolveWorkbenchAiSafetyPolicy(taskType),
    input: buildWorkbenchAiInputPayload({ ...envelope, taskType }, inputPayload),
  };
};
