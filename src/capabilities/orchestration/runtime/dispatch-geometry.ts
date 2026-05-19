import type { DispatchRegisteredAbilityActionInput } from "../contract.js";
import { resolveScreenshotStructuredDataRefPayload } from "../../screenshot/index.js";
import { decodeGridCell, type ScreenshotGridSpec } from "../../screenshot/schema-grid.js";
import type { DispatchAction, DispatchSequenceContext, CellZone } from "./dispatch-types.js";

const CELL_ZONE_OFFSETS: Record<CellZone, { xRatio: number; yRatio: number }> = {
  top_left: { xRatio: 1 / 6, yRatio: 1 / 6 },
  top_center: { xRatio: 1 / 2, yRatio: 1 / 6 },
  top_right: { xRatio: 5 / 6, yRatio: 1 / 6 },
  middle_left: { xRatio: 1 / 6, yRatio: 1 / 2 },
  middle_center: { xRatio: 1 / 2, yRatio: 1 / 2 },
  center: { xRatio: 1 / 2, yRatio: 1 / 2 },
  middle_right: { xRatio: 5 / 6, yRatio: 1 / 2 },
  bottom_left: { xRatio: 1 / 6, yRatio: 5 / 6 },
  bottom_center: { xRatio: 1 / 2, yRatio: 5 / 6 },
  bottom_right: { xRatio: 5 / 6, yRatio: 5 / 6 },
};

type GeometryTarget = {
  gridCell: string;
  cellZone: CellZone;
  gridSpecRef: string | null;
  bbox: { x: number; y: number; width: number; height: number } | null;
  viewportSize: { width: number; height: number } | null;
};

const resolveCellZoneClickPoint = (
  bbox: { x: number; y: number; width: number; height: number },
  cellZone: CellZone,
): { x: number; y: number } => {
  const offset = CELL_ZONE_OFFSETS[cellZone] ?? CELL_ZONE_OFFSETS.center;
  return { x: bbox.x + bbox.width * offset.xRatio, y: bbox.y + bbox.height * offset.yRatio };
};

const decodeGeometryTarget = (
  action: DispatchAction,
  input: DispatchRegisteredAbilityActionInput,
): GeometryTarget | { failureReason: string } => {
  const gridCell = action.gridCell ?? (action.input?.["gridCell"] as string | undefined) ?? null;
  const cellZone = action.cellZone ?? (action.input?.["cellZone"] as CellZone | undefined) ?? "center";
  if (!gridCell) return { failureReason: `Action ${action.actionCode} requires geometry proof but no gridCell provided` };
  const gridSpecRef = (input.currentEvidenceRefs?.["gridSpecRef"] as string | undefined) ?? null;
  return { gridCell, cellZone, gridSpecRef, ...resolveGridSpecGeometry(gridSpecRef, gridCell) };
};

const resolveGridSpecGeometry = (
  gridSpecRef: string | null,
  gridCell: string,
): Pick<GeometryTarget, "bbox" | "viewportSize"> => {
  if (!gridSpecRef) return { bbox: null, viewportSize: null };
  const gridSpec = resolveScreenshotStructuredDataRefPayload<ScreenshotGridSpec>(gridSpecRef);
  if (!gridSpec) return { bbox: null, viewportSize: null };
  const cell = decodeGridCell(gridSpec, gridCell);
  return {
    bbox: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
    viewportSize: { width: gridSpec.sourceWidth, height: gridSpec.sourceHeight },
  };
};

