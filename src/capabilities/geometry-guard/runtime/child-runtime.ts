import type {
  GeometryGuardAbilityResult,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import type {
  GeometryGuardBoundingBox,
  GeometryGuardPoint,
} from "../geometry-types.js";
import { buildGeometryGuardProof } from "./proof.js";
import { buildAllowResult, buildDenyResult } from "./result.js";

export interface GeometryGuardTiming {
  startedAt: string;
  startMs: number;
}

export function startGeometryGuardTiming(): GeometryGuardTiming {
  return { startedAt: new Date().toISOString(), startMs: Date.now() };
}

export function denyGuardChild(params: {
  input: ParsedGeometryGuardAbilityInput;
  timing: GeometryGuardTiming;
  failureReason: string;
  statusMessage: string;
  normalizedClickPoint: GeometryGuardPoint | null;
  normalizedBbox: GeometryGuardBoundingBox | null;
}): GeometryGuardAbilityResult {
  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - params.timing.startMs;
  const proof = buildGeometryGuardProof({
    input: params.input,
    guardDecision: "deny",
    normalizedClickPoint: params.normalizedClickPoint,
    normalizedBbox: params.normalizedBbox,
    failureReason: params.failureReason,
    reviewRequiredReason: null,
    startedAt: params.timing.startedAt,
    endedAt,
    durationMs,
  });
  return buildDenyResult({
    input: params.input,
    proof,
    failureReason: params.failureReason,
    statusMessage: params.statusMessage,
  });
}

export function allowGuardChild(params: {
  input: ParsedGeometryGuardAbilityInput;
  timing: GeometryGuardTiming;
  normalizedClickPoint: GeometryGuardPoint;
  normalizedBbox: GeometryGuardBoundingBox;
}): GeometryGuardAbilityResult {
  const endedAt = new Date().toISOString();
  const durationMs = Date.now() - params.timing.startMs;
  const proof = buildGeometryGuardProof({
    input: params.input,
    guardDecision: "allow",
    normalizedClickPoint: params.normalizedClickPoint,
    normalizedBbox: params.normalizedBbox,
    failureReason: null,
    reviewRequiredReason: null,
    startedAt: params.timing.startedAt,
    endedAt,
    durationMs,
  });
  return buildAllowResult({
    input: params.input,
    proof,
    normalizedClickPoint: params.normalizedClickPoint,
    normalizedBbox: params.normalizedBbox,
  });
}
