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
  coordinateSpace: MouseScrollCoordinateSpace;
  requestedAnchor: { x: number; y: number } | null;
  region: { x: number; y: number; width: number; height: number } | null;
  regionRef: string | null;
  bounds: MouseScrollBounds | null;
  direction: MouseScrollDirection;
  magnitude: MouseScrollMagnitude;
  repeat: number;
  safetyPolicy: MouseScrollSafetyPolicy;
};

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

export function parseMouseScrollAbilityInput(input: MouseScrollAbilityInput) {
  return MouseScrollAbilityInputSchema.safeParse(input);
}

export function buildMouseScrollExecutionSeed(input: ParsedMouseScrollAbilityInput): MouseScrollExecutionSeed {
  return {
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
    coordinateSpace: input.coordinateSpace,
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

export function coerceMouseScrollFailureSeed(input: unknown): MouseScrollExecutionSeed {
  const raw = isObject(input) ? input : null;
  const childCapabilityId = resolveChildCapabilityId(raw?.childCapabilityId);
  const geometryProof = raw && isObject(raw.geometryScrollProof) ? raw.geometryScrollProof : null;
  const safetyPolicy = MouseScrollSafetyPolicySchema.safeParse(raw && isObject(raw.safetyPolicy) ? raw.safetyPolicy : undefined);

  return {
    childCapabilityId,
    sessionId: readNonEmptyString(raw?.sessionId) ?? "unknown-session",
    roundId: readNonEmptyString(raw?.roundId),
    videoVisitId: readNonEmptyString(raw?.videoVisitId),
    requestedBy: readNonEmptyString(raw?.requestedBy) ?? "unknown-requester",
    purpose: readNonEmptyString(raw?.purpose) ?? "unknown-purpose",
    sourceAbilityGroupId: readNonEmptyString(raw?.sourceAbilityGroupId) ?? "unknown-source-ability-group",
    sourceChildCapabilityId: readNonEmptyString(raw?.sourceChildCapabilityId),
    geometryGuardRef: geometryProof ? readNonEmptyString(geometryProof.geometryGuardRef) : null,
    geometryGuardProofRef: geometryProof ? readNonEmptyString(geometryProof.proofId) : null,
    sourceCoordinateProofRef: readNonEmptyString(raw?.sourceCoordinateProofRef) ?? "unknown-geometry-proof",
    sourceEvidenceRef: readNonEmptyString(raw?.sourceEvidenceRef),
    sourceTargetRef: readNonEmptyString(raw?.sourceTargetRef),
    coordinateSpace: resolveCoordinateSpace(raw?.coordinateSpace ?? geometryProof?.normalizedCoordinateSpace, childCapabilityId),
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