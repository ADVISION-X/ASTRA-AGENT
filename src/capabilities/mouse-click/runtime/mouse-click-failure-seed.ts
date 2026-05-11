import { createHash } from "node:crypto";

import type {
  MouseClickButton,
  MouseClickChildCapabilityId,
  MouseClickCoordinateSpace,
  MouseClickCount,
  MouseClickSafetyPolicy,
} from "../contract.js";
import { MouseClickAbilityInputSchema, MouseClickSafetyPolicySchema } from "../schema.js";

type UnknownObject = { [key: string]: unknown };

type RawFailureState = {
  raw: UnknownObject | null;
  childCapabilityId: MouseClickChildCapabilityId;
  geometryProof: UnknownObject | null;
  coordinateSpace: MouseClickCoordinateSpace;
  requestedCoordinate: { x: number; y: number } | null;
  sourceBounds: { width: number; height: number } | null;
  targetBounds: { width: number; height: number } | null;
  safetyPolicy: ReturnType<typeof MouseClickSafetyPolicySchema.safeParse>;
  receivedShapeHash: string;
  parseErrorRef: string;
};

export type MouseClickFailureEnvelope = {
  attemptRef: string;
  inputRef: string;
  childCapabilityId: MouseClickChildCapabilityId;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  missionId: string | null;
  runId: string | null;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string | null;
  bindingPackageId: string | null;
  bindingPackageVersion: string | null;
  selectedBindingId: string | null;
  bindingVersion: string | null;
  bindingSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  requestedBy: string | null;
  purpose: string | null;
  sourceRef: string | null;
  geometryGuardRef: string | null;
  geometryGuardProofRef: string | null;
  geometryGuardOutputRef: string | null;
  geometryGuardRuntimeProofRef: string | null;
  sourceCoordinateProofRef: string | null;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string | null;
  sourceVisualTargetResultRef: string | null;
  parseErrorRef: string | null;
  receivedShapeHash: string | null;
  coordinateSpace: MouseClickCoordinateSpace;
  sourceCoordinateSpace: MouseClickCoordinateSpace | null;
  requestedCoordinate: { x: number; y: number } | null;
  sourceBounds: { width: number; height: number } | null;
  targetBounds: { width: number; height: number } | null;
  button: MouseClickButton;
  clickCount: MouseClickCount;
  timeoutMs: number | null;
  safetyPolicy: MouseClickSafetyPolicy;
};

const isObject = (value: unknown): value is UnknownObject =>
  typeof value === "object" && value !== null;

const readNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const readFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readBounds = (value: unknown): { width: number; height: number } | null => {
  if (!isObject(value)) {
    return null;
  }
  const width = readFiniteNumber(value.width);
  const height = readFiniteNumber(value.height);
  return width === null || height === null ? null : { width, height };
};

const readCoordinate = (value: unknown): { x: number; y: number } | null => {
  if (!isObject(value)) {
    return null;
  }
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  return x === null || y === null ? null : { x, y };
};

const readObjectString = (value: UnknownObject | null, key: string): string | null =>
  value ? readNonEmptyString(value[key]) : null;

const resolveChildCapabilityId = (value: unknown): MouseClickChildCapabilityId =>
  value === "click-desktop-coordinate" ? "click-desktop-coordinate" : "click-browser-coordinate";

const resolveCoordinateSpace = (value: unknown, childCapabilityId: MouseClickChildCapabilityId): MouseClickCoordinateSpace => {
  if (value === "desktopScreen") {
    return "desktopScreen";
  }
  return childCapabilityId === "click-desktop-coordinate" ? "desktopScreen" : "browserViewport";
};

const resolveSourceCoordinateSpace = (value: unknown): MouseClickCoordinateSpace | null =>
  value === "desktopScreen" || value === "browserViewport" ? value : null;

const resolveButton = (value: unknown): MouseClickButton =>
  value === "right" ? "right" : "left";

