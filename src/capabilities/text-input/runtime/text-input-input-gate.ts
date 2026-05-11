import type {
  ParsedTextInputAbilityInput,
  TextInputChildCapabilityId,
  TextInputCommitKey,
  TextInputKey,
  TextInputPolicy,
  TextInputSourceOwner,
  TextInputTargetKind,
} from "../contract.js";
import { TextInputAbilityInputSchema, TextInputPolicySchema } from "../schema.js";
import { buildStableTextInputRef } from "../shared/text-input-types.js";
import {
  buildTextInputExecutionSeed,
  type TextInputExecutionSeed,
  type TextInputFailureEnvelope,
  type TextInputResultSeed,
} from "./text-input-result-seed.js";

type UnknownObject = { [key: string]: unknown };

export { buildTextInputExecutionSeed };
export type { TextInputExecutionSeed, TextInputFailureEnvelope, TextInputResultSeed };

const TEXT_INPUT_ALLOWED_KEYS = new Set<TextInputKey | TextInputCommitKey>([
  "Tab",
  "Escape",
  "Backspace",
  "Delete",
  "L",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
]);

function isObject(value: unknown): value is UnknownObject {
  return typeof value === "object" && value !== null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function resolveChildCapabilityId(value: unknown): TextInputChildCapabilityId | null {
  return typeof value === "string" && [
    "type-text",
    "paste-text",
    "clear-input",
    "replace-input",
    "press-key",
    "press-navigation-key",
    "commit-input",
  ].includes(value)
    ? value as TextInputChildCapabilityId
    : null;
}

function resolveTargetKind(value: unknown): TextInputTargetKind | null {
  if (value === "textField" || value === "searchField" || value === "commentComposer" || value === "editableArea" || value === "feedSurface") {
    return value;
  }
  return null;
}

function resolveKey(value: unknown): TextInputKey | TextInputCommitKey | null {
  return typeof value === "string" && TEXT_INPUT_ALLOWED_KEYS.has(value as TextInputKey | TextInputCommitKey)
    ? (value as TextInputKey | TextInputCommitKey)
    : null;
}

function resolveSourceOwner(value: unknown): TextInputSourceOwner | null {
  return value === "commander-console"
    || value === "orchestration"
    || value === "ai"
    || value === "map-policy"
    || value === "human-approval"
    ? value
    : null;
}

function formatParseIssues(input: unknown): string {
  const parsed = TextInputAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return "Text Input rejected invalid input schema.";
  }

  return parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "root"}:${issue.message}`)
    .join(" | ");
}

export function parseTextInputAbilityInput(input: unknown):
  | { success: true; data: ParsedTextInputAbilityInput }
  | { success: false; statusMessage: string } {
  const parsed = TextInputAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return parsed;
  }

  return {
    success: false,
    statusMessage: `Text Input rejected invalid input schema. ${formatParseIssues(input)}`,
  };
}

function resolveFailureInputRef(raw: UnknownObject, receivedShapeHash: string, childCapabilityId: TextInputChildCapabilityId | null): string {
  return readNonEmptyString(raw.inputRef)
    ?? buildStableTextInputRef("text-input-input", [receivedShapeHash, childCapabilityId]);
}

function buildTextInputFailureChainFields(raw: UnknownObject): Pick<TextInputFailureEnvelope, "missionId" | "runId" | "stepId" | "bindingPackageId" | "bindingPackageVersion" | "selectedBindingId" | "bindingVersion" | "bindingActivationRef" | "bindingSnapshotRef" | "capabilityCallId" | "nerveBusEnvelopeId"> {
  return {
    missionId: readNonEmptyString(raw.missionId),
    runId: readNonEmptyString(raw.runId),
    stepId: readNonEmptyString(raw.stepId),
    bindingPackageId: readNonEmptyString(raw.bindingPackageId),
    bindingPackageVersion: readNonEmptyString(raw.bindingPackageVersion),
    selectedBindingId: readNonEmptyString(raw.selectedBindingId),
    bindingVersion: readNonEmptyString(raw.bindingVersion),
    bindingActivationRef: readNonEmptyString(raw.bindingActivationRef),
    bindingSnapshotRef: readNonEmptyString(raw.bindingSnapshotRef),
    capabilityCallId: readNonEmptyString(raw.capabilityCallId),
    nerveBusEnvelopeId: readNonEmptyString(raw.nerveBusEnvelopeId),
  };
}

function buildTextInputFailureIdentityFields(
  raw: UnknownObject,
  childCapabilityId: TextInputChildCapabilityId | null,
  receivedShapeHash: string,
): Pick<TextInputFailureEnvelope, "attemptRef" | "inputRef" | "childCapabilityId" | "missionId" | "runId" | "sessionId" | "roundId" | "videoVisitId" | "stepId" | "bindingPackageId" | "bindingPackageVersion" | "selectedBindingId" | "bindingVersion" | "bindingActivationRef" | "bindingSnapshotRef" | "capabilityCallId" | "nerveBusEnvelopeId" | "requestedBy" | "purpose" | "sourceAbilityGroupId" | "sourceChildCapabilityId" | "sourceOwner" | "sourceProofRef" | "sourceRef" | "idempotencyKey"> {
  const inputRef = resolveFailureInputRef(raw, receivedShapeHash, childCapabilityId);
  return {
    attemptRef: buildStableTextInputRef("text-input-attempt", [inputRef, readNonEmptyString(raw.idempotencyKey) ?? receivedShapeHash, childCapabilityId]),
    inputRef,
    childCapabilityId,
    ...buildTextInputFailureChainFields(raw),
    sessionId: readNonEmptyString(raw.sessionId),
    roundId: readNonEmptyString(raw.roundId),
    videoVisitId: readNonEmptyString(raw.videoVisitId),
    requestedBy: readNonEmptyString(raw.requestedBy),
    purpose: readNonEmptyString(raw.purpose),
    sourceAbilityGroupId: readNonEmptyString(raw.sourceAbilityGroupId),
    sourceChildCapabilityId: readNonEmptyString(raw.sourceChildCapabilityId),
    sourceOwner: resolveSourceOwner(raw.sourceOwner),
    sourceProofRef: readNonEmptyString(raw.sourceProofRef),
    sourceRef: readNonEmptyString(raw.sourceRef),
    idempotencyKey: readNonEmptyString(raw.idempotencyKey),
  };
}

function buildTextInputFailureContentFields(
  raw: UnknownObject,
  parseErrorText: string,
  policy: TextInputPolicy,
): Pick<TextInputFailureEnvelope, "inputText" | "inputTextRef" | "inputTextHash" | "approvedText" | "approvedTextRef" | "approvedTextHash" | "approvedTextSourceRef" | "approvedTextApprovalRef" | "approvedCommitRef" | "inputTargetRef" | "targetRef" | "targetProofRef" | "targetProofOwner" | "targetKind" | "targetEvidenceRefs" | "focusProofRef" | "focusProofOwner" | "focusVerifiedAt" | "geometryGuardProofRef" | "mouseClickProofRef" | "postActionFocusVerificationRef" | "operatorApprovalRef" | "humanApprovalRef" | "mapPolicyApprovalRef" | "key" | "policy" | "parseErrorRef"> {
  return {
    inputText: typeof raw.inputText === "string" ? raw.inputText : null,
    inputTextRef: readNonEmptyString(raw.inputTextRef),
    inputTextHash: readNonEmptyString(raw.inputTextHash),
    approvedText: typeof raw.approvedText === "string" ? raw.approvedText : null,
    approvedTextRef: readNonEmptyString(raw.approvedTextRef),
    approvedTextHash: readNonEmptyString(raw.approvedTextHash),
    approvedTextSourceRef: readNonEmptyString(raw.approvedTextSourceRef),
    approvedTextApprovalRef: readNonEmptyString(raw.approvedTextApprovalRef),
    approvedCommitRef: readNonEmptyString(raw.approvedCommitRef),
    inputTargetRef: readNonEmptyString(raw.inputTargetRef),
    targetRef: readNonEmptyString(raw.targetRef),
    targetProofRef: readNonEmptyString(raw.targetProofRef),
    targetProofOwner: readNonEmptyString(raw.targetProofOwner),
    targetKind: resolveTargetKind(raw.targetKind),
    targetEvidenceRefs: Array.isArray(raw.targetEvidenceRefs)
      ? raw.targetEvidenceRefs.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [],
    focusProofRef: readNonEmptyString(raw.focusProofRef),
    focusProofOwner: readNonEmptyString(raw.focusProofOwner),
    focusVerifiedAt: readNonEmptyString(raw.focusVerifiedAt),
    geometryGuardProofRef: readNonEmptyString(raw.geometryGuardProofRef),
    mouseClickProofRef: readNonEmptyString(raw.mouseClickProofRef),
    postActionFocusVerificationRef: readNonEmptyString(raw.postActionFocusVerificationRef),
    operatorApprovalRef: readNonEmptyString(raw.operatorApprovalRef),
    humanApprovalRef: readNonEmptyString(raw.humanApprovalRef),
    mapPolicyApprovalRef: readNonEmptyString(raw.mapPolicyApprovalRef),
    key: resolveKey(raw.key),
    policy,
    parseErrorRef: buildStableTextInputRef("text-input-parse-error", parseErrorText),
  };
}

function buildInvalidInputFailureEnvelope(input: unknown, fallbackChildCapabilityId?: TextInputChildCapabilityId): TextInputFailureEnvelope {
  const raw = isObject(input) ? input : {};
  const childCapabilityId = fallbackChildCapabilityId ?? resolveChildCapabilityId(raw.childCapabilityId);
  const parseErrorText = formatParseIssues(input);
  const receivedShapeHash = buildStableTextInputRef("text-input-input-shape", raw);
  const parsedPolicy = TextInputPolicySchema.safeParse(raw.policy);

  return {
    ...buildTextInputFailureIdentityFields(raw, childCapabilityId, receivedShapeHash),
    ...buildTextInputFailureContentFields(raw, parseErrorText, parsedPolicy.success ? parsedPolicy.data : TextInputPolicySchema.parse({})),
    receivedShapeHash,
  };
}

export function resolveTextInputFailureSeed(input: unknown, fallbackChildCapabilityId?: TextInputChildCapabilityId): TextInputResultSeed {
  const parsed = TextInputAbilityInputSchema.safeParse(input);
  if (parsed.success) {
    return buildTextInputExecutionSeed(parsed.data);
  }

  return buildInvalidInputFailureEnvelope(input, fallbackChildCapabilityId);
}