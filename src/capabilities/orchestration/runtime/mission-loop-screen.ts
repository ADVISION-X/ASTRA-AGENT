import { randomUUID } from "node:crypto";

import type { OrchestrationChildrenContext } from "../children-context.js";
import {
  VISUAL_MISSION_DEFAULT_GRID_COLUMNS,
  VISUAL_MISSION_DEFAULT_GRID_ROWS,
} from "../../screenshot/schema-grid.js";
import { cleanupRoundScreenshotArtifacts, primaryAiContextMaxWidthPx, resizePrimaryImageForAi } from "./mission-loop-artifacts.js";
import { applyMissionStatus, getMissionState, setActiveMission, upsertMissionState } from "./mission-state.js";

type ScreenInput = {
  ctx: OrchestrationChildrenContext;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string;
  roundIndex: number;
};

export type RoundScreenContext = {
  originalScreenshotRef: string;
  coordinateGridScreenshotRef: string;
  gridSpecRef: string;
  primaryAiContextImageRefs: string[];
  aiTransientScreenshotRefs: string[];
};

const failMission = (missionId: string, reason: string): void => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason: reason }));
  setActiveMission(null);
};

const emitCaptureRequested = (input: ScreenInput): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType: "SCREENSHOT_CAPTURE_REQUESTED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: "started",
    reason: `Round ${input.roundIndex} capture-browser-viewport requested`,
  });
};

const captureViewport = async (input: ScreenInput) => {
  emitCaptureRequested(input);
  return input.ctx.screenshotAbilityGroup.execute({
    childCapabilityId: "capture-browser-viewport",
    missionId: input.missionId,
    runId: input.runId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    stepId: randomUUID(),
    capabilityCallId: randomUUID(),
    nerveBusEnvelopeId: randomUUID(),
    inputRef: randomUUID(),
    browserSessionRef: "local",
    idempotencyKey: `capture:${input.missionId}:${input.roundId}`,
  });
};

const validCaptureRef = (result: Awaited<ReturnType<OrchestrationChildrenContext["screenshotAbilityGroup"]["execute"]>>): string | null =>
  result.status === "success" && "screenshotRef" in result && result.screenshotRef ? result.screenshotRef : null;

const renderGrid = async (input: ScreenInput, originalScreenshotRef: string, proofRef: string) =>
  input.ctx.screenshotAbilityGroup.execute({
    childCapabilityId: "render-coordinate-grid",
    missionId: input.missionId,
    runId: input.runId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    stepId: randomUUID(),
    capabilityCallId: randomUUID(),
    nerveBusEnvelopeId: randomUUID(),
    inputRef: randomUUID(),
    sourceScreenshotRef: originalScreenshotRef,
    sourceScreenshotProofRef: proofRef,
    gridPolicy: {
      rowCount: VISUAL_MISSION_DEFAULT_GRID_ROWS,
      columnCount: VISUAL_MISSION_DEFAULT_GRID_COLUMNS,
    },
    idempotencyKey: `grid:${input.missionId}:${input.roundId}`,
  });

const emitGridRendered = (input: ScreenInput, coordinateGridScreenshotRef: string): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType: "COORDINATE_GRID_RENDERED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: "success",
    reason: `grid rendered ref=${coordinateGridScreenshotRef}`,
  });
};

const cleanupGridFailure = async (
  input: ScreenInput,
  originalScreenshotRef: string,
  coordinateGridScreenshotRef: string | null,
): Promise<void> => {
  await cleanupRoundScreenshotArtifacts({
    ...input,
    cleanupKind: "grid_failed",
    originalScreenshotRef,
    coordinateGridScreenshotRef,
    extraTransientScreenshotRefs: [],
    deleteOriginalScreenshot: true,
  });
};

const prepareAiImages = async (
  input: ScreenInput,
  originalAiPath: string,
  gridAiPath: string,
): Promise<string[]> => {
  const refs = [
    await resizePrimaryImageForAi(originalAiPath, "original"),
    await resizePrimaryImageForAi(gridAiPath, "grid"),
  ];
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType: "SCREENSHOT_CAPTURED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: "success",
    reason: `Primary AI context images prepared maxWidth=${primaryAiContextMaxWidthPx} refs=${refs.join(";")}`,
  });
  return refs;
};

export const prepareRoundScreenContext = async (input: ScreenInput): Promise<RoundScreenContext | null> => {
  const captureResult = await captureViewport(input).catch((error: unknown) => {
    failMission(input.missionId, error instanceof Error ? error.message : "screenshot capture threw");
    return null;
  });
  if (!captureResult) return null;
  const originalScreenshotRef = validCaptureRef(captureResult);
  if (!originalScreenshotRef) {
    failMission(input.missionId, ("failureReason" in captureResult ? captureResult.failureReason : null) ?? "screenshot capture failed");
    return null;
  }
  const proofRef = "screenshotProof" in captureResult && captureResult.screenshotProof ? captureResult.screenshotProof.proofId : randomUUID();
  const gridResult = await renderGrid(input, originalScreenshotRef, proofRef).catch(async (error: unknown) => {
    await cleanupRoundScreenshotArtifacts({ ...input, cleanupKind: "grid_failed", originalScreenshotRef, coordinateGridScreenshotRef: null, extraTransientScreenshotRefs: [], deleteOriginalScreenshot: true });
    failMission(input.missionId, error instanceof Error ? error.message : "grid render threw");
    return null;
  });
  if (!gridResult || gridResult.status !== "success" || !("coordinateGridScreenshotRef" in gridResult) || !gridResult.coordinateGridScreenshotRef || !("gridSpecRef" in gridResult) || !gridResult.gridSpecRef) {
    const failedGridRef = gridResult && "coordinateGridScreenshotRef" in gridResult && typeof gridResult.coordinateGridScreenshotRef === "string"
      ? gridResult.coordinateGridScreenshotRef
      : null;
    await cleanupGridFailure(input, originalScreenshotRef, failedGridRef);
    failMission(input.missionId, gridResult && "failureReason" in gridResult ? (gridResult.failureReason ?? "grid render failed") : "grid render failed");
    return null;
  }
  emitGridRendered(input, gridResult.coordinateGridScreenshotRef);
  const originalAiPath = "aiReadableImagePath" in captureResult && captureResult.aiReadableImagePath ? captureResult.aiReadableImagePath : originalScreenshotRef;
  const gridAiPath = "aiReadableImagePath" in gridResult && gridResult.aiReadableImagePath ? gridResult.aiReadableImagePath : gridResult.coordinateGridScreenshotRef;
  const primaryAiContextImageRefs = await prepareAiImages(input, originalAiPath, gridAiPath).catch(async (error: unknown) => {
    await cleanupRoundScreenshotArtifacts({
      ...input,
      cleanupKind: "ai_failed",
      originalScreenshotRef,
      coordinateGridScreenshotRef: gridResult.coordinateGridScreenshotRef ?? null,
      extraTransientScreenshotRefs: [],
      deleteOriginalScreenshot: true,
    });
    failMission(input.missionId, error instanceof Error ? error.message : "AI image preparation failed");
    return null;
  });
  if (!primaryAiContextImageRefs) return null;
  return {
    originalScreenshotRef,
    coordinateGridScreenshotRef: gridResult.coordinateGridScreenshotRef,
    gridSpecRef: gridResult.gridSpecRef,
    primaryAiContextImageRefs,
    aiTransientScreenshotRefs: primaryAiContextImageRefs,
  };
};
