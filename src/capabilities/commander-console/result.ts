/**
 * Commander Console Result Builders
 *
 * Proof only certifies: human command accepted/rejected + envelope emitted or not.
 * No orchestration, AI, browser/action, or forensics proof here.
 */

import { randomUUID } from "node:crypto";
import {
  CommanderProofSchema,
  CommanderConsoleResultSchema,
  type CommanderStatus,
  type CommanderChildCapabilityId,
} from "./schema.js";

type BuildProofInput = {
  childCapabilityId: CommanderChildCapabilityId;
  commandId: string;
  commandType: string;
  operatorRef: string;
  missionId: string | null;
  status: CommanderStatus;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  envelopeId: string | null;
  startedAt: string;
  endedAt: string;
};

export const buildCommanderProof = (input: BuildProofInput) =>
  CommanderProofSchema.parse({
    proofId: randomUUID(),
    abilityGroupId: "commander-console" as const,
    childCapabilityId: input.childCapabilityId,
    commandId: input.commandId,
    commandType: input.commandType,
    operatorRef: input.operatorRef,
    missionId: input.missionId,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    envelopeId: input.envelopeId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(0, new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()),
  });

export const buildCommanderSuccessResult = (output: unknown, proof: ReturnType<typeof buildCommanderProof>) =>
  CommanderConsoleResultSchema.parse({
    status: "success",
    output,
    runtimeProof: proof,
    failureReason: null,
    reviewRequiredReason: null,
  });

export const buildCommanderFailureResult = (
  failureReason: string,
  proof: ReturnType<typeof buildCommanderProof> | null,
) =>
  CommanderConsoleResultSchema.parse({
    status: "failed",
    output: null,
    runtimeProof: proof,
    failureReason,
    reviewRequiredReason: null,
  });

const buildCommanderReviewRequiredResult = (
  reviewRequiredReason: string,
  proof: ReturnType<typeof buildCommanderProof> | null,
) =>
  CommanderConsoleResultSchema.parse({
    status: "review_required",
    output: null,
    runtimeProof: proof,
    failureReason: null,
    reviewRequiredReason,
  });
