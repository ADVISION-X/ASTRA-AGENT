import { AI_ABILITY_GROUP_ID, type AiAbilityInput, type AiChildCapabilityId } from "../../capabilities/ai/contract.js";
import type { ForensicsPersistenceAbilityResult, ForensicsRecordRef, ForensicsRecordType } from "../../capabilities/forensics-persistence/index.js";
import type { ImageEvidenceInput } from "../storage/evidence-store/evidence-store-artifacts.js";
import type { EvidenceRef, ImageEvidence } from "../../types/evidence.js";

export function buildImageEvidenceInput(input: {
  kind: ImageEvidenceInput["kind"];
  taskRunId: string;
  roundId: string;
  platformId: string;
  sourceId: string;
  sourceUrl: string;
  regionLabel: string;
  regionType: string;
  summary: string;
  width: number;
  height: number;
  contentLines?: string[] | undefined;
  sourceFilePath?: string | undefined;
}): ImageEvidenceInput {
  return {
    kind: input.kind,
    taskRunId: input.taskRunId,
    roundId: input.roundId,
    platformId: input.platformId,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    regionLabel: input.regionLabel,
    regionType: input.regionType,
    summary: input.summary,
    width: input.width,
    height: input.height,
    ...(input.contentLines ? { contentLines: input.contentLines } : {}),
    ...(input.sourceFilePath ? { sourceFilePath: input.sourceFilePath } : {}),
  };
}

export function createForensicsRecordRef(input: {
  recordType: ForensicsRecordType;
  recordId: string;
  storageRef?: string | null;
}): ForensicsRecordRef {
  return {
    recordType: input.recordType,
    recordId: input.recordId,
    storageRef: input.storageRef ?? null,
  };
}

export function materializeImageEvidenceRecord(input: {
  imageEvidenceInput: ImageEvidenceInput;
  persistedResult: ForensicsPersistenceAbilityResult;
}): ImageEvidence {
  return {
    id: input.persistedResult.recordRef.recordId,
    taskRunId: input.imageEvidenceInput.taskRunId,
    roundId: input.imageEvidenceInput.roundId,
    platformId: input.imageEvidenceInput.platformId,
    sourceId: input.imageEvidenceInput.sourceId,
    sourceUrl: input.imageEvidenceInput.sourceUrl,
    kind: input.imageEvidenceInput.kind,
    summary: input.imageEvidenceInput.summary,
    filePath: input.persistedResult.storageRef ?? input.persistedResult.recordRef.storageRef ?? "",
    regionLabel: input.imageEvidenceInput.regionLabel,
    regionType: input.imageEvidenceInput.regionType,
    width: input.imageEvidenceInput.width,
    height: input.imageEvidenceInput.height,
    createdAt: input.persistedResult.runtimeProof.endedAt,
  };
}

function createBaseAiInput(input: {
  taskRunId: string;
  roundId: string;
  videoVisitId: string | null;
  evidenceRefs: EvidenceRef[];
  promptContractId: string;
  expectedOutputSchema: string;
  childCapabilityId: AiChildCapabilityId;
}): Omit<AiAbilityInput, "taskType" | "inputModality" | "input"> {
  return {
    abilityGroupId: AI_ABILITY_GROUP_ID,
    inputRefs: input.evidenceRefs,
    promptContractId: input.promptContractId,
    expectedOutputSchema: input.expectedOutputSchema,
    requestedBy: "orchestration",
    transportedBy: "nerve-bus",
    sessionId: input.taskRunId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    qualityPolicy: { minimumConfidence: 0.6, requireSchemaValidation: true },
    providerPolicy: {
      requireLocalOnly: true,
      allowPaidProvider: false,
      providerAllowlist: [input.childCapabilityId],
      operatorApprovalRef: null,
    },
    costPolicy: { maxEstimatedCost: 0 },
    dataPolicy: { allowExternalTransmission: false, redactSensitiveData: true },
    safetyPolicy: {
      reviewOnLowConfidence: true,
      reviewOnSchemaFailure: true,
      reviewOnPolicyViolation: true,
    },
  };
}

export function buildVisionProductPresenceRequest(input: {
  taskRunId: string;
  roundId: string;
  videoVisitId?: string | null;
  evidenceRefs: EvidenceRef[];
  videoEvidenceId: string;
  screenshotRegion: string;
  sourceUrl: string;
  summary: string;
  tags: string[];
  fallbackReason: string;
  missingFrames: Array<{ frameLabel: "frame_6s" | "frame_10s"; unavailableReason: string }>;
}): AiAbilityInput {
  return {
    ...createBaseAiInput({
      taskRunId: input.taskRunId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId ?? null,
      evidenceRefs: input.evidenceRefs,
      promptContractId: "vision.productPresence.v1",
      expectedOutputSchema: "ai.product_presence_judgment.v1",
      childCapabilityId: "local-vision-ai",
    }),
    taskType: "product_presence_judgment",
    inputModality: "image_collection",
    input: {
      inputMode: "single_frame_fallback",
      multiFrameEvidenceSetId: null,
      contactSheetEvidenceId: null,
      frameEvidenceIds: [input.videoEvidenceId],
      screenshotEvidenceId: input.videoEvidenceId,
      screenshotRegion: input.screenshotRegion,
      sourceUrl: input.sourceUrl,
      samplingStrategy: "single_frame_fallback",
      sampledFrameCount: 1,
      validFrameCount: 1,
      expectedFrameCount: 3,
      fallbackReason: input.fallbackReason,
      missingFrames: input.missingFrames,
      summary: input.summary,
      tags: input.tags,
    },
  };
}

export function buildOcrCleanupRequest(input: { taskRunId: string; roundId: string; videoVisitId?: string | null; evidenceRefs: EvidenceRef[]; rawCommentBlocks: string[] }): AiAbilityInput {
  return {
    ...createBaseAiInput({
      taskRunId: input.taskRunId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId ?? null,
      evidenceRefs: input.evidenceRefs,
      promptContractId: "comments.ocr_cleanup.v1",
      expectedOutputSchema: "ai.ocr_cleanup.v1",
      childCapabilityId: "local-ocr-ai",
    }),
    taskType: "ocr_cleanup",
    inputModality: "text_blocks",
    input: { rawCommentBlocks: input.rawCommentBlocks },
  };
}

export function buildCommentIntentRequest(input: { taskRunId: string; roundId: string; videoVisitId?: string | null; evidenceRefs: EvidenceRef[]; cleanedComments: string[] }): AiAbilityInput {
  return {
    ...createBaseAiInput({
      taskRunId: input.taskRunId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId ?? null,
      evidenceRefs: input.evidenceRefs,
      promptContractId: "comments.intent_analysis.v1",
      expectedOutputSchema: "ai.comment_signal_summary.v1",
      childCapabilityId: "local-text-ai",
    }),
    taskType: "comment_signal_summary",
    inputModality: "text_blocks",
    input: { cleanedComments: input.cleanedComments.length > 0 ? input.cleanedComments : ["uncertain comment text"] },
  };
}
