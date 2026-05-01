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

type UnknownObject = { [key: string]: unknown };

const TEXT_INPUT_ALLOWED_KEYS = new Set<TextInputKey | TextInputCommitKey>([
  "Tab",
  "Escape",
  "Backspace",
  "Delete",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
]);

export type TextInputExecutionSeed = {
  attemptRef: string;
  inputRef: string;
  childCapabilityId: TextInputChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string;
  purpose: string;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  sourceOwner: TextInputSourceOwner | null;
  sourceProofRef: string | null;
  inputText: string | null;
  inputTextRef: string | null;
  inputTextHash: string | null;
  approvedText: string | null;
  approvedTextRef: string | null;
  approvedTextHash: string | null;
  approvedCommitRef: string | null;
  targetRef: string;
  targetProofRef: string;
  targetProofOwner: string;
  targetKind: TextInputTargetKind;
  targetEvidenceRefs: string[];
  focusProofRef: string;
  focusProofOwner: string;
  focusVerifiedAt: string;
  geometryGuardProofRef: string | null;
  mouseClickProofRef: string | null;
  postActionFocusVerificationRef: string;
  operatorApprovalRef: string | null;
  humanApprovalRef: string | null;
  mapPolicyApprovalRef: string | null;
  key: TextInputKey | TextInputCommitKey | null;
  policy: TextInputPolicy;
  parseErrorRef: string | null;
  receivedShapeHash: string | null;
};

export type TextInputFailureEnvelope = {
  attemptRef: string;
  inputRef: string;
  childCapabilityId: TextInputChildCapabilityId | null;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string | null;
  purpose: string | null;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  sourceOwner: TextInputSourceOwner | null;
  sourceProofRef: string | null;
  inputText: string | null;
  inputTextRef: string | null;
  inputTextHash: string | null;
  approvedText: string | null;
  approvedTextRef: string | null;
  approvedTextHash: string | null;
  approvedCommitRef: string | null;
  targetRef: string | null;
  targetProofRef: string | null;
  targetProofOwner: string | null;
  targetKind: TextInputTargetKind | null;
  targetEvidenceRefs: string[];
  focusProofRef: string | null;
  focusProofOwner: string | null;
  focusVerifiedAt: string | null;
  geometryGuardProofRef: string | null;
  mouseClickProofRef: string | null;
  postActionFocusVerificationRef: string | null;
  operatorApprovalRef: string | null;
  humanApprovalRef: string | null;
  mapPolicyApprovalRef: string | null;
  key: TextInputKey | TextInputCommitKey | null;
  policy: TextInputPolicy;
  parseErrorRef: string | null;
  receivedShapeHash: string | null;
};

export type TextInputResultSeed = TextInputExecutionSeed | TextInputFailureEnvelope;

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
    "commit-input",
  ].includes(value)
    ? value as TextInputChildCapabilityId
    : null;
}

function resolveTargetKind(value: unknown): TextInputTargetKind | null {
  if (value === "textField" || value === "searchField" || value === "commentComposer" || value === "editableArea") {
    return value;
  }
  return null;
}

function resolveKey(value: unknown): TextInputKey | TextInputCommitKey | null {
  return typeof value === "string" && TEXT_INPUT_ALLOWED_KEYS.has(value as TextInputKey | TextInputCommitKey) ? value : null;
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

export function buildTextInputExecutionSeed(input: ParsedTextInputAbilityInput): TextInputExecutionSeed {
  const inputRef = buildStableTextInputRef("text-input-input", [
    input.sessionId,
    input.childCapabilityId,
    input.targetRef,
    input.inputTextRef,
    input.approvedTextRef,
    input.key,
    input.purpose,
  ]);

  return {
    attemptRef: buildStableTextInputRef("text-input-attempt", [inputRef, input.requestedBy]),
    inputRef,
    ...input,
    parseErrorRef: null,
    receivedShapeHash: null,
  };
}

function buildTextInputFailureIdentityFields(
  raw: UnknownObject,
  childCapabilityId: TextInputChildCapabilityId | null,
  receivedShapeHash: string,
): Pick<TextInputFailureEnvelope, "attemptRef" | "inputRef" | "childCapabilityId" | "sessionId" | "roundId" | "videoVisitId" | "requestedBy" | "purpose" | "sourceAbilityGroupId" | "sourceChildCapabilityId" | "sourceOwner" | "sourceProofRef"> {
  return {
    attemptRef: buildStableTextInputRef("text-input-attempt", [receivedShapeHash, childCapabilityId]),
    inputRef: buildStableTextInputRef("text-input-input", [receivedShapeHash, childCapabilityId]),
    childCapabilityId,
    sessionId: readNonEmptyString(raw.sessionId),
    roundId: readNonEmptyString(raw.roundId),
    videoVisitId: readNonEmptyString(raw.videoVisitId),
    requestedBy: readNonEmptyString(raw.requestedBy),
    purpose: readNonEmptyString(raw.purpose),
    sourceAbilityGroupId: readNonEmptyString(raw.sourceAbilityGroupId),
    sourceChildCapabilityId: readNonEmptyString(raw.sourceChildCapabilityId),
    sourceOwner: resolveSourceOwner(raw.sourceOwner),
    sourceProofRef: readNonEmptyString(raw.sourceProofRef),
  };
}

function buildTextInputFailureContentFields(
  raw: UnknownObject,
  parseErrorText: string,
  policy: TextInputPolicy,
): Pick<TextInputFailureEnvelope, "inputText" | "inputTextRef" | "inputTextHash" | "approvedText" | "approvedTextRef" | "approvedTextHash" | "approvedCommitRef" | "targetRef" | "targetProofRef" | "targetProofOwner" | "targetKind" | "targetEvidenceRefs" | "focusProofRef" | "focusProofOwner" | "focusVerifiedAt" | "geometryGuardProofRef" | "mouseClickProofRef" | "postActionFocusVerificationRef" | "operatorApprovalRef" | "humanApprovalRef" | "mapPolicyApprovalRef" | "key" | "policy" | "parseErrorRef"> {
  return {
    inputText: typeof raw.inputText === "string" ? raw.inputText : null,
    inputTextRef: readNonEmptyString(raw.inputTextRef),
    inputTextHash: readNonEmptyString(raw.inputTextHash),
    approvedText: typeof raw.approvedText === "string" ? raw.approvedText : null,
    approvedTextRef: readNonEmptyString(raw.approvedTextRef),
    approvedTextHash: readNonEmptyString(raw.approvedTextHash),
    approvedCommitRef: readNonEmptyString(raw.approvedCommitRef),
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