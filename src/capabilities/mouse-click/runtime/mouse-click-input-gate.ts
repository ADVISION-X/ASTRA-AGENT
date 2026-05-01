import { createHash } from "node:crypto";

import type { MouseClickAbilityInput, MouseClickButton, MouseClickChildCapabilityId, MouseClickCoordinateSpace, MouseClickCount, MouseClickSafetyPolicy, ParsedMouseClickAbilityInput } from "../contract.js";
import { MouseClickAbilityInputSchema, MouseClickSafetyPolicySchema } from "../schema.js";

type UnknownObject = { [key: string]: unknown };

export type MouseClickExecutionSeed = {
  attemptRef: string;
  inputRef: string;
  childCapabilityId: MouseClickChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string;
  purpose: string;
  geometryGuardRef: string | null;
  geometryGuardProofRef: string | null;
  sourceCoordinateProofRef: string | null;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string | null;
  parseErrorRef: string | null;
  receivedShapeHash: string | null;
  coordinateSpace: MouseClickCoordinateSpace;
  sourceCoordinateSpace: MouseClickCoordinateSpace | null;
  requestedCoordinate: { x: number; y: number } | null;
  sourceBounds: { width: number; height: number } | null;
  targetBounds: { width: number; height: number } | null;
  button: MouseClickButton;
  clickCount: MouseClickCount;
  safetyPolicy: MouseClickSafetyPolicy;
};

export type MouseClickFailureEnvelope = {
  attemptRef: string;
  inputRef: string;
  childCapabilityId: MouseClickChildCapabilityId;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string | null;
  purpose: string | null;
  geometryGuardRef: string | null;
  geometryGuardProofRef: string | null;
  sourceCoordinateProofRef: string | null;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string | null;
  parseErrorRef: string | null;
  receivedShapeHash: string | null;
  coordinateSpace: MouseClickCoordinateSpace;
  sourceCoordinateSpace: MouseClickCoordinateSpace | null;
  requestedCoordinate: { x: number; y: number } | null;
  sourceBounds: { width: number; height: number } | null;
  targetBounds: { width: number; height: number } | null;
  button: MouseClickButton;
  clickCount: MouseClickCount;
  safetyPolicy: MouseClickSafetyPolicy;
};

export type MouseClickResultSeed = MouseClickExecutionSeed | MouseClickFailureEnvelope;