const runGeometryGuard = async (
  target: GeometryTarget,
  action: DispatchAction,
  input: DispatchRegisteredAbilityActionInput,
  ctx: DispatchSequenceContext,
) => ctx.geometryGuard.execute({
  abilityGroupId: "geometry-guard",
  childCapabilityId: "validate-click-grid-cell",
  missionId: input.missionId,
  runId: input.runId,
  roundId: input.roundId ?? null,
  ...(target.gridSpecRef ? { gridSpecRef: target.gridSpecRef } : {}),
  ...(target.bbox ? { bbox: target.bbox, clickPoint: resolveCellZoneClickPoint(target.bbox, target.cellZone) } : {}),
  ...(target.viewportSize ? { viewportSize: target.viewportSize } : {}),
  sourceCoordinateSpace: "grid",
  requestedExecutionSpace: "browserViewport",
  idempotencyKey: `geometry:${input.missionId}:${input.runId}:${input.roundId ?? ""}:${action.actionCode}:${target.gridCell}:${target.cellZone}`,
});

const proofFromGuardResult = (
  guardResult: Awaited<ReturnType<DispatchSequenceContext["geometryGuard"]["execute"]>>,
): Record<string, unknown> => ({
  geometryGuardRef: guardResult.geometryGuardRef,
  geometryGuardProofRef: guardResult.runtimeProof.proofId,
  geometryGuardOutputRef: guardResult.output?.outputRef ?? guardResult.geometryGuardRef,
  guardDecision: "allow" as const,
  geometryGuardNormalizedCoordinateSpace: "browserViewport" as const,
  geometryGuardNormalizedClickPoint: guardResult.normalizedClickPoint,
  ...(guardResult.normalizedBbox ? { bounds: { width: guardResult.normalizedBbox.width, height: guardResult.normalizedBbox.height } } : {}),
  sourceCoordinateProofRef: guardResult.geometryGuardRef,
});

const emitGeometryGuardResult = (
  action: DispatchAction,
  input: DispatchRegisteredAbilityActionInput,
  ctx: DispatchSequenceContext,
  guardResult: Awaited<ReturnType<DispatchSequenceContext["geometryGuard"]["execute"]>>,
): void => {
  ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: guardResult.status === "success" ? "debug" : "warn",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType: "GEOMETRY_GUARD_RESULT",
    owner: "geometry-guard-capability",
    missionId: input.missionId,
    runId: input.runId,
    ...(input.roundId ? { roundId: input.roundId } : {}),
    status: guardResult.status,
    reason: guardResult.guardDecision === "allow"
      ? `${action.actionCode} geometry approved`
      : `${action.actionCode} geometry denied: ${guardResult.failureReason ?? guardResult.reviewRequiredReason ?? "deny"}`,
    refs: {
      actionCode: action.actionCode,
      childCapabilityId: guardResult.childCapabilityId,
      geometryGuardRef: guardResult.geometryGuardRef,
      guardDecision: guardResult.guardDecision,
      ...(action.gridCell ? { gridCell: action.gridCell } : {}),
      ...(action.cellZone ? { cellZone: action.cellZone } : {}),
    },
  });
};

export const resolveGeometryProof = async (
  action: DispatchAction,
  input: DispatchRegisteredAbilityActionInput,
  ctx: DispatchSequenceContext,
): Promise<{ ok: true; proof: Record<string, unknown> } | { ok: false; failureReason: string }> => {
  let target: GeometryTarget | { failureReason: string };
  try {
    target = decodeGeometryTarget(action, input);
  } catch {
    return { ok: false, failureReason: `gridCell "${action.gridCell ?? "unknown"}" not found in gridSpec` };
  }
  if ("failureReason" in target) return { ok: false, failureReason: target.failureReason };
  let guardResult: Awaited<ReturnType<DispatchSequenceContext["geometryGuard"]["execute"]>>;
  try {
    guardResult = await runGeometryGuard(target, action, input, ctx);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, failureReason: `Geometry Guard threw for ${action.actionCode}: ${reason}` };
  }
  emitGeometryGuardResult(action, input, ctx, guardResult);
  if (guardResult.guardDecision !== "allow" || !guardResult.normalizedClickPoint) {
    return { ok: false, failureReason: `Geometry Guard denied ${action.actionCode}: ${guardResult.failureReason ?? guardResult.reviewRequiredReason ?? "deny"}` };
  }
  return { ok: true, proof: proofFromGuardResult(guardResult) };
};
