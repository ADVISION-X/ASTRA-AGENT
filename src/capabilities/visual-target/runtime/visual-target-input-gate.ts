import type { ParsedVisualTargetAbilityInput, VisualTargetAbilityInput, VisualTargetChildCapabilityId, VisualTargetNature, VisualTargetType } from "../contract.js";
import type { VisualTargetProfilePort } from "../ports/visual-target-profile-port.js";
import { VisualTargetAbilityInputSchema } from "../schema.js";
import { getVisualTargetChildProfile } from "../shared/visual-target-policy.js";

type UnknownObject = Record<string, unknown>;

export type ResolvedVisualTargetProfile = ReturnType<typeof getVisualTargetChildProfile>;

export type VisualTargetExecutionSeed = {
  childCapabilityId: VisualTargetChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: string | null;
  inputRef: string;
  targetType: VisualTargetType;
  targetNature: VisualTargetNature;
  sourceScreenshotEvidenceId: string;
  sourceScreenshotProofRef: string;
  sourceAiResultRef: string | null;
  sourceAiProofRef: string | null;
  sourcePageStateProofRef: string;
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

export function parseVisualTargetAbilityInput(input: VisualTargetAbilityInput) {
  return VisualTargetAbilityInputSchema.safeParse(input);
}

export function resolveVisualTargetExecutionProfile(input: {
  request: ParsedVisualTargetAbilityInput;
  profilePort: VisualTargetProfilePort | null;
}) {
  const baseProfile = getVisualTargetChildProfile(input.request.childCapabilityId);
  const override = input.profilePort?.resolveProfileOverride({
    childCapabilityId: input.request.childCapabilityId,
  }) ?? null;

  return {
    ...baseProfile,
    minimumConfidence: override?.minimumConfidence ?? baseProfile.minimumConfidence,
    minimumAmbiguityGap: override?.minimumAmbiguityGap ?? baseProfile.minimumAmbiguityGap,
    freshnessTtlMs: override?.freshnessTtlMs ?? baseProfile.freshnessTtlMs,
  };
}

export function buildVisualTargetExecutionSeed(input: ParsedVisualTargetAbilityInput): VisualTargetExecutionSeed {
  return {
    childCapabilityId: input.childCapabilityId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceChildCapabilityId: input.sourceChildCapabilityId,
    inputRef: input.inputRef,
    targetType: input.targetType,
    targetNature: input.targetNature,
    sourceScreenshotEvidenceId: input.sourceProof.screenshot.screenshotEvidenceId,
    sourceScreenshotProofRef: input.sourceProof.screenshot.screenshotProofRef,
    sourceAiResultRef: input.sourceProof.ai?.aiResultRef ?? null,
    sourceAiProofRef: input.sourceProof.ai?.aiProofRef ?? null,
    sourcePageStateProofRef: input.sourceProof.pageState.pageStateProofRef,
  };
}

export function coerceVisualTargetFailureSeed(input: unknown): VisualTargetExecutionSeed {
  const raw = isObject(input) ? input : {};
  const sourceProof = isObject(raw.sourceProof) ? raw.sourceProof : {};
  const screenshot = isObject(sourceProof.screenshot) ? sourceProof.screenshot : {};
  const ai = isObject(sourceProof.ai) ? sourceProof.ai : {};
  const pageState = isObject(sourceProof.pageState) ? sourceProof.pageState : {};

  return {
    childCapabilityId: readString(raw.childCapabilityId, "detect-like-button") as VisualTargetChildCapabilityId,
    sessionId: readString(raw.sessionId, "visual-target:unknown-session"),
    roundId: readNullableString(raw.roundId),
    videoVisitId: readNullableString(raw.videoVisitId),
    sourceAbilityGroupId: readString(raw.sourceAbilityGroupId, "unknown-source-ability"),
    sourceChildCapabilityId: readNullableString(raw.sourceChildCapabilityId),
    inputRef: readString(raw.inputRef, "visual-target:unknown-input"),
    targetType: readString(raw.targetType, "like_button") as VisualTargetType,
    targetNature: readString(raw.targetNature, "action") as VisualTargetNature,
    sourceScreenshotEvidenceId: readString(screenshot.screenshotEvidenceId, "visual-target:unknown-evidence"),
    sourceScreenshotProofRef: readString(screenshot.screenshotProofRef, "visual-target:unknown-screenshot-proof"),
    sourceAiResultRef: readNullableString(ai.aiResultRef),
    sourceAiProofRef: readNullableString(ai.aiProofRef),
    sourcePageStateProofRef: readString(pageState.pageStateProofRef, "visual-target:unknown-page-state-proof"),
  };
}