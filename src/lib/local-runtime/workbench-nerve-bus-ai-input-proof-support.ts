import { recordAiInputProofSummary, resolveAiInputProofSummary } from "../../capabilities/ai/index.js";
import { resolveAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";

import {
  payloadDocumentToObject,
  payloadValueToString,
} from "./workbench-payload.js";

type WorkbenchAiProofEnvelope = {
  aiInputRefs: string[];
};

type WorkbenchAiProofPayload = Parameters<typeof payloadDocumentToObject>[0] & {
  summary: string;
};

type WorkbenchAiInputProofFields = {
  aiInputArtifactRef: string;
  aiInputStorageRef: string;
  sourceScreenshotEvidenceId: string;
  sourceStorageRef: string;
  preparedImageHash: string;
  preparedImageWidth: number;
  preparedImageHeight: number;
  coordinateSpace: "ai_input_pixels";
};

const hasCompleteWorkbenchAiInputProofFields = (
  values: readonly [
    string | null,
    string | null,
    string | null,
    string | null,
    string | null,
    number | null,
    number | null,
    "ai_input_pixels" | null,
  ],
): values is readonly [string, string, string, string, string, number, number, "ai_input_pixels"] => values.every((value) => value !== null);

const resolveWorkbenchAiInputProofFields = (promptInputRef: string): WorkbenchAiInputProofFields | null => {
  const summary = resolveAbilityResultProofSummary(promptInputRef);
  const values = [
    payloadValueToString(summary?.aiInputArtifactRef),
    payloadValueToString(summary?.aiInputStorageRef) ?? payloadValueToString(summary?.artifactStorageRef),
    payloadValueToString(summary?.sourceScreenshotEvidenceId),
    payloadValueToString(summary?.sourceStorageRef),
    payloadValueToString(summary?.preparedImageHash),
    typeof summary?.preparedImageWidth === "number" ? summary.preparedImageWidth : null,
    typeof summary?.preparedImageHeight === "number" ? summary.preparedImageHeight : null,
    summary?.coordinateSpace === "ai_input_pixels" ? summary.coordinateSpace : null,
  ] as const;

  if (!hasCompleteWorkbenchAiInputProofFields(values)) {
    return null;
  }

  const [aiInputArtifactRef, aiInputStorageRef, sourceScreenshotEvidenceId, sourceStorageRef, preparedImageHash, preparedImageWidth, preparedImageHeight, coordinateSpace] = values;
  return {
    aiInputArtifactRef,
    aiInputStorageRef,
    sourceScreenshotEvidenceId,
    sourceStorageRef,
    preparedImageHash,
    preparedImageWidth,
    preparedImageHeight,
    coordinateSpace,
  };
};

function ensureSingleWorkbenchAiInputProof(promptInputRef: string): void {
  if (!promptInputRef || resolveAiInputProofSummary(promptInputRef)) {
    return;
  }

  const proofFields = resolveWorkbenchAiInputProofFields(promptInputRef);
  if (!proofFields) {
    return;
  }

  recordAiInputProofSummary({
    promptInputRef,
    ...proofFields,
  });
}

export function ensureWorkbenchAiInputProof(
  envelope: WorkbenchAiProofEnvelope,
  inputPayload: WorkbenchAiProofPayload,
): void {
  const payload = payloadDocumentToObject(inputPayload);
  const promptInputRef = payloadValueToString(payload.promptInputRef);
  const refs = [...envelope.aiInputRefs, promptInputRef].filter((ref): ref is string => typeof ref === "string" && ref.length > 0);

  for (const ref of new Set(refs)) {
    ensureSingleWorkbenchAiInputProof(ref);
  }
}

export function buildWorkbenchAiInputRefs(
  envelope: WorkbenchAiProofEnvelope,
  inputPayload: WorkbenchAiProofPayload,
) {
  return envelope.aiInputRefs.map((ref) => {
    const proof = resolveAiInputProofSummary(ref);
    return {
      id: ref,
      kind: "video-screenshot" as const,
      summary: inputPayload.summary,
      ...(proof?.aiInputStorageRef ? { filePath: proof.aiInputStorageRef } : {}),
    };
  });
}