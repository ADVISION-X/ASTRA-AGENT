import type { GeometryGuardCheckDecision, GeometryGuardFailureReason, GeometryGuardStatus } from "../contract.js";

export type GeometryFailure = {
  status: Exclude<GeometryGuardStatus, "success">;
  guardDecision: "block" | "review_required";
  failureReason: GeometryGuardFailureReason;
  reviewRequiredReason: GeometryGuardFailureReason | null;
  message: string;
  policyDecision: GeometryGuardCheckDecision;
  boundsDecision: GeometryGuardCheckDecision;
  scaleDecision: GeometryGuardCheckDecision;
  transformDecision: GeometryGuardCheckDecision;
  dataQualityFlags: string[];
};

export function createGeometryFailure(input: {
  status: Exclude<GeometryGuardStatus, "success">;
  failureReason: GeometryGuardFailureReason;
  message: string;
  policyDecision?: GeometryGuardCheckDecision;
  boundsDecision?: GeometryGuardCheckDecision;
  scaleDecision?: GeometryGuardCheckDecision;
  transformDecision?: GeometryGuardCheckDecision;
  dataQualityFlags?: string[];
}): GeometryFailure {
  return {
    status: input.status,
    guardDecision: input.status === "review_required" ? "review_required" : "block",
    failureReason: input.failureReason,
    reviewRequiredReason: input.status === "review_required" ? input.failureReason : null,
    message: input.message,
    policyDecision: input.policyDecision ?? "not_applicable",
    boundsDecision: input.boundsDecision ?? "not_applicable",
    scaleDecision: input.scaleDecision ?? "not_applicable",
    transformDecision: input.transformDecision ?? "not_applicable",
    dataQualityFlags: input.dataQualityFlags ?? [],
  };
}