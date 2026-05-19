import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import type { ArtifactStoragePort } from "../ports/artifact-storage-port.js";
import type {
  RenderCoordinateGridInput,
  RenderCoordinateGridResult,
} from "../schema-render.js";
import {
  VISUAL_MISSION_DEFAULT_GRID_COLUMNS,
  VISUAL_MISSION_DEFAULT_GRID_ROWS,
} from "../schema-grid.js";
import { renderCoordinateGridImage } from "../runtime/grid-renderer.js";
import { buildScreenshotProof } from "../runtime/proof.js";
import { registerStructuredDataRef } from "../runtime/structured-ref-store.js";

type Ports = {
  artifactStorage: ArtifactStoragePort;
};

type RenderTiming = {
  startedAt: string;
  startMs: number;
};

export async function renderCoordinateGrid(
  input: RenderCoordinateGridInput,
  ports: Ports,
): Promise<RenderCoordinateGridResult> {
  const timing = startRenderTiming();

  if (!existsSync(input.sourceScreenshotRef)) {
    const reason = `Source screenshot not found: ${input.sourceScreenshotRef}`;
    return buildRenderGridFailure({ input, timing, failureReason: reason });
  }

  const gridSize = resolveGridSize(input);
  const gridArtifactId = randomUUID();
  const gridRenderStart = Date.now();
  const renderResult = await tryRenderGrid({
    input,
    timing,
    rowCount: gridSize.rowCount,
    columnCount: gridSize.columnCount,
  });
  if (!renderResult.ok) {
    const failureReason = `Grid render failed: ${renderResult.reason}`;
    return buildRenderGridFailure({ input, timing, failureReason });
  }
  const gridRenderPhaseMs = Date.now() - gridRenderStart;
  const artifact = await writeGridArtifact(ports, timing, gridArtifactId, renderResult.value);
  return finishRenderGrid({
    input,
    timing,
    artifactRef: artifact.artifactRef,
    renderResult: renderResult.value,
    gridRenderPhaseMs,
    artifactWritePhaseMs: artifact.artifactWritePhaseMs,
  });
}

function resolveGridSize(input: RenderCoordinateGridInput) {
  return {
    rowCount: input.gridPolicy?.rowCount ?? VISUAL_MISSION_DEFAULT_GRID_ROWS,
    columnCount:
      input.gridPolicy?.columnCount ?? VISUAL_MISSION_DEFAULT_GRID_COLUMNS,
  };
}

async function tryRenderGrid(params: {
  input: RenderCoordinateGridInput;
  timing: RenderTiming;
  rowCount: number;
  columnCount: number;
}) {
  try {
    const value = await renderCoordinateGridImage({
      sourceFilePath: params.input.sourceScreenshotRef,
      sourceScreenshotRef: params.input.sourceScreenshotRef,
      sourceWidth: 0,
      sourceHeight: 0,
      rowCount: params.rowCount,
      columnCount: params.columnCount,
      createdAt: params.timing.startedAt,
    });
    return { ok: true as const, value };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false as const, reason };
  }
}

async function writeGridArtifact(
  ports: Ports,
  timing: RenderTiming,
  gridArtifactId: string,
  renderResult: Awaited<ReturnType<typeof renderCoordinateGridImage>>,
) {
  const artifactStart = Date.now();
  const artifactRef = await ports.artifactStorage.writeArtifact({
    sourceTempFilePath: renderResult.outputFilePath,
    artifactId: gridArtifactId,
    mimeType: renderResult.mimeType,
    createdAt: timing.startedAt,
  });
  const artifactWritePhaseMs = Date.now() - artifactStart;
  return { artifactRef, artifactWritePhaseMs };
}

function registerGridSpecRefs(
  renderResult: Awaited<ReturnType<typeof renderCoordinateGridImage>>,
  storageRef: string,
): void {
  registerStructuredDataRef(renderResult.gridSpec.gridSpecRef, renderResult.gridSpec);
  registerStructuredDataRef(storageRef, renderResult.gridSpec);
}

function finishRenderGrid(params: {
  input: RenderCoordinateGridInput;
  timing: RenderTiming;
  artifactRef: Awaited<ReturnType<ArtifactStoragePort["writeArtifact"]>>;
  renderResult: Awaited<ReturnType<typeof renderCoordinateGridImage>>;
  gridRenderPhaseMs: number;
  artifactWritePhaseMs: number;
}): RenderCoordinateGridResult {
  registerGridSpecRefs(params.renderResult, params.artifactRef.storageRef);
  return buildRenderGridSuccess(params);
}

function startRenderTiming(): RenderTiming {
  return { startedAt: new Date().toISOString(), startMs: Date.now() };
}

function buildRenderGridFailure(params: {
  input: RenderCoordinateGridInput;
  timing: RenderTiming;
  failureReason: string;
}): RenderCoordinateGridResult {
  const { endedAt, durationMs } = endRenderTiming(params.timing);
  return {
    status: "failed",
    sourceScreenshotRef: params.input.sourceScreenshotRef,
    screenshotProof: buildScreenshotProof({
      ...renderProofIdentity(params.input),
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

function buildRenderGridSuccess(params: {
  input: RenderCoordinateGridInput;
  timing: RenderTiming;
  artifactRef: Awaited<ReturnType<ArtifactStoragePort["writeArtifact"]>>;
  renderResult: Awaited<ReturnType<typeof renderCoordinateGridImage>>;
  gridRenderPhaseMs: number;
  artifactWritePhaseMs: number;
}): RenderCoordinateGridResult {
  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - params.timing.startMs;
  const artifactRef = params.artifactRef;
  const gridSpec = params.renderResult.gridSpec;

  return {
    status: "success",
    coordinateGridScreenshotRef: artifactRef.storageRef,
    aiReadableImagePath: artifactRef.storageRef,
    coordinateGridArtifactRef: artifactRef,
    gridSpecRef: gridSpec.gridSpecRef,
    gridSpec,
    gridRows: gridSpec.gridRows,
    gridColumns: gridSpec.gridColumns,
    sourceScreenshotRef: params.input.sourceScreenshotRef,
    screenshotProof: buildScreenshotProof({
      ...renderProofIdentity(params.input),
      coordinateGridScreenshotRef: artifactRef.storageRef,
      gridSpecRef: gridSpec.gridSpecRef,
      gridRenderPhaseMs: params.gridRenderPhaseMs,
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

function endRenderTiming(timing: RenderTiming) {
  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - timing.startMs;
  return { endedAt, durationMs };
}

function renderProofIdentity(input: RenderCoordinateGridInput) {
  return {
    childCapabilityId: "render-coordinate-grid" as const,
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