const resolveClickCount = (value: unknown): MouseClickCount =>
  value === 2 ? 2 : 1;

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
  const parsed = MouseClickAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return "Mouse Click rejected invalid input schema.";
  }

  return parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "root"}:${issue.message}`)
    .join(" | ");
};

const readFailureEnvelopeGeometry = (raw: UnknownObject | null, childCapabilityId: MouseClickChildCapabilityId) => {
  const geometryProof = raw && isObject(raw.geometryGuardProof) ? raw.geometryGuardProof : null;
  return {
    geometryProof,
    coordinateSpace: resolveCoordinateSpace(geometryProof?.normalizedCoordinateSpace, childCapabilityId),
    requestedCoordinate: readCoordinate(geometryProof?.normalizedClickPoint),
    targetBounds: readBounds(raw?.bounds),
    sourceBounds: readBounds(geometryProof?.sourceBounds),
  };
};

const readFailureEnvelopeRaw = (input: unknown, fallbackChildCapabilityId?: MouseClickChildCapabilityId): RawFailureState => {
  const raw = isObject(input) ? input : null;
  const childCapabilityId = fallbackChildCapabilityId ?? resolveChildCapabilityId(raw?.childCapabilityId);
  const safetyPolicy = MouseClickSafetyPolicySchema.safeParse(raw && isObject(raw.safetyPolicy) ? raw.safetyPolicy : undefined);
  const geometryState = readFailureEnvelopeGeometry(raw, childCapabilityId);
  return {
    raw,
    childCapabilityId,
    ...geometryState,
    safetyPolicy,
    receivedShapeHash: stableHash("mouse-click-input-shape", raw ?? input),
    parseErrorRef: stableHash("mouse-click-parse-error", formatParseIssues(input)),
  };
};

const buildFailureEnvelopeChainFields = (rawState: RawFailureState) => {
  const proof = rawState.geometryProof;
  return {
    sourceAbilityGroupId: readNonEmptyString(rawState.raw?.sourceAbilityGroupId) ?? readObjectString(proof, "sourceAbilityGroupId"),
    sourceChildCapabilityId: readNonEmptyString(rawState.raw?.sourceChildCapabilityId) ?? readObjectString(proof, "sourceChildCapabilityId"),
    missionId: readNonEmptyString(rawState.raw?.missionId) ?? readObjectString(proof, "missionId"),
    runId: readNonEmptyString(rawState.raw?.runId) ?? readObjectString(proof, "runId"), sessionId: readNonEmptyString(rawState.raw?.sessionId) ?? readObjectString(proof, "sessionId"),
    roundId: readNonEmptyString(rawState.raw?.roundId), videoVisitId: readNonEmptyString(rawState.raw?.videoVisitId),
    stepId: readNonEmptyString(rawState.raw?.stepId) ?? readObjectString(proof, "stepId"), bindingPackageId: readNonEmptyString(rawState.raw?.bindingPackageId) ?? readObjectString(proof, "bindingPackageId"),
    bindingPackageVersion: readNonEmptyString(rawState.raw?.bindingPackageVersion) ?? readObjectString(proof, "bindingPackageVersion"),
    selectedBindingId: readNonEmptyString(rawState.raw?.selectedBindingId) ?? readObjectString(proof, "selectedBindingId"),
    bindingVersion: readNonEmptyString(rawState.raw?.bindingVersion) ?? readObjectString(proof, "bindingVersion"),
    bindingSnapshotRef: readNonEmptyString(rawState.raw?.bindingSnapshotRef) ?? readObjectString(proof, "bindingSnapshotRef"),
    capabilityCallId: readNonEmptyString(rawState.raw?.capabilityCallId) ?? readObjectString(proof, "capabilityCallId"),
    nerveBusEnvelopeId: readNonEmptyString(rawState.raw?.nerveBusEnvelopeId) ?? readObjectString(proof, "nerveBusEnvelopeId"),
    requestedBy: readNonEmptyString(rawState.raw?.requestedBy), purpose: readNonEmptyString(rawState.raw?.purpose), sourceRef: readNonEmptyString(rawState.raw?.sourceRef),
  };
};

const buildFailureEnvelopeGuardFields = (rawState: RawFailureState) => {
  const proof = rawState.geometryProof;
  return {
    geometryGuardRef: readNonEmptyString(rawState.raw?.geometryGuardRef) ?? readObjectString(proof, "geometryGuardRef"),
    geometryGuardProofRef: readNonEmptyString(rawState.raw?.sourceCoordinateProofRef) ?? readObjectString(proof, "proofId"),
    geometryGuardOutputRef: readNonEmptyString(rawState.raw?.geometryGuardOutputRef) ?? readObjectString(proof, "outputRef"),
    geometryGuardRuntimeProofRef: readNonEmptyString(rawState.raw?.geometryGuardRuntimeProofRef) ?? readObjectString(proof, "runtimeProofRef"),
    sourceCoordinateProofRef: readNonEmptyString(rawState.raw?.sourceCoordinateProofRef), sourceEvidenceRef: readNonEmptyString(rawState.raw?.sourceEvidenceRef),
    sourceTargetRef: readNonEmptyString(rawState.raw?.sourceTargetRef) ?? readObjectString(proof, "sourceTargetRef"),
    sourceVisualTargetResultRef: readNonEmptyString(rawState.raw?.sourceVisualTargetResultRef) ?? readObjectString(proof, "sourceVisualTargetResultRef"),
    parseErrorRef: rawState.parseErrorRef, receivedShapeHash: rawState.receivedShapeHash,
  };
};

const buildFailureEnvelopeIdentity = (rawState: RawFailureState) => {
  const inputRef = readNonEmptyString(rawState.raw?.inputRef)
    ?? stableHash("mouse-click-input", [rawState.receivedShapeHash, rawState.childCapabilityId]);

  return {
    attemptRef: stableHash("mouse-click-attempt", [inputRef, readNonEmptyString(rawState.raw?.capabilityCallId), rawState.childCapabilityId]),
    inputRef,
    childCapabilityId: rawState.childCapabilityId,
    ...buildFailureEnvelopeChainFields(rawState),
    ...buildFailureEnvelopeGuardFields(rawState),
  };
};

const buildFailureEnvelopeRuntime = (rawState: RawFailureState) => {
  const safetyPolicy = rawState.safetyPolicy.success ? rawState.safetyPolicy.data : MouseClickSafetyPolicySchema.parse(undefined);
  return {
    coordinateSpace: rawState.coordinateSpace,
    sourceCoordinateSpace: resolveSourceCoordinateSpace(rawState.geometryProof?.normalizedCoordinateSpace),
    requestedCoordinate: rawState.requestedCoordinate,
    sourceBounds: rawState.sourceBounds,
    targetBounds: rawState.targetBounds,
    button: resolveButton(rawState.raw?.button),
    clickCount: resolveClickCount(rawState.raw?.clickCount),
    timeoutMs: readFiniteNumber(rawState.raw?.timeoutMs) ?? safetyPolicy.primitiveTimeoutMs,
    safetyPolicy,
  };
};

export const buildInvalidInputFailureEnvelope = (
  input: unknown,
  fallbackChildCapabilityId?: MouseClickChildCapabilityId,
): MouseClickFailureEnvelope => {
  const rawState = readFailureEnvelopeRaw(input, fallbackChildCapabilityId);

  return {
    ...buildFailureEnvelopeIdentity(rawState),
    ...buildFailureEnvelopeRuntime(rawState),
  };
};