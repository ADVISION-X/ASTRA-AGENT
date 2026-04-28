import type { NormalizedMouseClickAbilityInput } from "../contract.js";
import type { MouseClickButton, MouseClickCoordinate, MouseClickCount } from "./coordinate.js";
import type { MouseClickFailureReason } from "./click-failure.js";

export type MouseClickValidationResult =
  | { ok: true; coordinate: MouseClickCoordinate; button: MouseClickButton; clickCount: MouseClickCount }
  | { ok: false; status: "failed" | "review_required"; failureReason: MouseClickFailureReason; message: string };

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function validateMouseClickAbilityInput(input: NormalizedMouseClickAbilityInput): MouseClickValidationResult {
  if (!input.requestedBy.trim()) {
    return { ok: false, status: "failed", failureReason: "missing_requested_by", message: "mouse click requires requestedBy" };
  }

  if (!input.purpose.trim()) {
    return { ok: false, status: "failed", failureReason: "missing_purpose", message: "mouse click requires purpose" };
  }

  if (!input.geometryGuardRef.trim()) {
    return { ok: false, status: "failed", failureReason: "missing_geometry_guard_ref", message: "mouse click requires geometryGuardRef" };
  }

  if (input.guardDecision !== "allow") {
    return { ok: false, status: "failed", failureReason: "guard_not_allowed", message: "mouse click requires Geometry Guard allow decision" };
  }

  const { coordinate } = input;
  if (!isFiniteNumber(coordinate.x) || !isFiniteNumber(coordinate.y)) {
    return { ok: false, status: "failed", failureReason: "invalid_coordinate", message: "mouse click requires finite x and y" };
  }

  if (!isFiniteNumber(coordinate.boundsWidth) || !isFiniteNumber(coordinate.boundsHeight) || coordinate.boundsWidth <= 0 || coordinate.boundsHeight <= 0) {
    return { ok: false, status: "failed", failureReason: "invalid_coordinate_bounds", message: "mouse click requires positive coordinate bounds" };
  }

  if (coordinate.coordinateSpace !== "browserViewport" && coordinate.coordinateSpace !== "desktopScreen") {
    return { ok: false, status: "failed", failureReason: "unsupported_coordinate_space", message: `unsupported mouse click coordinateSpace ${coordinate.coordinateSpace}` };
  }

  if (input.safetyPolicy.blockIfOutOfBounds && (coordinate.x < 0 || coordinate.y < 0 || coordinate.x > coordinate.boundsWidth || coordinate.y > coordinate.boundsHeight)) {
    return { ok: false, status: "failed", failureReason: "out_of_bounds", message: "mouse click coordinate is outside declared bounds" };
  }

  const hasSourceRef = Boolean(input.sourceEvidenceRef) || Boolean(input.sourceTargetRef);
  if (!hasSourceRef && input.safetyPolicy.blockIfNoSourceRef) {
    if (input.safetyPolicy.allowOperatorManual) {
      if (!input.safetyPolicy.operatorManualApprovalRef) {
        return {
          ok: false,
          status: "review_required",
          failureReason: "operator_manual_approval_required",
          message: "mouse click requires operatorManualApprovalRef when source refs are absent",
        };
      }
    } else {
      return { ok: false, status: "failed", failureReason: "missing_source_ref", message: "mouse click requires sourceEvidenceRef or sourceTargetRef" };
    }
  }

  if (input.button === "right" && !input.safetyPolicy.allowRightClick) {
    return { ok: false, status: "failed", failureReason: "right_click_not_allowed", message: "mouse click policy blocks right click" };
  }

  if (input.clickCount !== 1 && input.clickCount !== 2) {
    return { ok: false, status: "failed", failureReason: "invalid_click_count", message: "mouse click supports only clickCount 1 or 2" };
  }

  if (input.clickCount === 2 && !input.safetyPolicy.allowDoubleClick) {
    return { ok: false, status: "failed", failureReason: "double_click_not_allowed", message: "mouse click policy blocks double click" };
  }

  if (!isFiniteNumber(input.safetyPolicy.maxDurationMs) || input.safetyPolicy.maxDurationMs <= 0) {
    return { ok: false, status: "failed", failureReason: "invalid_duration_limit", message: "mouse click requires a finite positive maxDurationMs" };
  }

  return {
    ok: true,
    coordinate,
    button: input.button,
    clickCount: input.clickCount,
  };
}