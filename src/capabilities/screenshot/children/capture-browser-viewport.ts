import { randomUUID } from "node:crypto";
import type { BrowserCapturePort } from "../ports/browser-capture-port.js";
import type { ArtifactStoragePort } from "../ports/artifact-storage-port.js";
import type {
  CaptureBrowserViewportInput,
  CaptureBrowserViewportResult,
} from "../schema-capture.js";
import { buildScreenshotProof } from "../runtime/proof.js";

type Ports = {
  browserCapture: BrowserCapturePort;
  artifactStorage: ArtifactStoragePort;
};

type ViewportTiming = {
  startedAt: string;
  startMs: number;
};

export async function captureBrowserViewport(
  input: CaptureBrowserViewportInput,
  ports: Ports,
): Promise<CaptureBrowserViewportResult> {
  const timing = startViewportTiming();
  const artifactId = randomUUID();
  const captureStart = Date.now();
  const captureResult = await tryCaptureViewport(ports.browserCapture);
  if (!captureResult.ok) {
    return buildViewportFailure({
      input,
      timing,
      failureReason: `Browser capture failed: ${captureResult.reason}`,
    });
  }
  const capturePhaseMs = Date.now() - captureStart;
  const artifact = await tryWriteViewportArtifact({
    ports,
    timing,
    artifactId,
    captureResult: captureResult.value,
  });
  if (!artifact.ok) {
    return buildViewportFailure({
      input,
      timing,
      failureReason: `Artifact write failed: ${artifact.reason}`,
      capturePhaseMs,
    });
  }
  return buildViewportSuccess({
    input,
    timing,
    captureResult: captureResult.value,
    artifactRef: artifact.value.artifactRef,
    capturePhaseMs,
    artifactWritePhaseMs: artifact.value.artifactWritePhaseMs,
  });
}

function startViewportTiming(): ViewportTiming {
  return { startedAt: new Date().toISOString(), startMs: Date.now() };
}

async function tryCaptureViewport(browserCapture: BrowserCapturePort) {
  try {
    const value = await browserCapture.captureViewport();
    return { ok: true as const, value };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false as const, reason };
  }
}

async function tryWriteViewportArtifact(params: {
  ports: Ports;
  timing: ViewportTiming;
  artifactId: string;
  captureResult: Awaited<ReturnType<BrowserCapturePort["captureViewport"]>>;
}) {
  try {
    const artifactStart = Date.now();
    const value = await params.ports.artifactStorage.writeArtifact({
      sourceTempFilePath: params.captureResult.filePath,
      artifactId: params.artifactId,
      mimeType: params.captureResult.mimeType,
      createdAt: params.timing.startedAt,
    });
    const artifactWritePhaseMs = Date.now() - artifactStart;
    return { ok: true as const, value: { artifactRef: value, artifactWritePhaseMs } };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false as const, reason };
  }
}

function buildViewportSuccess(params: {
  input: CaptureBrowserViewportInput;
  timing: ViewportTiming;
  captureResult: Awaited<ReturnType<BrowserCapturePort["captureViewport"]>>;
  artifactRef: Awaited<ReturnType<ArtifactStoragePort["writeArtifact"]>>;
  capturePhaseMs: number;
  artifactWritePhaseMs: number;
}): CaptureBrowserViewportResult {
  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - params.timing.startMs;
  const artifactRef = params.artifactRef;
  const captureResult = params.captureResult;
  return {
    status: "success",
    screenshotRef: artifactRef.storageRef,
    aiReadableImagePath: artifactRef.storageRef,
    artifactRef,
    imageWidth: captureResult.width,
    imageHeight: captureResult.height,
    viewportWidth: captureResult.viewportWidth,
    viewportHeight: captureResult.viewportHeight,
    mimeType: captureResult.mimeType,
    screenshotProof: buildScreenshotProof({
      ...viewportProofIdentity(params.input),
      screenshotRef: artifactRef.storageRef,
      artifactRef: artifactRef.artifactId,
      capturePhaseMs: params.capturePhaseMs,
      artifactWritePhaseMs: params.artifactWritePhaseMs,
      totalScreenshotStepMs: durationMs,
      status: "success",
      startedAt: params.timing.startedAt,
      endedAt,
      durationMs,
    }),
    failureReason: null,
    reviewRequiredReason: null,
  };
}

function buildViewportFailure(params: {
  input: CaptureBrowserViewportInput;
  timing: ViewportTiming;
  failureReason: string;
  capturePhaseMs?: number;
}): CaptureBrowserViewportResult {
  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - params.timing.startMs;
  const phase = params.capturePhaseMs === undefined
    ? {}
    : { capturePhaseMs: params.capturePhaseMs };
  return {
    status: "failed",
    screenshotProof: buildScreenshotProof({
      ...viewportProofIdentity(params.input),
      ...phase,
      totalScreenshotStepMs: durationMs,
      status: "failed",
      failureReason: params.failureReason,
      startedAt: params.timing.startedAt,
      endedAt,
      durationMs,
    }),
    failureReason: params.failureReason,
    reviewRequiredReason: null,
  };
}

function viewportProofIdentity(input: CaptureBrowserViewportInput) {
  return {
    childCapabilityId: "capture-browser-viewport" as const,
    missionId: input.missionId,
    runId: input.runId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    stepId: input.stepId,
    capabilityCallId: input.capabilityCallId,
    nerveBusEnvelopeId: input.nerveBusEnvelopeId,
    inputRef: input.inputRef,
  };
}
