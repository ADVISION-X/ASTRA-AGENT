import type { ScreenshotAbilityInput } from "../contract.js";

type ScreenshotChainSnapshot = {
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string;
  capabilityCallId: string;
  nerveBusEnvelopeId: string;
};

const resolveScreenshotChain = (request: ScreenshotAbilityInput): ScreenshotChainSnapshot => ({
  missionId: request.missionId,
  runId: request.runId,
  sessionId: request.sessionId,
  roundId: request.roundId,
  videoVisitId: request.videoVisitId,
  stepId: request.stepId,
  capabilityCallId: request.capabilityCallId,
  nerveBusEnvelopeId: request.nerveBusEnvelopeId,
});

const resolveScreenshotTimeoutMs = (
  request: ScreenshotAbilityInput,
  fallbackTimeoutMs: number,
): number => request.timeoutMs ?? request.capturePolicy.maxDurationMs ?? fallbackTimeoutMs;

export { resolveScreenshotChain, resolveScreenshotTimeoutMs };