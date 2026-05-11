import { randomUUID } from "node:crypto";
import type { BrowserCapturePort } from "../ports/browser-capture-port.js";
import type { ArtifactStoragePort } from "../ports/artifact-storage-port.js";
import type { CaptureBrowserViewportInput, CaptureBrowserViewportResult } from "../schema.js";
import { buildScreenshotProof } from "../runtime/proof.js";

type Ports = {
  browserCapture: BrowserCapturePort;
  artifactStorage: ArtifactStoragePort;
};

export async function captureBrowserViewport(
  input: CaptureBrowserViewportInput,
  ports: Ports,
): Promise<CaptureBrowserViewportResult> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const artifactId = randomUUID();

  let captureResult: Awaited<ReturnType<BrowserCapturePort["captureViewport"]>>;
  const captureStart = Date.now();
  try {
    captureResult = await ports.browserCapture.captureViewport();
  } catch (err) {
    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;
    const reason = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      screenshotProof: buildScreenshotProof({
        childCapabilityId: "capture-browser-viewport",
        missionId: input.missionId,
        runId: input.runId,
        sessionId: input.sessionId,
        roundId: input.roundId,
        stepId: input.stepId,
        capabilityCallId: input.capabilityCallId,
        nerveBusEnvelopeId: input.nerveBusEnvelopeId,
        inputRef: input.inputRef,
        totalScreenshotStepMs: durationMs,
        status: "failed",
        failureReason: `Browser capture failed: ${reason}`,
        startedAt,
        endedAt,
        durationMs,
      }),
      failureReason: `Browser capture failed: ${reason}`,
      reviewRequiredReason: null,
    };
  }
  const capturePhaseMs = Date.now() - captureStart;

  const artifactStart = Date.now();
  let artifactRef: Awaited<ReturnType<ArtifactStoragePort["writeArtifact"]>>;
  try {
    artifactRef = await ports.artifactStorage.writeArtifact({
      sourceTempFilePath: captureResult.filePath,
      artifactId,
      mimeType: captureResult.mimeType,
      createdAt: startedAt,
    });
  } catch (err) {
    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;
    const reason = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      screenshotProof: buildScreenshotProof({
        childCapabilityId: "capture-browser-viewport",
        missionId: input.missionId,
        runId: input.runId,
        sessionId: input.sessionId,
        roundId: input.roundId,
        stepId: input.stepId,
        capabilityCallId: input.capabilityCallId,
        nerveBusEnvelopeId: input.nerveBusEnvelopeId,
        inputRef: input.inputRef,
        capturePhaseMs,
        totalScreenshotStepMs: durationMs,
        status: "failed",
        failureReason: `Artifact write failed: ${reason}`,
        startedAt,
        endedAt,
        durationMs,
      }),
      failureReason: `Artifact write failed: ${reason}`,
      reviewRequiredReason: null,
    };
  }
  const artifactWritePhaseMs = Date.now() - artifactStart;

  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  return {
    status: "success",
    screenshotRef: artifactRef.storageRef,
    artifactRef,
    imageWidth: captureResult.width,
    imageHeight: captureResult.height,
    viewportWidth: captureResult.viewportWidth,
    viewportHeight: captureResult.viewportHeight,
    mimeType: captureResult.mimeType,
    screenshotProof: buildScreenshotProof({
      childCapabilityId: "capture-browser-viewport",
      missionId: input.missionId,
      runId: input.runId,
      sessionId: input.sessionId,
      roundId: input.roundId,
      stepId: input.stepId,
      capabilityCallId: input.capabilityCallId,
      nerveBusEnvelopeId: input.nerveBusEnvelopeId,
      inputRef: input.inputRef,
      screenshotRef: artifactRef.storageRef,
      artifactRef: artifactRef.artifactId,
      capturePhaseMs,
      artifactWritePhaseMs,
      totalScreenshotStepMs: durationMs,
      status: "success",
      startedAt,
      endedAt,
      durationMs,
    }),
    failureReason: null,
    reviewRequiredReason: null,
  };
}
