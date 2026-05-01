import { z } from "zod";

import { TEXT_INPUT_FAILURE_REASONS } from "./shared/text-input-failure.js";
import { DEFAULT_TEXT_INPUT_POLICY } from "./shared/text-input-policy.js";
import { TEXT_INPUT_PROOF } from "./shared/text-input-proof.js";
import { TEXT_INPUT_STATUSES } from "./shared/text-input-result.js";
import { TEXT_INPUT_SOURCE_OWNERS } from "./shared/text-input-source.js";
import { TEXT_INPUT_FOCUS_PROOF_OWNERS, TEXT_INPUT_TARGET_PROOF_OWNERS } from "./shared/text-input-target.js";
import {
  TEXT_INPUT_ABILITY_GROUP_ID,
  TEXT_INPUT_CHILD_CAPABILITY_IDS,
  TEXT_INPUT_COMMIT_KEYS,
  TEXT_INPUT_KEYS,
  TEXT_INPUT_TARGET_KINDS,
} from "./shared/text-input-types.js";

const nullableString = z.string().min(1).nullable().optional().default(null);
const nonNegativeInt = z.number().int().nonnegative();
const positiveInt = z.number().int().positive();
const hashString = z.string().regex(/^sha256:[a-f0-9]{64}$/i);
const {
  CLIPBOARD_DECISIONS: TEXT_INPUT_CLIPBOARD_DECISIONS,
  CLOCK_KIND: TEXT_INPUT_CLOCK_KIND,
  KEY_POLICY_DECISIONS: TEXT_INPUT_KEY_POLICY_DECISIONS,
  OUTPUT_BOUNDARY_DECISIONS: TEXT_INPUT_OUTPUT_BOUNDARY_DECISIONS,
  POLICY_DECISIONS: TEXT_INPUT_POLICY_DECISIONS,
  PRIMITIVE_DECISIONS: TEXT_INPUT_PRIMITIVE_DECISIONS,
  REDACTION_DECISIONS: TEXT_INPUT_REDACTION_DECISIONS,
  SENSITIVE_TEXT_DECISIONS: TEXT_INPUT_SENSITIVE_TEXT_DECISIONS,
  VERIFICATION_REF_POLICY: TEXT_INPUT_VERIFICATION_REF_POLICY,
} = TEXT_INPUT_PROOF;

function buildDefaultTextInputPolicy() {
  return {
    primitiveTimeoutMs: DEFAULT_TEXT_INPUT_POLICY.primitiveTimeoutMs,
    maxDurationMs: DEFAULT_TEXT_INPUT_POLICY.maxDurationMs,
    maxLengthPolicy: { ...DEFAULT_TEXT_INPUT_POLICY.maxLengthPolicy },
    sensitiveTextPolicy: { ...DEFAULT_TEXT_INPUT_POLICY.sensitiveTextPolicy },
    redactionPolicy: { ...DEFAULT_TEXT_INPUT_POLICY.redactionPolicy },
    clipboardPolicy: { ...DEFAULT_TEXT_INPUT_POLICY.clipboardPolicy },
    commitPolicy: {
      ...DEFAULT_TEXT_INPUT_POLICY.commitPolicy,
      allowedCommitKeys: [...DEFAULT_TEXT_INPUT_POLICY.commitPolicy.allowedCommitKeys],
    },
    keyPolicy: { ...DEFAULT_TEXT_INPUT_POLICY.keyPolicy },
    replacePolicy: { ...DEFAULT_TEXT_INPUT_POLICY.replacePolicy },
  };
}

const TextInputChildCapabilityIdSchema = z.enum(TEXT_INPUT_CHILD_CAPABILITY_IDS);
const TextInputTargetKindSchema = z.enum(TEXT_INPUT_TARGET_KINDS);
const TextInputKeySchema = z.enum(TEXT_INPUT_KEYS);
const TextInputCommitKeySchema = z.enum(TEXT_INPUT_COMMIT_KEYS);
const TextInputFailureReasonSchema = z.enum(TEXT_INPUT_FAILURE_REASONS);
const TextInputStatusSchema = z.enum(TEXT_INPUT_STATUSES);
const TextInputPolicyDecisionSchema = z.enum(TEXT_INPUT_POLICY_DECISIONS);
const TextInputPrimitiveDecisionSchema = z.enum(TEXT_INPUT_PRIMITIVE_DECISIONS);
const TextInputClipboardDecisionSchema = z.enum(TEXT_INPUT_CLIPBOARD_DECISIONS);
const TextInputSensitiveTextDecisionSchema = z.enum(TEXT_INPUT_SENSITIVE_TEXT_DECISIONS);
const TextInputRedactionDecisionSchema = z.enum(TEXT_INPUT_REDACTION_DECISIONS);
const TextInputKeyPolicyDecisionSchema = z.enum(TEXT_INPUT_KEY_POLICY_DECISIONS);
const TextInputOutputBoundaryDecisionSchema = z.enum(TEXT_INPUT_OUTPUT_BOUNDARY_DECISIONS);
const TextInputSourceOwnerSchema = z.enum(TEXT_INPUT_SOURCE_OWNERS);
const TextInputTargetProofOwnerSchema = z.enum(TEXT_INPUT_TARGET_PROOF_OWNERS);
const TextInputFocusProofOwnerSchema = z.enum(TEXT_INPUT_FOCUS_PROOF_OWNERS);

