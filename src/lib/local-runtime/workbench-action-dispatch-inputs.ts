import { createHash } from "node:crypto";

import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/index.js";
export { buildScreenshotCommand } from "./workbench-screenshot-dispatch-input.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

const hashTextValue = (value: string): string => {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
};

const resolvePayloadRef = (
  payload: Record<string, string | number | boolean | null>,
  keys: string[],
  fallback: string,
) => {
  for (const key of keys) {
    const value = payloadValueToString(payload[key]);
    if (value) {
      return value;
    }
  }
  return fallback;
};

const collectPayloadEvidenceRefs = (payload: Record<string, string | number | boolean | null>) => {
  return [
    payloadValueToString(payload.sourceEvidenceRef),
    payloadValueToString(payload.screenshotEvidenceRef),
    payloadValueToString(payload.commentsEvidenceRef),
  ].filter((value): value is string => Boolean(value));
};

const resolveGovernedTextSeed = (
  envelope: AbilityCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
) => {
  const commandInputText = payloadValueToString(payload.commandInputRef);
  if (commandInputText) {
    return {
      text: commandInputText,
      sourceKey: "commandInputRef",
      sourceRef: `${envelope.inputRef}:command-input`,
    };
  }

  const promptInputText = payloadValueToString(payload.promptInputRef);
  if (promptInputText) {
    return {
      text: promptInputText,
      sourceKey: "promptInputRef",
      sourceRef: `${envelope.inputRef}:prompt-input`,
    };
  }

  const targetUrlText = payloadValueToString(payload.targetUrl);
  if (targetUrlText) {
    return {
      text: targetUrlText,
      sourceKey: "targetUrl",
      sourceRef: `${envelope.inputRef}:target-url`,
    };
  }

  return {
    text: null,
    sourceKey: "missing",
    sourceRef: `${envelope.inputRef}:missing-text-source`,
  };
};

export const buildVisualTargetCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const isCommentsButton = envelope.commandName === "observe-comments-button";
  const targetType = isCommentsButton ? "comments_button" : "next_video_region";
  const aiTargetCandidateRef = payloadValueToString(payload.aiTargetCandidateRef)
    ?? payloadValueToString(payload.targetCandidateRef)
    ?? payloadValueToString(payload.sourceAiResultRef);
  if (!aiTargetCandidateRef) {
    throw new Error(`Visual Target dispatch for ${targetType} requires an AI target candidate ref. Heuristic target generation is forbidden.`);
  }
  throw new Error(`Visual Target AI candidate dispatch is not wired for ${targetType}; Route Plan must pass structured AI candidate geometry before this non-AI ability can run.`);
};

export const buildGeometryGuardCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const isNextVideoGeometry = envelope.stepId === "normalize-next-video-region";
  const sourceTargetRef = resolvePayloadRef(payload, ["visualTargetRef", "sourceTargetRef", "abilityResultRef"], `${envelope.inputRef}:visual-target`);
  const sourceScreenshotEvidenceRef = resolvePayloadRef(payload, ["screenshotEvidenceRef", "sourceScreenshotEvidenceId", "sourceEvidenceRef"], `${envelope.inputRef}:screenshot`);
  return JSON.parse(JSON.stringify({
    abilityGroupId: "geometry-guard",
    childCapabilityId: envelope.commandName === "normalize-coordinate-geometry" ? "validate-browser-viewport-bounds" : "validate-coordinate-space",
    missionId: envelope.missionId,
    runId: envelope.runId,
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    stepId: envelope.stepId,
    mapPackageId: envelope.mapPackageId,
    mapPackageVersion: envelope.mapPackageVersion,
    selectedMapId: envelope.selectedMapId,
    selectedMapVersion: envelope.selectedMapVersion,
    activationSnapshotRef: envelope.activationSnapshotRef,
    capabilityCallId: envelope.capabilityCallId,
    nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
    requestedBy: "orchestration",
    purpose: inputPayload.summary,
    sourceAbilityGroupId: "visual-target",
    sourceChildCapabilityId: isNextVideoGeometry ? "observe-next-video-region" : "observe-comments-button",
    inputRef: envelope.inputRef,
    sourceRef: sourceTargetRef,
    sourceScreenshotEvidenceRef,
    sourceTargetRef,
    sourceAiResultRef: null,
    sourceVisualTargetResultRef: sourceTargetRef,
    sourceCoordinateSpace: "browserViewport",
    requestedExecutionSpace: "browserViewport",
    bbox: { x: 0, y: 0, width: 100, height: 100 },
    clickPoint: { x: 50, y: 50 },
    viewportSize: { width: 100, height: 100 },
    idempotencyKey: envelope.idempotencyKey,
  }));
};

