import { randomUUID } from "node:crypto";
import type { ScreenshotProof } from "../schema.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../schema.js";

type ProofInput = {
  childCapabilityId: ScreenshotProof["childCapabilityId"];
  missionId: string;
  runId: string;
  sessionId?: string | null;
  roundId?: string | null;
  stepId: string;
  capabilityCallId: string;
  nerveBusEnvelopeId: string;
  inputRef: string;
  screenshotRef?: string | null;
  artifactRef?: string | null;
  coordinateGridScreenshotRef?: string | null;
  gridSpecRef?: string | null;
  capturePhaseMs?: number | null;
  gridRenderPhaseMs?: number | null;
  artifactWritePhaseMs?: number | null;
  totalScreenshotStepMs: number;
  status: ScreenshotProof["status"];
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export function buildScreenshotProof(input: ProofInput): ScreenshotProof {
  return {
    proofId: randomUUID(),
    abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    missionId: input.missionId,
    runId: input.runId,
    sessionId: input.sessionId ?? null,
    roundId: input.roundId ?? null,
    stepId: input.stepId,
    capabilityCallId: input.capabilityCallId,
    nerveBusEnvelopeId: input.nerveBusEnvelopeId,
    inputRef: input.inputRef,
    screenshotRef: input.screenshotRef ?? null,
    artifactRef: input.artifactRef ?? null,
    coordinateGridScreenshotRef: input.coordinateGridScreenshotRef ?? null,
    gridSpecRef: input.gridSpecRef ?? null,
    capturePhaseMs: input.capturePhaseMs ?? null,
    gridRenderPhaseMs: input.gridRenderPhaseMs ?? null,
    artifactWritePhaseMs: input.artifactWritePhaseMs ?? null,
    totalScreenshotStepMs: input.totalScreenshotStepMs,
    status: input.status,
    failureReason: input.failureReason ?? null,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
  };
}