const TextInputMaxLengthPolicySchema = z.object({
  maxLength: positiveInt.default(DEFAULT_TEXT_INPUT_POLICY.maxLengthPolicy.maxLength),
  failureStatus: z.enum(["failed", "review_required"]).default(DEFAULT_TEXT_INPUT_POLICY.maxLengthPolicy.failureStatus),
}).strict();

const TextInputSensitiveTextPolicySchema = z.object({
  classification: z.enum(["public", "internal", "sensitive", "restricted"]).default(DEFAULT_TEXT_INPUT_POLICY.sensitiveTextPolicy.classification),
  allowSensitiveWrite: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.sensitiveTextPolicy.allowSensitiveWrite),
  requiresHumanApproval: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.sensitiveTextPolicy.requiresHumanApproval),
  requiresMapPolicyApproval: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.sensitiveTextPolicy.requiresMapPolicyApproval),
}).strict();

const TextInputRedactionPolicySchema = z.object({
  mode: z.enum(["masked", "hash_only", "none"]).default(DEFAULT_TEXT_INPUT_POLICY.redactionPolicy.mode),
  maxPreviewChars: positiveInt.default(DEFAULT_TEXT_INPUT_POLICY.redactionPolicy.maxPreviewChars),
  keepFullTextInFullDebugOnly: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.redactionPolicy.keepFullTextInFullDebugOnly),
}).strict();

const TextInputClipboardPolicySchema = z.object({
  allowPaste: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.clipboardPolicy.allowPaste),
  requiredForPaste: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.clipboardPolicy.requiredForPaste),
  restoreStrategy: z.enum(["restore_original", "clear_after_operation"]).default(DEFAULT_TEXT_INPUT_POLICY.clipboardPolicy.restoreStrategy),
  clearClipboardAfterOperation: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.clipboardPolicy.clearClipboardAfterOperation),
  requireSnapshotHash: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.clipboardPolicy.requireSnapshotHash),
  allowPlaintextPersistence: z.literal(false).default(DEFAULT_TEXT_INPUT_POLICY.clipboardPolicy.allowPlaintextPersistence),
}).strict();

const TextInputCommitPolicySchema = z.object({
  allowCommit: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.commitPolicy.allowCommit),
  requireApprovedCommitRef: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.commitPolicy.requireApprovedCommitRef),
  requireHumanApproval: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.commitPolicy.requireHumanApproval),
  requireMapPolicyApproval: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.commitPolicy.requireMapPolicyApproval),
  allowedCommitKeys: z.array(TextInputCommitKeySchema).min(1).default((): Array<"Enter"> => ["Enter"]),
}).strict();

const TextInputKeyPolicySchema = z.object({
  allowEnterInPressKey: z.literal(false).default(DEFAULT_TEXT_INPUT_POLICY.keyPolicy.allowEnterInPressKey),
  allowArrowNavigation: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.keyPolicy.allowArrowNavigation),
}).strict();

const TextInputReplacePolicySchema = z.object({
  allowReplace: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.replacePolicy.allowReplace),
  requireClearBeforeWrite: z.boolean().default(DEFAULT_TEXT_INPUT_POLICY.replacePolicy.requireClearBeforeWrite),
  writeMode: z.enum(["type-text", "paste-text"]).default(DEFAULT_TEXT_INPUT_POLICY.replacePolicy.writeMode),
}).strict();

