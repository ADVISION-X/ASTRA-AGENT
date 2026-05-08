import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import {
  collectPayloadEvidenceRefs,
  hashTextValue,
  resolveGovernedTextSeed,
  resolvePayloadRef,
  toDispatchPayload,
  type DispatchPayloadRecord,
} from "./workbench-action-dispatch-shared.js";

const buildTextInputTargetProofFields = (input: {
  envelope: AbilityCommandEnvelope;
  payload: DispatchPayloadRecord;
  geometryProofRef: string;
  targetRef: string;
}) => {
  return {
    inputTargetRef: input.targetRef,
    targetRef: input.targetRef,
    targetProofRef: input.geometryProofRef,
    targetProofOwner: "geometry-guard",
    targetKind: "commentComposer",
    targetEvidenceRefs: collectPayloadEvidenceRefs(input.payload),
    focusProofRef: input.envelope.inputRef,
    focusProofOwner: "post-action-verification",
    focusVerifiedAt: input.envelope.createdAt,
    geometryGuardProofRef: payloadValueToString(input.payload.geometryProofRef),
    mouseClickProofRef: payloadValueToString(input.payload.abilityResultRef),
    postActionFocusVerificationRef: input.envelope.inputRef,
    operatorApprovalRef: null,
    humanApprovalRef: null,
    mapPolicyApprovalRef: `${input.envelope.mapId}:map-policy-approval`,
  };
};

const buildNavigationTargetProofFields = (input: {
  envelope: AbilityCommandEnvelope;
  payload: DispatchPayloadRecord;
  pageStateRef: string;
}) => {
  const targetRef = `${input.pageStateRef}:feed-surface`;

  return {
    inputTargetRef: targetRef,
    targetRef,
    targetProofRef: input.pageStateRef,
    targetProofOwner: "page-state",
    targetKind: "feedSurface",
    targetEvidenceRefs: collectPayloadEvidenceRefs(input.payload),
    focusProofRef: input.pageStateRef,
    focusProofOwner: "page-state",
    focusVerifiedAt: input.envelope.createdAt,
    geometryGuardProofRef: null,
    mouseClickProofRef: null,
    postActionFocusVerificationRef: input.pageStateRef,
    operatorApprovalRef: null,
    humanApprovalRef: null,
    mapPolicyApprovalRef: `${input.envelope.mapId}:map-policy-approval`,
  };
};

const buildTextInputApprovedTextFields = (input: {
  governedText: ReturnType<typeof resolveGovernedTextSeed>;
  inputTextHash: string;
  approvedTextApprovalRef: string;
}) => {
  return {
    inputText: input.governedText.text,
    inputTextRef: `${input.governedText.sourceRef}:input-text`,
    inputTextHash: input.inputTextHash,
    approvedText: input.governedText.text,
    approvedTextRef: `${input.governedText.sourceRef}:approved-text`,
    approvedTextHash: input.inputTextHash,
    approvedTextSourceRef: input.governedText.sourceRef,
    approvedTextApprovalRef: input.approvedTextApprovalRef,
    approvedCommitRef: null,
  };
};

const buildNavigationKeyPurpose = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  if (envelope.stepId === "press-next-video-key") {
    return "press_next_video_key";
  }

  return inputPayload.summary;
};

const buildNavigationKeyValue = (envelope: AbilityCommandEnvelope) => {
  return "ArrowDown";
};

const buildNavigationTextInputCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const pageStateRef = resolvePayloadRef(payload, ["pageStateRef"], envelope.inputRef);

  return JSON.parse(JSON.stringify({
    abilityGroupId: "text-input",
    childCapabilityId: "press-navigation-key",
    missionId: envelope.missionId,
    runId: envelope.runId,
    sessionId: envelope.sessionId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    stepId: envelope.stepId,
    mapPackageId: envelope.mapPackageId,
    mapPackageVersion: envelope.mapPackageVersion,
    selectedMapId: envelope.selectedMapId,
    selectedMapVersion: envelope.selectedMapVersion,
    activationId: envelope.activationId,
    activationSnapshotRef: envelope.activationSnapshotRef,
    capabilityCallId: envelope.capabilityCallId,
    nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
    requestedBy: "orchestration",
    purpose: buildNavigationKeyPurpose(envelope, inputPayload),
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    sourceOwner: "orchestration",
    sourceProofRef: envelope.inputRef,
    sourceRef: pageStateRef,
    inputRef: envelope.inputRef,
    idempotencyKey: envelope.idempotencyKey,
    ...buildNavigationTargetProofFields({ envelope, payload, pageStateRef }),
    inputText: null,
    inputTextRef: null,
    inputTextHash: null,
    approvedText: null,
    approvedTextRef: null,
    approvedTextHash: null,
    approvedTextSourceRef: null,
    approvedTextApprovalRef: null,
    approvedCommitRef: null,
    key: buildNavigationKeyValue(envelope),
  }));
};

export const buildTextInputCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  if (envelope.commandName === "press-navigation-key") {
    return buildNavigationTextInputCommand(envelope, inputPayload);
  }

  const payload = toDispatchPayload(inputPayload);
  const geometryProofRef = payloadValueToString(payload.geometryProofRef) ?? envelope.inputRef;
  const targetRef = payloadValueToString(payload.sourceTargetRef) ?? envelope.inputRef;
  const governedText = resolveGovernedTextSeed(envelope, payload);
  const inputTextHash = hashTextValue(governedText.text ?? "");
  const approvedTextApprovalRef = `${envelope.inputRef}:approved-text-approval`;

  return JSON.parse(JSON.stringify({
    abilityGroupId: "text-input",
    childCapabilityId: "type-text",
    missionId: envelope.missionId,
    runId: envelope.runId,
    sessionId: envelope.sessionId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    stepId: envelope.stepId,
    mapPackageId: envelope.mapPackageId,
    mapPackageVersion: envelope.mapPackageVersion,
    selectedMapId: envelope.selectedMapId,
    selectedMapVersion: envelope.selectedMapVersion,
    activationId: envelope.activationId,
    activationSnapshotRef: envelope.activationSnapshotRef,
    capabilityCallId: envelope.capabilityCallId,
    nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
    requestedBy: "orchestration",
    purpose: inputPayload.summary,
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    sourceOwner: "orchestration",
    sourceProofRef: envelope.inputRef,
    sourceRef: governedText.sourceRef,
    inputRef: envelope.inputRef,
    idempotencyKey: envelope.idempotencyKey,
    ...buildTextInputTargetProofFields({ envelope, payload, geometryProofRef, targetRef }),
    ...buildTextInputApprovedTextFields({ governedText, inputTextHash, approvedTextApprovalRef }),
  }));
};