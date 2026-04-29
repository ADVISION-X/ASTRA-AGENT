import type { MouseClickAbilityInput, MouseClickButton, MouseClickChildCapabilityId, MouseClickCoordinateSpace, MouseClickCount, MouseClickSafetyPolicy, ParsedMouseClickAbilityInput } from "../contract.js";
import { MouseClickAbilityInputSchema, MouseClickSafetyPolicySchema } from "../schema.js";

type UnknownObject = { [key: string]: unknown };

export type MouseClickExecutionSeed = {
  childCapabilityId: MouseClickChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string;
  purpose: string;
  geometryGuardRef: string | null;
  geometryGuardProofRef: string | null;
  sourceCoordinateProofRef: string | null;
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: string | null;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string | null;
  coordinateSpace: MouseClickCoordinateSpace;
  requestedCoordinate: { x: number; y: number } | null;
  bounds: { width: number; height: number } | null;
  button: MouseClickButton;
  clickCount: MouseClickCount;
  safetyPolicy: MouseClickSafetyPolicy;
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

function resolveChildCapabilityId(value: unknown): MouseClickChildCapabilityId {
  return value === "click-desktop-coordinate" ? "click-desktop-coordinate" : "click-browser-coordinate";
}

function resolveCoordinateSpace(value: unknown, childCapabilityId: MouseClickChildCapabilityId): MouseClickCoordinateSpace {
  if (value === "desktopScreen") {
    return "desktopScreen";
  }
  return childCapabilityId === "click-desktop-coordinate" ? "desktopScreen" : "browserViewport";
}

function resolveButton(value: unknown): MouseClickButton {
  return value === "right" ? "right" : "left";
}

function resolveClickCount(value: unknown): MouseClickCount {
  return value === 2 ? 2 : 1;
}

export function parseMouseClickAbilityInput(input: MouseClickAbilityInput) {
  return MouseClickAbilityInputSchema.safeParse(input);
}

export function buildMouseClickExecutionSeed(input: ParsedMouseClickAbilityInput): MouseClickExecutionSeed {
  return {
    childCapabilityId: input.childCapabilityId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    requestedBy: input.requestedBy,
    purpose: input.purpose,
    geometryGuardRef: input.geometryGuardProof.geometryGuardRef,
    geometryGuardProofRef: input.geometryGuardProof.proofId,
    sourceCoordinateProofRef: input.sourceCoordinateProofRef,
    sourceAbilityGroupId: input.geometryGuardProof.sourceAbilityGroupId,
    sourceChildCapabilityId: input.geometryGuardProof.sourceChildCapabilityId,
    sourceEvidenceRef: input.sourceEvidenceRef,
    sourceTargetRef: input.sourceTargetRef,
    coordinateSpace: input.geometryGuardProof.normalizedCoordinateSpace,
    requestedCoordinate: input.geometryGuardProof.normalizedClickPoint,
    bounds: input.bounds,
    button: input.button,
    clickCount: input.clickCount,
    safetyPolicy: input.safetyPolicy,
  };
}

export function coerceMouseClickFailureSeed(input: unknown): MouseClickExecutionSeed {
  const raw = isObject(input) ? input : null;
  const childCapabilityId = resolveChildCapabilityId(raw?.childCapabilityId);
  const geometryProof = raw && isObject(raw.geometryGuardProof) ? raw.geometryGuardProof : null;
  const safetyPolicy = MouseClickSafetyPolicySchema.safeParse(raw && isObject(raw.safetyPolicy) ? raw.safetyPolicy : undefined);
  const coordinateSpace = resolveCoordinateSpace(geometryProof?.normalizedCoordinateSpace, childCapabilityId);
  const requestedX = geometryProof ? readFiniteNumber(geometryProof.normalizedClickPoint && isObject(geometryProof.normalizedClickPoint) ? geometryProof.normalizedClickPoint.x : null) : null;
  const requestedY = geometryProof ? readFiniteNumber(geometryProof.normalizedClickPoint && isObject(geometryProof.normalizedClickPoint) ? geometryProof.normalizedClickPoint.y : null) : null;
  const boundsWidth = raw && isObject(raw.bounds) ? readFiniteNumber(raw.bounds.width) : null;
  const boundsHeight = raw && isObject(raw.bounds) ? readFiniteNumber(raw.bounds.height) : null;

  return {
    childCapabilityId,
    sessionId: readNonEmptyString(raw?.sessionId) ?? "unknown-session",
    roundId: readNonEmptyString(raw?.roundId),
    videoVisitId: readNonEmptyString(raw?.videoVisitId),
    requestedBy: readNonEmptyString(raw?.requestedBy) ?? "unknown-requester",
    purpose: readNonEmptyString(raw?.purpose) ?? "unknown-purpose",
    geometryGuardRef: geometryProof ? readNonEmptyString(geometryProof.geometryGuardRef) : null,
    geometryGuardProofRef: geometryProof ? readNonEmptyString(geometryProof.proofId) : null,
    sourceCoordinateProofRef: readNonEmptyString(raw?.sourceCoordinateProofRef),
    sourceAbilityGroupId: geometryProof ? (readNonEmptyString(geometryProof.sourceAbilityGroupId) ?? "unknown-source-ability-group") : "unknown-source-ability-group",
    sourceChildCapabilityId: geometryProof ? readNonEmptyString(geometryProof.sourceChildCapabilityId) : null,
    sourceEvidenceRef: readNonEmptyString(raw?.sourceEvidenceRef),
    sourceTargetRef: readNonEmptyString(raw?.sourceTargetRef),
    coordinateSpace,
    requestedCoordinate: requestedX === null || requestedY === null ? null : { x: requestedX, y: requestedY },
    bounds: boundsWidth === null || boundsHeight === null ? null : { width: boundsWidth, height: boundsHeight },
    button: resolveButton(raw?.button),
    clickCount: resolveClickCount(raw?.clickCount),
    safetyPolicy: safetyPolicy.success ? safetyPolicy.data : MouseClickSafetyPolicySchema.parse(undefined),
  };
}