const TextInputPolicySchema = z.object({
  primitiveTimeoutMs: positiveInt.default(DEFAULT_TEXT_INPUT_POLICY.primitiveTimeoutMs),
  maxDurationMs: positiveInt.default(DEFAULT_TEXT_INPUT_POLICY.maxDurationMs),
  maxLengthPolicy: TextInputMaxLengthPolicySchema.default(DEFAULT_TEXT_INPUT_POLICY.maxLengthPolicy),
  sensitiveTextPolicy: TextInputSensitiveTextPolicySchema.default(DEFAULT_TEXT_INPUT_POLICY.sensitiveTextPolicy),
  redactionPolicy: TextInputRedactionPolicySchema.default(DEFAULT_TEXT_INPUT_POLICY.redactionPolicy),
  clipboardPolicy: TextInputClipboardPolicySchema.default(DEFAULT_TEXT_INPUT_POLICY.clipboardPolicy),
  commitPolicy: TextInputCommitPolicySchema.default(() => ({
    ...DEFAULT_TEXT_INPUT_POLICY.commitPolicy,
    allowedCommitKeys: [...DEFAULT_TEXT_INPUT_POLICY.commitPolicy.allowedCommitKeys],
  })),
  keyPolicy: TextInputKeyPolicySchema.default(DEFAULT_TEXT_INPUT_POLICY.keyPolicy),
  replacePolicy: TextInputReplacePolicySchema.default(DEFAULT_TEXT_INPUT_POLICY.replacePolicy),
}).strict();

const TextInputBaseSchema = z.object({
  abilityGroupId: z.literal(TEXT_INPUT_ABILITY_GROUP_ID).default(TEXT_INPUT_ABILITY_GROUP_ID),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  requestedBy: z.string().min(1),
  purpose: z.string().min(1),
  sourceAbilityGroupId: nullableString,
  sourceChildCapabilityId: nullableString,
  sourceOwner: TextInputSourceOwnerSchema.nullable().default(null),
  sourceProofRef: nullableString,
  targetRef: z.string().min(1),
  targetProofRef: z.string().min(1),
  targetProofOwner: TextInputTargetProofOwnerSchema,
  targetKind: TextInputTargetKindSchema,
  targetEvidenceRefs: z.array(z.string().min(1)).max(10).default([]),
  focusProofRef: z.string().min(1),
  focusProofOwner: TextInputFocusProofOwnerSchema,
  focusVerifiedAt: z.string().datetime(),
  geometryGuardProofRef: nullableString,
  mouseClickProofRef: nullableString,
  postActionFocusVerificationRef: z.string().min(1),
  operatorApprovalRef: nullableString,
  humanApprovalRef: nullableString,
  mapPolicyApprovalRef: nullableString,
  policy: TextInputPolicySchema.default(buildDefaultTextInputPolicy),
}).strict();

const GovernedWriteFieldsSchema = z.object({
  inputText: z.string().min(1),
  inputTextRef: z.string().min(1),
  inputTextHash: hashString,
  approvedText: z.string().min(1),
  approvedTextRef: z.string().min(1),
  approvedTextHash: hashString,
  approvedCommitRef: nullableString,
  key: z.null().optional().default(null),
}).strict();

const TypeTextAbilityInputSchema = TextInputBaseSchema.extend({
  childCapabilityId: z.literal("type-text"),
}).merge(GovernedWriteFieldsSchema).strict();

const PasteTextAbilityInputSchema = TextInputBaseSchema.extend({
  childCapabilityId: z.literal("paste-text"),
}).merge(GovernedWriteFieldsSchema).strict();

const ClearInputAbilityInputSchema = TextInputBaseSchema.extend({
  childCapabilityId: z.literal("clear-input"),
  inputText: z.null().optional().default(null),
  inputTextRef: z.null().optional().default(null),
  inputTextHash: z.null().optional().default(null),
  approvedText: z.null().optional().default(null),
  approvedTextRef: z.null().optional().default(null),
  approvedTextHash: z.null().optional().default(null),
  approvedCommitRef: z.null().optional().default(null),
  key: z.null().optional().default(null),
}).strict();

const ReplaceInputAbilityInputSchema = TextInputBaseSchema.extend({
  childCapabilityId: z.literal("replace-input"),
}).merge(GovernedWriteFieldsSchema).strict();

const PressKeyAbilityInputSchema = TextInputBaseSchema.extend({
  childCapabilityId: z.literal("press-key"),
  inputText: z.null().optional().default(null),
  inputTextRef: z.null().optional().default(null),
  inputTextHash: z.null().optional().default(null),
  approvedText: z.null().optional().default(null),
  approvedTextRef: z.null().optional().default(null),
  approvedTextHash: z.null().optional().default(null),
  approvedCommitRef: z.null().optional().default(null),
  key: TextInputKeySchema,
}).strict();

