import { createHash } from "node:crypto";

import type {
  MouseScrollAbilityInput,
  MouseScrollBounds,
  MouseScrollChildCapabilityId,
  MouseScrollCoordinateSpace,
  MouseScrollDirection,
  MouseScrollMagnitude,
  MouseScrollSafetyPolicy,
  ParsedMouseScrollAbilityInput,
} from "../contract.js";
import { MouseScrollAbilityInputSchema } from "../schema.js";
import { buildInvalidInputFailureEnvelope, type MouseScrollFailureEnvelope } from "./mouse-scroll-failure-seed.js";

export type MouseScrollExecutionSeed = {
  attemptRef: string;
  inputRef: string;
  childCapabilityId: MouseScrollChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string;
  purpose: string;
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: string | null;
  geometryGuardRef: string | null;
  geometryGuardProofRef: string | null;
  sourceCoordinateProofRef: string;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string | null;
  parseErrorRef: string | null;
  receivedShapeHash: string | null;
  coordinateSpace: MouseScrollCoordinateSpace;
  sourceCoordinateSpace: MouseScrollCoordinateSpace | null;
  requestedAnchor: { x: number; y: number } | null;
  region: { x: number; y: number; width: number; height: number } | null;
  regionRef: string | null;
  bounds: MouseScrollBounds | null;
  direction: MouseScrollDirection;
  magnitude: MouseScrollMagnitude;
  repeat: number;
  safetyPolicy: MouseScrollSafetyPolicy;
};

export type MouseScrollResultSeed = MouseScrollExecutionSeed | MouseScrollFailureEnvelope;

function stableHash(prefix: string, value: unknown): string {
  const serialized = (() => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  })();
  return `${prefix}:${createHash("sha256").update(serialized).digest("hex").slice(0, 18)}`;
}

function formatParseIssues(input: unknown): string {
  const parsed = MouseScrollAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return "Mouse Scroll rejected invalid input schema.";
  }

  return parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "root"}:${issue.message}`)
    .join(" | ");
}

export function parseMouseScrollAbilityInput(input: MouseScrollAbilityInput | unknown):
  | { success: true; data: ParsedMouseScrollAbilityInput }
  | { success: false; statusMessage: string } {
  const parsed = MouseScrollAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return parsed;
  }
  return {
    success: false,
    statusMessage: `Mouse Scroll rejected invalid input schema. ${formatParseIssues(input)}`,
  };
}

export function buildMouseScrollExecutionSeed(input: ParsedMouseScrollAbilityInput): MouseScrollExecutionSeed {
  const inputRef = stableHash("mouse-scroll-input", [
    input.sessionId,
    input.childCapabilityId,
    input.sourceCoordinateProofRef,
    input.purpose,
    input.geometryScrollProof.proofId,
  ]);

  return {
    attemptRef: stableHash("mouse-scroll-attempt", [inputRef, input.requestedBy]),
    inputRef,
    childCapabilityId: input.childCapabilityId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    requestedBy: input.requestedBy,
    purpose: input.purpose,
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceChildCapabilityId: input.sourceChildCapabilityId,
    geometryGuardRef: input.geometryScrollProof.geometryGuardRef,
    geometryGuardProofRef: input.geometryScrollProof.proofId,
    sourceCoordinateProofRef: input.sourceCoordinateProofRef,
    sourceEvidenceRef: input.sourceEvidenceRef,
    sourceTargetRef: input.sourceTargetRef,
    parseErrorRef: null,
    receivedShapeHash: null,
    coordinateSpace: input.coordinateSpace,
    sourceCoordinateSpace: input.geometryScrollProof.normalizedCoordinateSpace,
    requestedAnchor: input.geometryScrollProof.normalizedAnchorPoint,
    region: input.region,
    regionRef: input.regionRef,
    bounds: input.bounds,
    direction: input.direction,
    magnitude: input.magnitude,
    repeat: input.repeat,
    safetyPolicy: input.safetyPolicy,
  };
}

export function resolveMouseScrollFailureSeed(input: unknown, defaultChildCapabilityId?: MouseScrollChildCapabilityId): MouseScrollResultSeed {
  const parsed = MouseScrollAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return buildMouseScrollExecutionSeed(parsed.data);
  }

  return buildInvalidInputFailureEnvelope(input, defaultChildCapabilityId);
}
