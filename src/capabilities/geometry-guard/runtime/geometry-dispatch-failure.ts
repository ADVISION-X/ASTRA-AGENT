import type {
  GeometryGuardAbilityContext,
  GeometryGuardCheckDecision,
  GeometryGuardFailureReason,
  GeometryGuardStatus,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { buildGeometryGuardResult } from "./geometry-result-builder.js";

export function dispatchGeometryGuardFailure(input: {
  input: ParsedGeometryGuardAbilityInput;
  context: GeometryGuardAbilityContext;
  failureReason: GeometryGuardFailureReason;
  status: Exclude<GeometryGuardStatus, "success">;
  statusMessage: string;
  policyDecision?: GeometryGuardCheckDecision;
  boundsDecision?: GeometryGuardCheckDecision;
  scaleDecision?: GeometryGuardCheckDecision;
  transformDecision?: GeometryGuardCheckDecision;
  sourceBounds?: Parameters<typeof buildGeometryGuardResult>[0]["sourceBounds"];
  targetBounds?: Parameters<typeof buildGeometryGuardResult>[0]["targetBounds"];
  dataQualityFlags?: string[];
}) {
  const started = input.context.clock.now();
  const ended = input.context.clock.now();
  return buildGeometryGuardResult({
    request: input.input,
    status: input.status,
    guardDecision: input.status === "review_required" ? "review_required" : "block",
    output: null,
    normalizedCoordinateSpace: null,
    normalizedClickPoint: null,
    normalizedBbox: null,
    appliedScaleMapping: null,
    failureReason: input.failureReason,
    reviewRequiredReason: input.status === "review_required" ? input.failureReason : null,
    statusMessage: input.statusMessage,
    policyDecision: input.policyDecision ?? "not_applicable",
    boundsDecision: input.boundsDecision ?? "not_applicable",
    scaleDecision: input.scaleDecision ?? "not_applicable",
    transformDecision: input.transformDecision ?? "not_applicable",
    sourceBounds: input.sourceBounds ?? null,
    targetBounds: input.targetBounds ?? null,
    startedAt: started.iso,
    endedAt: ended.iso,
    durationMs: Math.max(0, ended.epochMs - started.epochMs),
    dataQualityFlags: input.dataQualityFlags ?? [...input.input.dataQualityFlags],
  });
}
