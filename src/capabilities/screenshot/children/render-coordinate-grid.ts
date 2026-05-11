import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import type { ArtifactStoragePort } from "../ports/artifact-storage-port.js";
import type { RenderCoordinateGridInput, RenderCoordinateGridResult } from "../schema.js";
import { renderCoordinateGridImage } from "../runtime/grid-renderer.js";
import { buildScreenshotProof } from "../runtime/proof.js";
import { registerStructuredDataRef } from "../runtime/structured-ref-store.js";

type Ports = {
  artifactStorage: ArtifactStoragePort;
};

export async function renderCoordinateGrid(
  input: RenderCoordinateGridInput,
  ports: Ports,
): Promise<RenderCoordinateGridResult> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  if (!existsSync(input.sourceScreenshotRef)) {
    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;
    return {
      status: "failed",
      sourceScreenshotRef: input.sourceScreenshotRef,
      screenshotProof: buildScreenshotProof({
        childCapabilityId: "render-coordinate-grid",
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

  const rowCount = input.gridPolicy?.rowCount ?? 8;
  const columnCount = input.gridPolicy?.columnCount ?? 12;

  const gridArtifactId = randomUUID();
  const gridRenderStart = Date.now();

  let renderResult: Awaited<ReturnType<typeof renderCoordinateGridImage>>;
  try {
    renderResult = await renderCoordinateGridImage({
      sourceFilePath: input.sourceScreenshotRef,
      sourceScreenshotRef: input.sourceScreenshotRef,
      sourceWidth: 0, // will be read from file
      sourceHeight: 0,
      rowCount,
      columnCount,
      createdAt: startedAt,
    });
  } catch (err) {
    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;
    const reason = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      screenshotProof: buildScreenshotProof({
        childCapabilityId: "render-coordinate-grid",
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
        failureReason: `Grid render failed: ${reason}`,
        startedAt,
        endedAt,
        durationMs,
      }),
      failureReason: `Grid render failed: ${reason}`,
      reviewRequiredReason: null,
    };
  }
  const gridRenderPhaseMs = Date.now() - gridRenderStart;

  const artifactStart = Date.now();
  const artifactRef = await ports.artifactStorage.writeArtifact({
    sourceTempFilePath: renderResult.outputFilePath,
    artifactId: gridArtifactId,
    mimeType: renderResult.mimeType,
    createdAt: startedAt,
  });
  const artifactWritePhaseMs = Date.now() - artifactStart;

  // Register gridSpec in the in-memory store so resolvers can access it
  registerStructuredDataRef(renderResult.gridSpec.gridSpecRef, renderResult.gridSpec);
  registerStructuredDataRef(artifactRef.storageRef, renderResult.gridSpec);

  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  return {
    status: "success",
    coordinateGridScreenshotRef: artifactRef.storageRef,
    aiReadableImagePath: artifactRef.storageRef,
    coordinateGridArtifactRef: artifactRef,
    gridSpecRef: renderResult.gridSpec.gridSpecRef,
    gridSpec: renderResult.gridSpec,
    gridRows: renderResult.gridSpec.gridRows,
    gridColumns: renderResult.gridSpec.gridColumns,
    sourceScreenshotRef: input.sourceScreenshotRef,
    screenshotProof: buildScreenshotProof({
      childCapabilityId: "render-coordinate-grid",
      missionId: input.missionId,
      runId: input.runId,
      sessionId: input.sessionId,
      roundId: input.roundId,
      stepId: input.stepId,
      capabilityCallId: input.capabilityCallId,
      nerveBusEnvelopeId: input.nerveBusEnvelopeId,
      inputRef: input.inputRef,
      coordinateGridScreenshotRef: artifactRef.storageRef,
      gridSpecRef: renderResult.gridSpec.gridSpecRef,
      gridRenderPhaseMs,
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
