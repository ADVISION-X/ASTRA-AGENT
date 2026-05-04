import type {
  ParsedTextInputAbilityInput,
  TextInputChildCapabilityId,
  TextInputCommitKey,
  TextInputKey,
  TextInputPolicy,
  TextInputSourceOwner,
  TextInputTargetKind,
} from "../contract.js";
import { buildStableTextInputRef } from "../shared/text-input-types.js";

export type TextInputExecutionSeed = {
  attemptRef: string;
  missionId: string;
  runId: string;
  inputRef: string;
  childCapabilityId: TextInputChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapId: string;
  selectedMapVersion: string;
  activationId: string;
  activationSnapshotRef: string;
  capabilityCallId: string;
  nerveBusEnvelopeId: string;
  requestedBy: string;
  purpose: string;
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: string;
  sourceOwner: TextInputSourceOwner;
  sourceProofRef: string;
  sourceRef: string;
  idempotencyKey: string;
  inputText: string | null;
  inputTextRef: string | null;
  inputTextHash: string | null;
  approvedText: string | null;
  approvedTextRef: string | null;
  approvedTextHash: string | null;
  approvedTextSourceRef: string | null;
  approvedTextApprovalRef: string | null;
  approvedCommitRef: string | null;
  inputTargetRef: string;
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
  missionId: string | null;
  runId: string | null;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string | null;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationId: string | null;
  activationSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  requestedBy: string | null;
  purpose: string | null;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  sourceOwner: TextInputSourceOwner | null;
  sourceProofRef: string | null;
  sourceRef: string | null;
  idempotencyKey: string | null;
  inputText: string | null;
  inputTextRef: string | null;
  inputTextHash: string | null;
  approvedText: string | null;
  approvedTextRef: string | null;
  approvedTextHash: string | null;
  approvedTextSourceRef: string | null;
  approvedTextApprovalRef: string | null;
  approvedCommitRef: string | null;
  inputTargetRef: string | null;
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

function buildExecutionAttemptRef(input: ParsedTextInputAbilityInput): string {
  return buildStableTextInputRef("text-input-attempt", [
    input.inputRef,
    input.idempotencyKey,
    input.capabilityCallId,
  ]);
}

function buildExecutionIdentityFields(input: ParsedTextInputAbilityInput): Omit<TextInputExecutionSeed, "attemptRef" | "sourceAbilityGroupId" | "sourceChildCapabilityId" | "sourceOwner" | "sourceProofRef" | "sourceRef" | "idempotencyKey" | "inputText" | "inputTextRef" | "inputTextHash" | "approvedText" | "approvedTextRef" | "approvedTextHash" | "approvedTextSourceRef" | "approvedTextApprovalRef" | "approvedCommitRef" | "inputTargetRef" | "targetRef" | "targetProofRef" | "targetProofOwner" | "targetKind" | "targetEvidenceRefs" | "focusProofRef" | "focusProofOwner" | "focusVerifiedAt" | "geometryGuardProofRef" | "mouseClickProofRef" | "postActionFocusVerificationRef" | "operatorApprovalRef" | "humanApprovalRef" | "mapPolicyApprovalRef" | "key" | "policy" | "parseErrorRef" | "receivedShapeHash"> {
  return {
    missionId: input.missionId,
    runId: input.runId,
    inputRef: input.inputRef,
    childCapabilityId: input.childCapabilityId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    stepId: input.stepId,
    mapPackageId: input.mapPackageId,
    mapPackageVersion: input.mapPackageVersion,
    selectedMapId: input.selectedMapId,
    selectedMapVersion: input.selectedMapVersion,
    activationId: input.activationId,
    activationSnapshotRef: input.activationSnapshotRef,
    capabilityCallId: input.capabilityCallId,
    nerveBusEnvelopeId: input.nerveBusEnvelopeId,
    requestedBy: input.requestedBy,
    purpose: input.purpose,
  };
}

function buildExecutionSourceFields(input: ParsedTextInputAbilityInput): Pick<TextInputExecutionSeed, "sourceAbilityGroupId" | "sourceChildCapabilityId" | "sourceOwner" | "sourceProofRef" | "sourceRef" | "idempotencyKey"> {
  return {
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceChildCapabilityId: input.sourceChildCapabilityId,
    sourceOwner: input.sourceOwner,
    sourceProofRef: input.sourceProofRef,
    sourceRef: input.sourceRef,
    idempotencyKey: input.idempotencyKey,
  };
}

function buildExecutionTextFields(input: ParsedTextInputAbilityInput): Pick<TextInputExecutionSeed, "inputText" | "inputTextRef" | "inputTextHash" | "approvedText" | "approvedTextRef" | "approvedTextHash" | "approvedTextSourceRef" | "approvedTextApprovalRef" | "approvedCommitRef"> {
  return {
    inputText: input.inputText,
    inputTextRef: input.inputTextRef,
    inputTextHash: input.inputTextHash,
    approvedText: input.approvedText,
    approvedTextRef: input.approvedTextRef,
    approvedTextHash: input.approvedTextHash,
    approvedTextSourceRef: input.approvedTextSourceRef,
    approvedTextApprovalRef: input.approvedTextApprovalRef,
    approvedCommitRef: input.approvedCommitRef,
  };
}

function buildExecutionTargetFields(input: ParsedTextInputAbilityInput): Pick<TextInputExecutionSeed, "inputTargetRef" | "targetRef" | "targetProofRef" | "targetProofOwner" | "targetKind" | "targetEvidenceRefs" | "focusProofRef" | "focusProofOwner" | "focusVerifiedAt" | "geometryGuardProofRef" | "mouseClickProofRef" | "postActionFocusVerificationRef"> {
  return {
    inputTargetRef: input.inputTargetRef,
    targetRef: input.targetRef,
    targetProofRef: input.targetProofRef,
    targetProofOwner: input.targetProofOwner,
    targetKind: input.targetKind,
    targetEvidenceRefs: input.targetEvidenceRefs,
    focusProofRef: input.focusProofRef,
    focusProofOwner: input.focusProofOwner,
    focusVerifiedAt: input.focusVerifiedAt,
    geometryGuardProofRef: input.geometryGuardProofRef,
    mouseClickProofRef: input.mouseClickProofRef,
    postActionFocusVerificationRef: input.postActionFocusVerificationRef,
  };
}

function buildExecutionPolicyFields(input: ParsedTextInputAbilityInput): Pick<TextInputExecutionSeed, "operatorApprovalRef" | "humanApprovalRef" | "mapPolicyApprovalRef" | "key" | "policy" | "parseErrorRef" | "receivedShapeHash"> {
  return {
    operatorApprovalRef: input.operatorApprovalRef,
    humanApprovalRef: input.humanApprovalRef,
    mapPolicyApprovalRef: input.mapPolicyApprovalRef,
    key: input.key,
    policy: input.policy,
    parseErrorRef: null,
    receivedShapeHash: null,
  };
}

export function buildTextInputExecutionSeed(input: ParsedTextInputAbilityInput): TextInputExecutionSeed {
  return {
    attemptRef: buildExecutionAttemptRef(input),
    ...buildExecutionIdentityFields(input),
    ...buildExecutionSourceFields(input),
    ...buildExecutionTextFields(input),
    ...buildExecutionTargetFields(input),
    ...buildExecutionPolicyFields(input),
  };
}