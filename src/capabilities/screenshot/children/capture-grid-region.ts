import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import type { ArtifactStoragePort } from "../ports/artifact-storage-port.js";
import type {
  CaptureGridRegionInput,
  CaptureGridRegionResult,
} from "../schema-capture.js";
import { decodeGridCell, type ScreenshotGridSpec } from "../schema-grid.js";
import { cropImageRegion } from "../runtime/grid-renderer.js";
import { buildScreenshotProof } from "../runtime/proof.js";
import { resolveScreenshotStructuredDataRefPayload } from "../runtime/structured-ref-store.js";

type Ports = {
  artifactStorage: ArtifactStoragePort;
};

type CaptureTiming = {
  startedAt: string;
  startMs: number;
};

type CropBbox = { x: number; y: number; width: number; height: number };

function resolveCropBbox(input: CaptureGridRegionInput): CropBbox | null {
  if (input.bbox) return input.bbox;

  if (input.regionGridCell && input.gridSpecRef) {
    const gridSpec = resolveScreenshotStructuredDataRefPayload<ScreenshotGridSpec>(input.gridSpecRef);
    if (gridSpec) {
      const cell = decodeGridCell(gridSpec, input.regionGridCell);
      return { x: cell.x, y: cell.y, width: cell.width, height: cell.height };
    }
  }

  return null;
}

export async function captureGridRegion(
  input: CaptureGridRegionInput,
  ports: Ports,
): Promise<CaptureGridRegionResult> {
  const timing = startCaptureTiming();

  if (!existsSync(input.sourceScreenshotRef)) {
    const reason = `Source screenshot not found: ${input.sourceScreenshotRef}`;
    return buildCaptureGridFailure({ input, timing, failureReason: reason });
  }

  const bbox = resolveCropBbox(input);
  if (!bbox) {
    return buildCaptureGridFailure({
      input,
      timing,
      failureReason: "No bbox or resolvable regionGridCell provided",
    });
  }

  const artifactId = randomUUID();
  const cropResult = await tryCropRegion(input.sourceScreenshotRef, bbox);
  if (!cropResult.ok) {
    return buildCaptureGridFailure({
      input,
      timing,
      failureReason: `Crop failed: ${cropResult.reason}`,
    });
  }

  const artifactRef = await ports.artifactStorage.writeArtifact({
    sourceTempFilePath: cropResult.value.outputFilePath,
    artifactId,
    mimeType: cropResult.value.mimeType,
    createdAt: timing.startedAt,
  });

  return buildCaptureGridSuccess({ input, timing, artifactRef });
}

async function tryCropRegion(sourceScreenshotRef: string, bbox: CropBbox) {
  try {
    const value = await cropImageRegion({
      sourceFilePath: sourceScreenshotRef,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    });
    return { ok: true as const, value };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false as const, reason };
  }
}

function startCaptureTiming(): CaptureTiming {
  return { startedAt: new Date().toISOString(), startMs: Date.now() };
}

function buildCaptureGridFailure(params: {
  input: CaptureGridRegionInput;
  timing: CaptureTiming;
  failureReason: string;
}): CaptureGridRegionResult {
  const { endedAt, durationMs } = endCaptureTiming(params.timing);
  return {
    status: "failed",
    sourceScreenshotRef: params.input.sourceScreenshotRef,
    screenshotProof: buildScreenshotProof({
      ...captureProofIdentity(params.input),
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

function buildCaptureGridSuccess(params: {
  input: CaptureGridRegionInput;
  timing: CaptureTiming;
  artifactRef: Awaited<ReturnType<ArtifactStoragePort["writeArtifact"]>>;
}): CaptureGridRegionResult {
  const { endedAt, durationMs } = endCaptureTiming(params.timing);
  const artifactRef = params.artifactRef;
  return {
    status: "success",
    regionScreenshotRef: artifactRef.storageRef,
    regionArtifactRef: artifactRef,
    sourceScreenshotRef: params.input.sourceScreenshotRef,
    screenshotProof: buildScreenshotProof({
      ...captureProofIdentity(params.input),
      screenshotRef: artifactRef.storageRef,
      artifactRef: artifactRef.artifactId,
      capturePhaseMs: durationMs,
      artifactWritePhaseMs: 0,
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

function endCaptureTiming(timing: CaptureTiming) {
  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - timing.startMs;
  return { endedAt, durationMs };
}

function captureProofIdentity(input: CaptureGridRegionInput) {
  return {
    childCapabilityId: "capture-grid-region" as const,
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
