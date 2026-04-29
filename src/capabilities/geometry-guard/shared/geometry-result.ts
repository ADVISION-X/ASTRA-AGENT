import type {
  GeometryGuardBoundingBox,
  GeometryGuardCheckDecision,
  GeometryGuardExecutionSpace,
  GeometryGuardFailureReason,
  GeometryGuardPoint,
  GeometryGuardResultOutput,
  GeometryGuardScaleMapping,
  GeometryGuardStatus,
} from "../contract.js";

export type GeometryExecutionState = {
  status: GeometryGuardStatus;
  guardDecision: "allow" | "block" | "review_required";
  output: GeometryGuardResultOutput | null;
  normalizedCoordinateSpace: GeometryGuardExecutionSpace | null;
  normalizedClickPoint: GeometryGuardPoint | null;
  normalizedBbox: GeometryGuardBoundingBox | null;
  appliedScaleMapping: GeometryGuardScaleMapping | null;
  failureReason: GeometryGuardFailureReason | null;
  reviewRequiredReason: GeometryGuardFailureReason | null;
  statusMessage: string;
  policyDecision: GeometryGuardCheckDecision;
  boundsDecision: GeometryGuardCheckDecision;
  scaleDecision: GeometryGuardCheckDecision;
  transformDecision: GeometryGuardCheckDecision;
  dataQualityFlags: string[];
};