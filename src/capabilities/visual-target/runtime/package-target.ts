import { randomUUID } from "node:crypto";

import type {
  ParsedVisualTargetAbilityInput,
  VisualTargetBbox,
  VisualTargetGridCell,
  VisualTargetGridRegion,
  VisualTargetPackage,
} from "../contract.js";

/**
 * Builds a non-executable target package from an AI-selected or system-supplied
 * candidate. The package carries the source screenshot evidence ref and ensures
 * nonExecutable = true throughout its lifecycle.
 *
 * Visual Target does not compute coordinates, validate geometry safety, or
 * approve execution. Those are Geometry Guard's responsibilities.
 */
export function buildTargetPackage(params: {
  input: ParsedVisualTargetAbilityInput;
  targetRef: string;
  gridCell: VisualTargetGridCell | null;
  gridRegion: VisualTargetGridRegion | null;
  bbox: VisualTargetBbox | null;
}): VisualTargetPackage {
  return {
    targetRef: params.targetRef,
    sourceScreenshotEvidenceRef: params.input.sourceScreenshotEvidenceRef,
    gridSpecRef: params.input.gridSpecRef ?? null,
    gridCell: params.gridCell,
    gridRegion: params.gridRegion,
    bbox: params.bbox,
    sourceCoordinateSpace: params.input.sourceCoordinateSpace ?? "grid",
    selectedBy: params.input.selectedBy,
    selectionReason: params.input.selectionReason ?? null,
    nonExecutable: true,
    createdAt: new Date().toISOString(),
  };
}

export function generateTargetRef(childCapabilityId: string): string {
  return `vt:${childCapabilityId}:${randomUUID()}`;
}

export function generateCandidateRef(): string {
  return `vt:candidate:${randomUUID()}`;
}
