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
import { MouseScrollAbilityInputSchema, MouseScrollSafetyPolicySchema } from "../schema.js";

type UnknownObject = { [key: string]: unknown };

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

export type MouseScrollFailureEnvelope = {
  attemptRef: string;
  inputRef: string;
  childCapabilityId: MouseScrollChildCapabilityId;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string | null;
  purpose: string | null;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  geometryGuardRef: string | null;
  geometryGuardProofRef: string | null;
  sourceCoordinateProofRef: string | null;
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

function isObject(value: unknown): value is UnknownObject {
  return typeof value === "object" && value !== null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveChildCapabilityId(value: unknown): MouseScrollChildCapabilityId {
  if (value === "scroll-desktop-screen") {
    return "scroll-desktop-screen";
  }
  if (value === "scroll-region") {
    return "scroll-region";
  }
  return "scroll-browser-viewport";
}

function resolveCoordinateSpace(value: unknown, childCapabilityId: MouseScrollChildCapabilityId): MouseScrollCoordinateSpace {
  if (value === "desktopScreen") {
    return "desktopScreen";
  }
  if (childCapabilityId === "scroll-desktop-screen") {
    return "desktopScreen";
  }
  return "browserViewport";
}

function resolveDirection(value: unknown): MouseScrollDirection {
  if (value === "up" || value === "left" || value === "right") {
    return value;
  }
  return "down";
}

function resolveMagnitude(value: unknown): MouseScrollMagnitude {
  if (value === "small" || value === "halfPage" || value === "onePage" || value === "twoPages" || value === "customDelta") {
    return value;
  }
  return "onePage";
}

function readPoint(value: unknown): { x: number; y: number } | null {
  if (!isObject(value)) {
    return null;
  }
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  if (x === null || y === null) {
    return null;
  }
  return { x, y };
}

function readBounds(value: unknown): MouseScrollBounds | null {
  if (!isObject(value)) {
    return null;
  }
  const width = readFiniteNumber(value.width);
  const height = readFiniteNumber(value.height);
  if (width === null || height === null || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function readRegion(value: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!isObject(value)) {
    return null;
  }
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  const width = readFiniteNumber(value.width);
  const height = readFiniteNumber(value.height);
  if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

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

export function buildInvalidInputFailureEnvelope(input: unknown, fallbackChildCapabilityId?: MouseScrollChildCapabilityId): MouseScrollFailureEnvelope {
  const raw = isObject(input) ? input : null;
  const childCapabilityId = fallbackChildCapabilityId ?? resolveChildCapabilityId(raw?.childCapabilityId);
  const geometryProof = raw && isObject(raw.geometryScrollProof) ? raw.geometryScrollProof : null;
  const safetyPolicy = MouseScrollSafetyPolicySchema.safeParse(raw && isObject(raw.safetyPolicy) ? raw.safetyPolicy : undefined);
  const receivedShapeHash = stableHash("mouse-scroll-input-shape", raw ?? input);
  const parseErrorRef = stableHash("mouse-scroll-parse-error", formatParseIssues(input));

  return {
    attemptRef: stableHash("mouse-scroll-attempt", [receivedShapeHash, childCapabilityId]),
    inputRef: stableHash("mouse-scroll-input", [receivedShapeHash, childCapabilityId]),
    childCapabilityId,
    sessionId: null,
    roundId: readNonEmptyString(raw?.roundId),
    videoVisitId: readNonEmptyString(raw?.videoVisitId),
    requestedBy: readNonEmptyString(raw?.requestedBy),
    purpose: readNonEmptyString(raw?.purpose),
    sourceAbilityGroupId: readNonEmptyString(raw?.sourceAbilityGroupId),
    sourceChildCapabilityId: readNonEmptyString(raw?.sourceChildCapabilityId),
    geometryGuardRef: geometryProof ? readNonEmptyString(geometryProof.geometryGuardRef) : null,
    geometryGuardProofRef: geometryProof ? readNonEmptyString(geometryProof.proofId) : null,
    sourceCoordinateProofRef: readNonEmptyString(raw?.sourceCoordinateProofRef),
    sourceEvidenceRef: readNonEmptyString(raw?.sourceEvidenceRef),
    sourceTargetRef: readNonEmptyString(raw?.sourceTargetRef),
    parseErrorRef,
    receivedShapeHash,
    coordinateSpace: resolveCoordinateSpace(raw?.coordinateSpace ?? geometryProof?.normalizedCoordinateSpace, childCapabilityId),
    sourceCoordinateSpace: geometryProof?.normalizedCoordinateSpace === "desktopScreen" || geometryProof?.normalizedCoordinateSpace === "browserViewport"
      ? geometryProof.normalizedCoordinateSpace
      : null,
    requestedAnchor: geometryProof ? readPoint(geometryProof.normalizedAnchorPoint) : null,
    region: readRegion(raw?.region),
    regionRef: readNonEmptyString(raw?.regionRef),
    bounds: readBounds(raw?.bounds),
    direction: resolveDirection(raw?.direction),
    magnitude: resolveMagnitude(raw?.magnitude),
    repeat: typeof raw?.repeat === "number" && Number.isInteger(raw.repeat) && raw.repeat > 0 ? raw.repeat : 1,
    safetyPolicy: safetyPolicy.success ? safetyPolicy.data : MouseScrollSafetyPolicySchema.parse(undefined),
  };
}

export function resolveMouseScrollFailureSeed(input: unknown, fallbackChildCapabilityId?: MouseScrollChildCapabilityId): MouseScrollResultSeed {
  const parsed = MouseScrollAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return buildMouseScrollExecutionSeed(parsed.data);
  }

  return buildInvalidInputFailureEnvelope(input, fallbackChildCapabilityId);
}