const CommitInputAbilityInputSchema = TextInputBaseSchema.extend({
  childCapabilityId: z.literal("commit-input"),
  inputText: z.null().optional().default(null),
  inputTextRef: z.null().optional().default(null),
  inputTextHash: z.null().optional().default(null),
  approvedText: z.null().optional().default(null),
  approvedTextRef: z.null().optional().default(null),
  approvedTextHash: z.null().optional().default(null),
  approvedCommitRef: z.string().min(1),
  key: TextInputCommitKeySchema,
}).strict();

const TextInputAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  TypeTextAbilityInputSchema,
  PasteTextAbilityInputSchema,
  ClearInputAbilityInputSchema,
  ReplaceInputAbilityInputSchema,
  PressKeyAbilityInputSchema,
  CommitInputAbilityInputSchema,
]);

const TextInputClockSchema = z.object({
  portKind: z.literal(TEXT_INPUT_CLOCK_KIND),
  startedMonotonicMs: z.number().finite(),
  endedMonotonicMs: z.number().finite(),
}).strict();

const TextInputRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1).nullable().default(null),
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: z.literal(TEXT_INPUT_ABILITY_GROUP_ID),
  childCapabilityId: TextInputChildCapabilityIdSchema.nullable().default(null),
  sourceAbilityGroupId: nullableString,
  sourceChildCapabilityId: nullableString,
  sourceOwner: TextInputSourceOwnerSchema.nullable().default(null),
  sourceProofRef: nullableString,
  inputRef: z.string().min(1),
  outputRef: z.string().min(1).nullable().default(null),
  diagnosticPayloadRef: z.string().min(1).nullable().default(null),
  debugLogRef: z.string().min(1),
  structuredRuntimeEventRef: z.string().min(1),
  attemptRef: z.string().min(1),
  actionExecutionRef: nullableString,
  primitiveExecutionRef: nullableString,
  clearPrimitiveExecutionRef: nullableString,
  writePrimitiveExecutionRef: nullableString,
  operationRef: nullableString,
  inputTextRef: nullableString,
  inputTextHash: hashString.nullable().default(null),
  approvedTextRef: nullableString,
  approvedTextHash: hashString.nullable().default(null),
  typedTextHash: hashString.nullable().default(null),
  keySequenceHash: hashString.nullable().default(null),
  approvedCommitRef: nullableString,
  targetRef: nullableString,
  targetProofRef: nullableString,
  targetProofOwner: TextInputTargetProofOwnerSchema.nullable().default(null),
  focusProofRef: nullableString,
  focusProofOwner: TextInputFocusProofOwnerSchema.nullable().default(null),
  focusVerifiedAt: nullableString,
  geometryGuardProofRef: nullableString,
  mouseClickProofRef: nullableString,
  postActionFocusVerificationRef: nullableString,
  targetKind: TextInputTargetKindSchema,
  targetEvidenceRefs: z.array(z.string().min(1)).default([]),
  actionKind: TextInputChildCapabilityIdSchema,
  key: z.union([TextInputKeySchema, TextInputCommitKeySchema]).nullable().default(null),
  textLength: nonNegativeInt,
  policyDecision: TextInputPolicyDecisionSchema,
  sensitiveTextDecision: TextInputSensitiveTextDecisionSchema,
  redactionDecision: TextInputRedactionDecisionSchema,
  keyPolicyDecision: TextInputKeyPolicyDecisionSchema,
  outputBoundaryDecision: TextInputOutputBoundaryDecisionSchema,
  clipboardDecision: TextInputClipboardDecisionSchema,
  clipboardSnapshotRef: nullableString,
  clipboardProofRef: nullableString,
  originalClipboardHash: hashString.nullable().default(null),
  restoredClipboardHash: hashString.nullable().default(null),
  commitPolicyRef: nullableString,
  primitiveDecision: TextInputPrimitiveDecisionSchema,
  primitivePortKind: z.string().min(1),
  replaceWriteMode: z.enum(["type-text", "paste-text"]).nullable().default(null),
  primitiveStartedAt: nullableString,
  primitiveEndedAt: nullableString,
  maxDurationMs: nonNegativeInt,
  primitiveTimeoutMs: nonNegativeInt,
  postActionVerificationRequired: z.literal(true),
  postActionVerificationHandoffRef: nullableString,
  verificationRefPolicy: z.literal(TEXT_INPUT_VERIFICATION_REF_POLICY),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: TextInputStatusSchema,
  failureReason: TextInputFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  clock: TextInputClockSchema,
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success") {
    if (value.outputRef === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires outputRef", path: ["outputRef"] });
    }
    if (value.actionExecutionRef === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires actionExecutionRef", path: ["actionExecutionRef"] });
    }
    if (value.primitiveExecutionRef === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires primitiveExecutionRef", path: ["primitiveExecutionRef"] });
    }
    if (value.postActionVerificationHandoffRef === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires post-action verification handoff", path: ["postActionVerificationHandoffRef"] });
    }
  }
  if (value.status !== "success" && value.outputRef !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed and review_required require outputRef=null", path: ["outputRef"] });
  }
  if (value.status !== "success" && value.diagnosticPayloadRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed and review_required require diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
  }
});

