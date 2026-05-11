import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import type { ArtifactStoragePort } from "../ports/artifact-storage-port.js";
import type { CaptureGridRegionInput, CaptureGridRegionResult } from "../schema.js";
import { decodeGridCell, type ScreenshotGridSpec } from "../schema.js";
import { cropImageRegion } from "../runtime/grid-renderer.js";
import { buildScreenshotProof } from "../runtime/proof.js";
import { resolveScreenshotStructuredDataRefPayload } from "../runtime/structured-ref-store.js";

type Ports = {
  artifactStorage: ArtifactStoragePort;
};

function resolveCropBbox(input: CaptureGridRegionInput): { x: number; y: number; width: number; height: number } | null {
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
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  if (!existsSync(input.sourceScreenshotRef)) {
    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;
    return {
      status: "failed",
      sourceScreenshotRef: input.sourceScreenshotRef,
      screenshotProof: buildScreenshotProof({
        childCapabilityId: "capture-grid-region",
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
        failureReason: `Source screenshot not found: ${input.sourceScreenshotRef}`,
        startedAt,
        endedAt,
        durationMs,
      }),
      failureReason: `Source screenshot not found: ${input.sourceScreenshotRef}`,
      reviewRequiredReason: null,
    };
  }

  const bbox = resolveCropBbox(input);
  if (!bbox) {
    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;
    return {
      status: "failed",
      screenshotProof: buildScreenshotProof({
        childCapabilityId: "capture-grid-region",
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
        failureReason: "No bbox or resolvable regionGridCell provided",
        startedAt,
        endedAt,
        durationMs,
      }),
      failureReason: "No bbox or resolvable regionGridCell provided",
      reviewRequiredReason: null,
    };
  }

  const artifactId = randomUUID();
  let cropResult: Awaited<ReturnType<typeof cropImageRegion>>;
  try {
    cropResult = await cropImageRegion({
      sourceFilePath: input.sourceScreenshotRef,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    });
  } catch (err) {
    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;
    const reason = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      screenshotProof: buildScreenshotProof({
        childCapabilityId: "capture-grid-region",
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
        failureReason: `Crop failed: ${reason}`,
        startedAt,
        endedAt,
        durationMs,
      }),
      failureReason: `Crop failed: ${reason}`,
      reviewRequiredReason: null,
    };
  }

  const artifactRef = await ports.artifactStorage.writeArtifact({
    sourceTempFilePath: cropResult.outputFilePath,
    artifactId,
    mimeType: cropResult.mimeType,
    createdAt: startedAt,
  });

  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  return {
    status: "success",
    regionScreenshotRef: artifactRef.storageRef,
    regionArtifactRef: artifactRef,
    sourceScreenshotRef: input.sourceScreenshotRef,
    screenshotProof: buildScreenshotProof({
      childCapabilityId: "capture-grid-region",
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
      capturePhaseMs: durationMs,
      artifactWritePhaseMs: 0,
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