function isObject(value: unknown): value is UnknownObject {
  return typeof value === "object" && value !== null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBounds(value: unknown): { width: number; height: number } | null {
  if (!isObject(value)) {
    return null;
  }
  const width = readFiniteNumber(value.width);
  const height = readFiniteNumber(value.height);
  return width === null || height === null ? null : { width, height };
}

function readCoordinate(value: unknown): { x: number; y: number } | null {
  if (!isObject(value)) {
    return null;
  }
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  return x === null || y === null ? null : { x, y };
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

function resolveSourceCoordinateSpace(value: unknown): MouseClickCoordinateSpace | null {
  return value === "desktopScreen" || value === "browserViewport" ? value : null;
}

function resolveButton(value: unknown): MouseClickButton {
  return value === "right" ? "right" : "left";
}

function resolveClickCount(value: unknown): MouseClickCount {
  return value === 2 ? 2 : 1;
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
  const parsed = MouseClickAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return "Mouse Click rejected invalid input schema.";
  }

  return parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "root"}:${issue.message}`)
    .join(" | ");
}

export function parseMouseClickAbilityInput(input: MouseClickAbilityInput | unknown):
  | { success: true; data: ParsedMouseClickAbilityInput }
  | { success: false; statusMessage: string } {
  const parsed = MouseClickAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return parsed;
  }
  return {
    success: false,
    statusMessage: `Mouse Click rejected invalid input schema. ${formatParseIssues(input)}`,
  };
}

export function buildMouseClickExecutionSeed(input: ParsedMouseClickAbilityInput): MouseClickExecutionSeed {
  const inputRef = stableHash("mouse-click-input", [
    input.sessionId,
    input.childCapabilityId,
    input.sourceCoordinateProofRef,
    input.purpose,
    input.geometryGuardProof.proofId,
  ]);

  return {
    attemptRef: stableHash("mouse-click-attempt", [inputRef, input.requestedBy]),
    inputRef,
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
    parseErrorRef: null,
    receivedShapeHash: null,
    coordinateSpace: input.geometryGuardProof.normalizedCoordinateSpace,
    sourceCoordinateSpace: input.geometryGuardProof.normalizedCoordinateSpace,
    requestedCoordinate: input.geometryGuardProof.normalizedClickPoint,
    sourceBounds: input.geometryGuardProof.sourceBounds,
    targetBounds: input.bounds,
    button: input.button,
    clickCount: input.clickCount,
    safetyPolicy: input.safetyPolicy,
  };
}

function readFailureEnvelopeGeometry(raw: UnknownObject | null, childCapabilityId: MouseClickChildCapabilityId) {
  const geometryProof = raw && isObject(raw.geometryGuardProof) ? raw.geometryGuardProof : null;
  return {
    geometryProof,
    coordinateSpace: resolveCoordinateSpace(geometryProof?.normalizedCoordinateSpace, childCapabilityId),
    requestedCoordinate: readCoordinate(geometryProof?.normalizedClickPoint),
    targetBounds: readBounds(raw?.bounds),
    sourceBounds: readBounds(geometryProof?.sourceBounds),
  };
}

function readFailureEnvelopeRaw(input: unknown, fallbackChildCapabilityId?: MouseClickChildCapabilityId) {
  const raw = isObject(input) ? input : null;
  const childCapabilityId = fallbackChildCapabilityId ?? resolveChildCapabilityId(raw?.childCapabilityId);
  const safetyPolicy = MouseClickSafetyPolicySchema.safeParse(raw && isObject(raw.safetyPolicy) ? raw.safetyPolicy : undefined);
  const geometryState = readFailureEnvelopeGeometry(raw, childCapabilityId);
  const receivedShapeHash = stableHash("mouse-click-input-shape", raw ?? input);
  const parseErrorRef = stableHash("mouse-click-parse-error", formatParseIssues(input));

  return {
    raw,
    childCapabilityId,
    ...geometryState,
    safetyPolicy,
    receivedShapeHash,
    parseErrorRef,
  };
}

function buildFailureEnvelopeIdentity(rawState: ReturnType<typeof readFailureEnvelopeRaw>) {
  return {
    attemptRef: stableHash("mouse-click-attempt", [rawState.receivedShapeHash, rawState.childCapabilityId]),
    inputRef: stableHash("mouse-click-input", [rawState.receivedShapeHash, rawState.childCapabilityId]),
    childCapabilityId: rawState.childCapabilityId,
    sessionId: null,
    roundId: readNonEmptyString(rawState.raw?.roundId),
    videoVisitId: readNonEmptyString(rawState.raw?.videoVisitId),
    requestedBy: readNonEmptyString(rawState.raw?.requestedBy),
    purpose: readNonEmptyString(rawState.raw?.purpose),
    geometryGuardRef: rawState.geometryProof ? readNonEmptyString(rawState.geometryProof.geometryGuardRef) : null,
    geometryGuardProofRef: rawState.geometryProof ? readNonEmptyString(rawState.geometryProof.proofId) : null,
    sourceCoordinateProofRef: readNonEmptyString(rawState.raw?.sourceCoordinateProofRef),
    sourceAbilityGroupId: rawState.geometryProof ? readNonEmptyString(rawState.geometryProof.sourceAbilityGroupId) : null,
    sourceChildCapabilityId: rawState.geometryProof ? readNonEmptyString(rawState.geometryProof.sourceChildCapabilityId) : null,
    sourceEvidenceRef: readNonEmptyString(rawState.raw?.sourceEvidenceRef),
    sourceTargetRef: readNonEmptyString(rawState.raw?.sourceTargetRef),
    parseErrorRef: rawState.parseErrorRef,
    receivedShapeHash: rawState.receivedShapeHash,
  };
}

function buildFailureEnvelopeRuntime(rawState: ReturnType<typeof readFailureEnvelopeRaw>) {
  return {
    coordinateSpace: rawState.coordinateSpace,
    sourceCoordinateSpace: resolveSourceCoordinateSpace(rawState.geometryProof?.normalizedCoordinateSpace),
    requestedCoordinate: rawState.requestedCoordinate,
    sourceBounds: rawState.sourceBounds,
    targetBounds: rawState.targetBounds,
    button: resolveButton(rawState.raw?.button),
    clickCount: resolveClickCount(rawState.raw?.clickCount),
    safetyPolicy: rawState.safetyPolicy.success ? rawState.safetyPolicy.data : MouseClickSafetyPolicySchema.parse(undefined),
  };
}

export function buildInvalidInputFailureEnvelope(input: unknown, fallbackChildCapabilityId?: MouseClickChildCapabilityId): MouseClickFailureEnvelope {
  const rawState = readFailureEnvelopeRaw(input, fallbackChildCapabilityId);

  return {
    ...buildFailureEnvelopeIdentity(rawState),
    ...buildFailureEnvelopeRuntime(rawState),
  };
}

export function resolveMouseClickFailureSeed(input: unknown, fallbackChildCapabilityId?: MouseClickChildCapabilityId): MouseClickResultSeed {
  const parsed = MouseClickAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return buildMouseClickExecutionSeed(parsed.data);
  }

  return buildInvalidInputFailureEnvelope(input, fallbackChildCapabilityId);
}