const TextInputSuccessOutputSchema = z.object({
  attemptRef: z.string().min(1),
  actionExecutionRef: z.string().min(1),
  primitiveExecutionRef: z.string().min(1),
  targetRef: z.string().min(1),
  targetKind: TextInputTargetKindSchema.nullable().default(null),
  actionKind: TextInputChildCapabilityIdSchema.nullable().default(null),
  inputTextRef: nullableString,
  inputTextHash: hashString.nullable().default(null),
  approvedTextRef: nullableString,
  approvedTextHash: hashString.nullable().default(null),
  typedTextHash: hashString.nullable().default(null),
  keySequenceHash: hashString.nullable().default(null),
  textLength: nonNegativeInt,
  key: z.union([TextInputKeySchema, TextInputCommitKeySchema]).nullable().default(null),
  postActionVerificationRequired: z.literal(true),
  postActionVerificationHandoffRef: z.string().min(1),
}).strict();

const TextInputAbilityResultSchema = z.object({
  abilityGroupId: z.literal(TEXT_INPUT_ABILITY_GROUP_ID),
  childCapabilityId: TextInputChildCapabilityIdSchema.nullable().default(null),
  status: TextInputStatusSchema,
  sessionId: z.string().min(1).nullable().default(null),
  roundId: nullableString,
  videoVisitId: nullableString,
  attemptRef: z.string().min(1),
  output: TextInputSuccessOutputSchema.nullable().default(null),
  diagnosticPayloadRef: z.string().min(1).nullable().default(null),
  failureReason: TextInputFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  statusMessage: z.string().min(1),
  policyDecision: TextInputPolicyDecisionSchema,
  debugLogRef: z.string().min(1),
  structuredRuntimeEventRef: z.string().min(1),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  runtimeProof: TextInputRuntimeProofSchema,
}).strict().superRefine((value, context) => {
  if (value.status === "success" && value.output === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success requires output", path: ["output"] });
  }
  if (value.status !== "success" && value.output !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed and review_required require output=null", path: ["output"] });
  }
  if (value.status !== "success" && value.diagnosticPayloadRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed and review_required require diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
  }
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
  if (value.runtimeProof.attemptRef !== value.attemptRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.attemptRef must equal result.attemptRef", path: ["runtimeProof", "attemptRef"] });
  }
  if (value.runtimeProof.diagnosticPayloadRef !== value.diagnosticPayloadRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.diagnosticPayloadRef must equal result.diagnosticPayloadRef", path: ["runtimeProof", "diagnosticPayloadRef"] });
  }
});

export { TextInputChildCapabilityIdSchema, TextInputTargetKindSchema, TextInputKeySchema, TextInputCommitKeySchema, TextInputFailureReasonSchema, TextInputStatusSchema, TextInputPolicyDecisionSchema, TextInputPrimitiveDecisionSchema, TextInputClipboardDecisionSchema, TextInputSensitiveTextDecisionSchema, TextInputRedactionDecisionSchema, TextInputKeyPolicyDecisionSchema, TextInputOutputBoundaryDecisionSchema, TextInputSourceOwnerSchema, TextInputTargetProofOwnerSchema, TextInputFocusProofOwnerSchema, TextInputMaxLengthPolicySchema, TextInputSensitiveTextPolicySchema, TextInputRedactionPolicySchema, TextInputClipboardPolicySchema, TextInputCommitPolicySchema, TextInputKeyPolicySchema, TextInputReplacePolicySchema, TextInputPolicySchema, TypeTextAbilityInputSchema, PasteTextAbilityInputSchema, ClearInputAbilityInputSchema, ReplaceInputAbilityInputSchema, PressKeyAbilityInputSchema, CommitInputAbilityInputSchema, TextInputAbilityInputSchema, TextInputClockSchema, TextInputRuntimeProofSchema, TextInputSuccessOutputSchema, TextInputAbilityResultSchema };