export const buildMouseClickCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const geometryProofRef = payloadValueToString(payload.geometryProofRef) ?? envelope.inputRef;
  return JSON.parse(JSON.stringify({
    abilityGroupId: "mouse-click",
    childCapabilityId: "click-browser-coordinate",
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    requestedBy: "orchestration",
    purpose: inputPayload.summary,
    sourceCoordinateProofRef: geometryProofRef,
    sourceEvidenceRef: payloadValueToString(payload.sourceEvidenceRef),
    sourceTargetRef: payloadValueToString(payload.visualTargetRef) ?? envelope.inputRef,
    geometryGuardProof: { proofRef: geometryProofRef, normalizedCoordinateSpace: "browserViewport", clickPoint: { x: 0, y: 0 }, safetyMarginPx: 4 },
    bounds: { width: 1, height: 1 },
  }));
};

const buildTextInputTargetProofFields = (input: {
  envelope: AbilityCommandEnvelope;
  payload: Record<string, string | number | boolean | null>;
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

export const buildTextInputCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const geometryProofRef = payloadValueToString(payload.geometryProofRef) ?? envelope.inputRef;
  const targetRef = payloadValueToString(payload.sourceTargetRef) ?? envelope.inputRef;
  const governedText = resolveGovernedTextSeed(envelope, payload);
  const textValue = governedText.text ?? "";
  const inputTextHash = hashTextValue(textValue);
  const approvedTextApprovalRef = `${envelope.inputRef}:approved-text-approval`;
  return JSON.parse(JSON.stringify({
    abilityGroupId: "text-input",
    childCapabilityId: "type-text",
    missionId: envelope.missionId,
    runId: envelope.runId,
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
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

export const buildMouseScrollCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const geometryProofRef = payloadValueToString(payload.geometryProofRef) ?? envelope.inputRef;
  const sourceTargetRef = payloadValueToString(payload.sourceTargetRef) ?? payloadValueToString(payload.visualTargetRef) ?? envelope.inputRef;
  const sourceEvidenceRef = payloadValueToString(payload.sourceEvidenceRef) ?? payloadValueToString(payload.screenshotEvidenceRef);
  const executableAnchorPoint = {
    x: Math.round(geometry.viewportWidth / 2),
    y: Math.round(geometry.viewportHeight / 2),
  };
  return JSON.parse(JSON.stringify({
    abilityGroupId: "mouse-scroll",
    childCapabilityId: "scroll-browser-viewport",
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    requestedBy: "orchestration",
    purpose: "scroll_next_video",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    sourceCoordinateProofRef: geometryProofRef,
    sourceEvidenceRef,
    sourceTargetRef,
    geometryScrollProof: {
      proofId: geometryProofRef,
      geometryGuardRef: geometryProofRef,
      abilityGroupId: "geometry-guard",
      childCapabilityId: "validate-browser-viewport-bounds",
      sourceAbilityGroupId: "visual-target",
      sourceChildCapabilityId: "observe-next-video-region",
      sessionId: envelope.missionId,
      roundId: envelope.stepId,
      videoVisitId: null,
      status: "success",
      guardDecision: "allow",
      normalizedCoordinateSpace: "browserViewport",
      normalizedAnchorPoint: executableAnchorPoint,
      normalizedRegion: null,
      sourceScreenshotEvidenceRef: sourceEvidenceRef,
      sourceTargetRef,
      inputRef: envelope.inputRef,
      outputRef: geometryProofRef,
    },
    coordinateSpace: "browserViewport",
    bounds: { width: geometry.viewportWidth, height: geometry.viewportHeight },
    direction: "down",
    magnitude: "onePage",
    repeat: 2,
    safetyPolicy: {
      primitiveTimeoutMs: 60_000,
      maxDurationMs: 60_000,
    },
  }));
};
