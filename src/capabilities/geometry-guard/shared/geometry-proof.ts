import type {
  GeometryGuardBoundingBox,
  GeometryGuardCheckDecision,
  GeometryGuardExecutionSpace,
  GeometryGuardFailureReason,
  GeometryGuardPoint,
  GeometryGuardSize,
} from "../contract.js";

export type GeometryExecutionProofSnapshot = {
  inputRef: string | null;
  outputRef: string | null;
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
  bboxBefore: GeometryGuardBoundingBox | null;
  bboxAfter: GeometryGuardBoundingBox | null;
  clickPointBefore: GeometryGuardPoint | null;
  clickPointAfter: GeometryGuardPoint | null;
  normalizedCoordinateSpace: GeometryGuardExecutionSpace | null;
  failureReason: GeometryGuardFailureReason | null;
  reviewRequiredReason: GeometryGuardFailureReason | null;
  policyDecision: GeometryGuardCheckDecision;
  boundsDecision: GeometryGuardCheckDecision;
  scaleDecision: GeometryGuardCheckDecision;
  transformDecision: GeometryGuardCheckDecision;
  sourceSize: GeometryGuardSize | null;
  targetSize: GeometryGuardSize | null;
};