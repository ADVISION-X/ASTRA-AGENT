import { createHash } from "node:crypto";

import type {
  MouseScrollBounds,
  MouseScrollChildCapabilityId,
  MouseScrollCoordinateSpace,
  MouseScrollDirection,
  MouseScrollMagnitude,
  MouseScrollSafetyPolicy,
} from "../contract.js";
import { MouseScrollAbilityInputSchema, MouseScrollSafetyPolicySchema } from "../schema.js";

type UnknownObject = { [key: string]: unknown };

type InvalidInputRefs = {
  receivedShapeHash: string;
  parseErrorRef: string;
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

type InvalidInputMetadata = Pick<
  MouseScrollFailureEnvelope,
  "roundId"
  | "videoVisitId"
  | "requestedBy"
  | "purpose"
  | "sourceAbilityGroupId"
  | "sourceChildCapabilityId"
  | "sourceCoordinateProofRef"
  | "sourceEvidenceRef"
  | "sourceTargetRef"
  | "regionRef"
>;

type InvalidInputGeometry = Pick<
  MouseScrollFailureEnvelope,
  "geometryGuardRef"
  | "geometryGuardProofRef"
  | "sourceCoordinateSpace"
  | "requestedAnchor"
>;

const isObject = (value: unknown): value is UnknownObject =>
  typeof value === "object" && value !== null;

const readNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const readFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const resolveChildCapabilityId = (value: unknown): MouseScrollChildCapabilityId => {
  if (value === "scroll-desktop-screen") {
    return "scroll-desktop-screen";
  }
  if (value === "scroll-region") {
    return "scroll-region";
  }
  return "scroll-browser-viewport";
};

const resolveCoordinateSpace = (value: unknown, childCapabilityId: MouseScrollChildCapabilityId): MouseScrollCoordinateSpace => {
  if (value === "desktopScreen" || childCapabilityId === "scroll-desktop-screen") {
    return "desktopScreen";
  }
  return "browserViewport";
};

const resolveDirection = (value: unknown): MouseScrollDirection =>
  value === "up" || value === "left" || value === "right" ? value : "down";

const resolveMagnitude = (value: unknown): MouseScrollMagnitude =>
  value === "small" || value === "halfPage" || value === "onePage" || value === "twoPages" || value === "customDelta"
    ? value
    : "onePage";

const readPoint = (value: unknown): { x: number; y: number } | null => {
  if (!isObject(value)) {
    return null;
  }
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  return x === null || y === null ? null : { x, y };
};

const readBounds = (value: unknown): MouseScrollBounds | null => {
  if (!isObject(value)) {
    return null;
  }
  const width = readFiniteNumber(value.width);
  const height = readFiniteNumber(value.height);
  return width === null || height === null || width <= 0 || height <= 0 ? null : { width, height };
};

const readRegion = (value: unknown): { x: number; y: number; width: number; height: number } | null => {
  if (!isObject(value)) {
    return null;
  }
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  const width = readFiniteNumber(value.width);
  const height = readFiniteNumber(value.height);
  return x === null || y === null || width === null || height === null || width <= 0 || height <= 0
    ? null
    : { x, y, width, height };
};

const stableHash = (prefix: string, value: unknown): string => {
  const serialized = (() => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  })();
  return `${prefix}:${createHash("sha256").update(serialized).digest("hex").slice(0, 18)}`;
};

const formatParseIssues = (input: unknown): string => {
  const parsed = MouseScrollAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return "Mouse Scroll rejected invalid input schema.";
  }
  return parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}:${issue.message}`).join(" | ");
};

const readGeometryProof = (raw: UnknownObject | null): UnknownObject | null =>
  raw && isObject(raw.geometryScrollProof) ? raw.geometryScrollProof : null;

const buildInvalidInputRefs = (input: unknown, raw: UnknownObject | null): InvalidInputRefs => ({
  receivedShapeHash: stableHash("mouse-scroll-input-shape", raw ?? input),
  parseErrorRef: stableHash("mouse-scroll-parse-error", formatParseIssues(input)),
});

const readInvalidInputMetadata = (raw: UnknownObject | null): InvalidInputMetadata => ({
  roundId: readNonEmptyString(raw?.roundId),
  videoVisitId: readNonEmptyString(raw?.videoVisitId),
  requestedBy: readNonEmptyString(raw?.requestedBy),
  purpose: readNonEmptyString(raw?.purpose),
  sourceAbilityGroupId: readNonEmptyString(raw?.sourceAbilityGroupId),
  sourceChildCapabilityId: readNonEmptyString(raw?.sourceChildCapabilityId),
  sourceCoordinateProofRef: readNonEmptyString(raw?.sourceCoordinateProofRef),
  sourceEvidenceRef: readNonEmptyString(raw?.sourceEvidenceRef),
  sourceTargetRef: readNonEmptyString(raw?.sourceTargetRef),
  regionRef: readNonEmptyString(raw?.regionRef),
});

const readInvalidInputGeometry = (geometryProof: UnknownObject | null): InvalidInputGeometry => {
  const sourceCoordinateSpace = geometryProof?.normalizedCoordinateSpace;
  return {
    geometryGuardRef: geometryProof ? readNonEmptyString(geometryProof.geometryGuardRef) : null,
    geometryGuardProofRef: geometryProof ? readNonEmptyString(geometryProof.proofId) : null,
    sourceCoordinateSpace: sourceCoordinateSpace === "desktopScreen" || sourceCoordinateSpace === "browserViewport"
      ? sourceCoordinateSpace
      : null,
    requestedAnchor: geometryProof ? readPoint(geometryProof.normalizedAnchorPoint) : null,
  };
};

const readRepeat = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;

const readSafetyPolicy = (raw: UnknownObject | null): MouseScrollSafetyPolicy => {
  const candidate = raw && isObject(raw.safetyPolicy) ? raw.safetyPolicy : undefined;
  const safetyPolicy = MouseScrollSafetyPolicySchema.safeParse(candidate);
  return safetyPolicy.success ? safetyPolicy.data : MouseScrollSafetyPolicySchema.parse(undefined);
};

export const buildInvalidInputFailureEnvelope = (
  input: unknown,
  defaultChildCapabilityId?: MouseScrollChildCapabilityId,
): MouseScrollFailureEnvelope => {
  const raw = isObject(input) ? input : null;
  const childCapabilityId = defaultChildCapabilityId ? defaultChildCapabilityId : resolveChildCapabilityId(raw?.childCapabilityId);
  const geometryProof = readGeometryProof(raw);
  const refs = buildInvalidInputRefs(input, raw);

  return {
    attemptRef: stableHash("mouse-scroll-attempt", [refs.receivedShapeHash, childCapabilityId]),
    inputRef: stableHash("mouse-scroll-input", [refs.receivedShapeHash, childCapabilityId]),
    childCapabilityId,
    sessionId: null,
    ...readInvalidInputMetadata(raw),
    ...readInvalidInputGeometry(geometryProof),
    parseErrorRef: refs.parseErrorRef,
    receivedShapeHash: refs.receivedShapeHash,
    coordinateSpace: resolveCoordinateSpace(raw?.coordinateSpace ?? geometryProof?.normalizedCoordinateSpace, childCapabilityId),
    region: readRegion(raw?.region),
    bounds: readBounds(raw?.bounds),
    direction: resolveDirection(raw?.direction),
    magnitude: resolveMagnitude(raw?.magnitude),
    repeat: readRepeat(raw?.repeat),
    safetyPolicy: readSafetyPolicy(raw),
  };
};
