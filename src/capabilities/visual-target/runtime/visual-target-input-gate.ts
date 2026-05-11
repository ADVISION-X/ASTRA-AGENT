import type { ParsedVisualTargetAbilityInput, VisualTargetAbilityInput, VisualTargetChildCapabilityId, VisualTargetNature, VisualTargetType } from "../contract.js";
import type { VisualTargetProfilePort } from "../ports/visual-target-profile-port.js";
import { VisualTargetAbilityInputSchema } from "../schema.js";
import { getVisualTargetChildProfile } from "../shared/visual-target-policy.js";
import {
  VISUAL_TARGET_CHILD_CAPABILITY_IDS,
  VISUAL_TARGET_NATURES,
  VISUAL_TARGET_TYPES,
  hashVisualTargetPayload,
} from "../shared/visual-target-types.js";

type UnknownObject = Record<string, unknown>;

export type ResolvedVisualTargetProfile = ReturnType<typeof getVisualTargetChildProfile>;

export type VisualTargetFailureTrace = {
  childCapabilityId: VisualTargetChildCapabilityId | null;
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
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  inputRef: string | null;
  targetType: VisualTargetType | null;
  targetNature: VisualTargetNature | null;
  receivedShapeHash: string;
};

function isObject(value: unknown): value is UnknownObject {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readKnownEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  return typeof value === "string" && allowed.includes(value as T[number])
    ? (value as T[number])
    : null;
}

export function parseVisualTargetAbilityInput(input: unknown) {
  return VisualTargetAbilityInputSchema.safeParse(input);
}

export function formatVisualTargetParseIssues(input: unknown): string {
  const parsed = VisualTargetAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return "Visual Target rejected invalid input schema.";
  }

  return parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "root"}:${issue.message}`)
    .join(" | ");
}

export function resolveVisualTargetExecutionProfile(input: {
  request: ParsedVisualTargetAbilityInput;
  profilePort: VisualTargetProfilePort | null;
}) {
  const baseProfile = getVisualTargetChildProfile(input.request.childCapabilityId);
  return baseProfile;
}

export function extractVisualTargetFailureTrace(input: unknown): VisualTargetFailureTrace {
  const raw = isObject(input) ? input : {};

  return {
    childCapabilityId: readKnownEnum(raw.childCapabilityId, VISUAL_TARGET_CHILD_CAPABILITY_IDS),
    missionId: readNullableString(raw.missionId),
    runId: readNullableString(raw.runId),
    sessionId: readNullableString(raw.sessionId),
    roundId: readNullableString(raw.roundId),
    videoVisitId: readNullableString(raw.videoVisitId),
    stepId: readNullableString(raw.stepId),
    bindingPackageId: readNullableString(raw.bindingPackageId),
    bindingPackageVersion: readNullableString(raw.bindingPackageVersion),
    selectedBindingId: readNullableString(raw.selectedBindingId),
    bindingVersion: readNullableString(raw.bindingVersion),
    bindingSnapshotRef: readNullableString(raw.bindingSnapshotRef),
    capabilityCallId: readNullableString(raw.capabilityCallId),
    nerveBusEnvelopeId: readNullableString(raw.nerveBusEnvelopeId),
    sourceAbilityGroupId: readNullableString(raw.sourceAbilityGroupId),
    sourceChildCapabilityId: readNullableString(raw.sourceChildCapabilityId),
    inputRef: readNullableString(raw.inputRef),
    targetType: readKnownEnum(raw.targetType, VISUAL_TARGET_TYPES),
    targetNature: readKnownEnum(raw.targetNature, VISUAL_TARGET_NATURES),
    receivedShapeHash: hashVisualTargetPayload(raw),
  };
}