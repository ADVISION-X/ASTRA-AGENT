import { randomUUID } from "node:crypto";

import {
  MEDIA_PROCESSING_ABILITY_GROUP_ID,
  MediaProcessingResultSchema,
  type MediaProcessingArtifact,
  type MediaProcessingResult,
  type ParsedMediaProcessingAbilityInput,
} from "../schema.js";
import { writeMediaProcessingProof } from "./artifact-storage.js";

type ResultBaseInput = {
  input: ParsedMediaProcessingAbilityInput;
  dataDir: string;
  startedAt: string;
  inputByteSize?: number | null;
  outputArtifacts?: readonly MediaProcessingArtifact[];
};

const elapsedMs = (startedAt: string, endedAt: string): number =>
  Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));

const proofId = (): string => `mp_proof_${randomUUID()}`;

const buildRuntimeProof = (
  base: ResultBaseInput,
  status: MediaProcessingResult["status"],
  failureReason: string | null,
  reviewRequiredReason: string | null,
  endedAt: string,
) => ({
  proofId: proofId(),
  missionId: base.input.missionId,
  runId: base.input.runId,
  capabilityCallId: base.input.capabilityCallId,
  abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
  childCapabilityId: base.input.childCapabilityId,
  status,
  failureReason,
  reviewRequiredReason,
  inputFilePath: base.input.inputFilePath,
  inputByteSize: base.inputByteSize ?? null,
  outputArtifacts: [...(base.outputArtifacts ?? [])],
  startedAt: base.startedAt,
  endedAt,
  durationMsTotal: elapsedMs(base.startedAt, endedAt),
});

export const buildMediaProcessingFailure = async (
  base: ResultBaseInput,
  errorCode: string,
  reason: string,
  status: "failed" | "review_required" | "invalid_input" = "failed",
): Promise<MediaProcessingResult> => {
  const endedAt = new Date().toISOString();
  const runtimeProof = buildRuntimeProof(
    base,
    status,
    status === "review_required" ? null : errorCode,
    status === "review_required" ? reason : null,
    endedAt,
  );
  await writeMediaProcessingProof(base.dataDir, base.input, runtimeProof);
  return MediaProcessingResultSchema.parse({
    abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
    childCapabilityId: base.input.childCapabilityId,
    status,
    failureReason: runtimeProof.failureReason,
    reviewRequiredReason: runtimeProof.reviewRequiredReason,
    output: {
      status,
      errorCode,
      reason,
      proofRef: runtimeProof.proofId,
    },
    runtimeProof,
  });
};

export const buildMediaProcessingSuccess = async (
  base: ResultBaseInput & { outputArtifacts: readonly MediaProcessingArtifact[] },
): Promise<MediaProcessingResult> => {
  const endedAt = new Date().toISOString();
  const runtimeProof = buildRuntimeProof(base, "success", null, null, endedAt);
  await writeMediaProcessingProof(base.dataDir, base.input, runtimeProof);
  return MediaProcessingResultSchema.parse({
    abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
    childCapabilityId: base.input.childCapabilityId,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    output: {
      status: "success",
      outputArtifacts: [...base.outputArtifacts],
      proofRef: runtimeProof.proofId,
    },
    runtimeProof,
  });
};
