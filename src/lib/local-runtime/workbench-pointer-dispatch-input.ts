import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import { resolveAbilityResultProofSummary, type AbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
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

const readSummaryString = (summary: AbilityResultProofSummary | null, key: string): string | null => {
  const value = summary?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const readSummaryNumber = (summary: AbilityResultProofSummary | null, key: string): number | null => {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const requireSummaryString = (summary: AbilityResultProofSummary | null, key: string): string => {
  const value = readSummaryString(summary, key);
  if (!value) {
    throw new Error(`Mouse Click dispatch requires Geometry Guard proof summary field "${key}".`);
  }

  return value;
};

const requireSummaryNumber = (summary: AbilityResultProofSummary | null, key: string): number => {
  const value = readSummaryNumber(summary, key);
  if (value === null) {
    throw new Error(`Mouse Click dispatch requires Geometry Guard proof summary field "${key}".`);
  }

  return value;
};

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

const buildMouseClickPurpose = (envelope: AbilityCommandEnvelope, inputPayload: NerveBusPayloadDocument) => {
  return envelope.stepId === "click-next-video-arrow" ? "click_next_video" : inputPayload.summary;
};

const buildGeometryGuardProof = (summary: AbilityResultProofSummary | null) => {
  const normalizedCoordinateSpace = requireSummaryString(summary, "normalizedCoordinateSpace");
  const normalizedClickPoint = {
    x: requireSummaryNumber(summary, "normalizedClickPointX"),
    y: requireSummaryNumber(summary, "normalizedClickPointY"),
  };

  return {
    childCapabilityId: requireSummaryString(summary, "geometryGuardChildCapabilityId"),
    geometryGuardRef: requireSummaryString(summary, "geometryGuardRef"),
    proofId: requireSummaryString(summary, "geometryGuardProofRef"),
    runtimeProofRef: requireSummaryString(summary, "geometryGuardRuntimeProofRef"),
    outputRef: requireSummaryString(summary, "geometryGuardOutputRef"),
    sourceAbilityGroupId: requireSummaryString(summary, "sourceAbilityGroupId"),
    sourceChildCapabilityId: readSummaryString(summary, "sourceChildCapabilityId"),
    missionId: requireSummaryString(summary, "missionId"),
    runId: requireSummaryString(summary, "runId"),
    sessionId: requireSummaryString(summary, "sessionId"),
    roundId: readSummaryString(summary, "roundId"),
    videoVisitId: readSummaryString(summary, "videoVisitId"),
    stepId: requireSummaryString(summary, "stepId"),
    mapPackageId: requireSummaryString(summary, "mapPackageId"),
    mapPackageVersion: requireSummaryString(summary, "mapPackageVersion"),
    selectedMapId: requireSummaryString(summary, "selectedMapId"),
    selectedMapVersion: requireSummaryString(summary, "selectedMapVersion"),
    activationSnapshotRef: requireSummaryString(summary, "activationSnapshotRef"),
    capabilityCallId: requireSummaryString(summary, "capabilityCallId"),
    nerveBusEnvelopeId: requireSummaryString(summary, "nerveBusEnvelopeId"),
    normalizedCoordinateSpace,
    normalizedClickPoint,
    sourceScreenshotEvidenceRef: readSummaryString(summary, "sourceScreenshotEvidenceRef"),
    sourceTargetRef: requireSummaryString(summary, "sourceTargetRef"),
    sourceAiResultRef: readSummaryString(summary, "sourceAiResultRef"),
    sourceVisualTargetResultRef: readSummaryString(summary, "sourceVisualTargetResultRef"),
    riskLevel: readSummaryString(summary, "riskLevel"),
    requiresPostClickAiVerification: summary?.requiresPostClickAiVerification === true,
    dataQualityFlags: readSummaryString(summary, "dataQualityFlags"),
  };
};

export const buildMouseClickCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const geometryProofRef = resolvePayloadRef(payload, ["geometryProofRef"], envelope.inputRef);
  const geometrySummary = resolveAbilityResultProofSummary(geometryProofRef);
  const geometryGuardProof = buildGeometryGuardProof(geometrySummary);
  const geometry = await runtime.browserController.getGeometrySnapshot();

  return JSON.parse(JSON.stringify({
    abilityGroupId: "mouse-click",
    childCapabilityId: geometryGuardProof.normalizedCoordinateSpace === "desktopScreen"
      ? "click-desktop-coordinate"
      : "click-browser-coordinate",
    sourceAbilityGroupId: geometryGuardProof.sourceAbilityGroupId,
    sourceChildCapabilityId: geometryGuardProof.sourceChildCapabilityId,
    missionId: geometryGuardProof.missionId,
    runId: geometryGuardProof.runId,
    sessionId: geometryGuardProof.sessionId,
    roundId: geometryGuardProof.roundId,
    videoVisitId: geometryGuardProof.videoVisitId,
    stepId: geometryGuardProof.stepId,
    mapPackageId: geometryGuardProof.mapPackageId,
    mapPackageVersion: geometryGuardProof.mapPackageVersion,
    selectedMapId: geometryGuardProof.selectedMapId,
    selectedMapVersion: geometryGuardProof.selectedMapVersion,
    activationSnapshotRef: geometryGuardProof.activationSnapshotRef,
    capabilityCallId: geometryGuardProof.capabilityCallId,
    nerveBusEnvelopeId: geometryGuardProof.nerveBusEnvelopeId,
    requestedBy: "orchestration",
    purpose: buildMouseClickPurpose(envelope, inputPayload),
    inputRef: envelope.inputRef,
    sourceRef: requireSummaryString(geometrySummary, "sourceRef"),
    sourceCoordinateProofRef: geometryGuardProof.proofId,
    sourceEvidenceRef: readSummaryString(geometrySummary, "sourceScreenshotEvidenceRef")
      ?? payloadValueToString(payload.screenshotEvidenceRef)
      ?? payloadValueToString(payload.sourceEvidenceRef),
    sourceTargetRef: geometryGuardProof.sourceTargetRef,
    sourceVisualTargetResultRef: geometryGuardProof.sourceVisualTargetResultRef,
    geometryGuardProof: {
      proofId: geometryGuardProof.proofId,
      geometryGuardRef: geometryGuardProof.geometryGuardRef,
      abilityGroupId: "geometry-guard",
      childCapabilityId: geometryGuardProof.childCapabilityId,
      sourceAbilityGroupId: geometryGuardProof.sourceAbilityGroupId,
      sourceChildCapabilityId: geometryGuardProof.sourceChildCapabilityId,
      missionId: geometryGuardProof.missionId,
      runId: geometryGuardProof.runId,
      sessionId: geometryGuardProof.sessionId,
      roundId: geometryGuardProof.roundId,
      videoVisitId: geometryGuardProof.videoVisitId,
      stepId: geometryGuardProof.stepId,
      mapPackageId: geometryGuardProof.mapPackageId,
      mapPackageVersion: geometryGuardProof.mapPackageVersion,
      selectedMapId: geometryGuardProof.selectedMapId,
      selectedMapVersion: geometryGuardProof.selectedMapVersion,
      activationSnapshotRef: geometryGuardProof.activationSnapshotRef,
      capabilityCallId: geometryGuardProof.capabilityCallId,
      nerveBusEnvelopeId: geometryGuardProof.nerveBusEnvelopeId,
      status: "success",
      guardDecision: "allow",
      normalizedCoordinateSpace: geometryGuardProof.normalizedCoordinateSpace,
      normalizedClickPoint: geometryGuardProof.normalizedClickPoint,
      sourceBounds: null,
      sourceScreenshotEvidenceRef: geometryGuardProof.sourceScreenshotEvidenceRef,
      sourceTargetRef: geometryGuardProof.sourceTargetRef,
      sourceVisualTargetResultRef: geometryGuardProof.sourceVisualTargetResultRef,
      riskLevel: geometryGuardProof.riskLevel,
      requiresPostClickAiVerification: geometryGuardProof.requiresPostClickAiVerification,
      dataQualityFlags: geometryGuardProof.dataQualityFlags,
      inputRef: requireSummaryString(geometrySummary, "geometryGuardInputRef"),
      outputRef: geometryGuardProof.outputRef,
      runtimeProofRef: geometryGuardProof.runtimeProofRef,
    },
    geometryGuardRef: geometryGuardProof.geometryGuardRef,
    guardDecision: "allow",
    geometryGuardOutputRef: geometryGuardProof.outputRef,
    geometryGuardRuntimeProofRef: geometryGuardProof.runtimeProofRef,
    geometryGuardNormalizedCoordinateSpace: geometryGuardProof.normalizedCoordinateSpace,
    geometryGuardNormalizedClickPoint: geometryGuardProof.normalizedClickPoint,
    button: "left",
    clickCount: 1,
    bounds: {
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
    },
    idempotencyKey: envelope.idempotencyKey,
    timeoutMs: 15000,
  }));
};

export const buildTextInputCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
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

export const buildMouseScrollCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const geometryProofRef = payloadValueToString(payload.geometryProofRef) ?? envelope.inputRef;
  const sourceTargetRef = payloadValueToString(payload.sourceTargetRef)
    ?? payloadValueToString(payload.visualTargetRef)
    ?? envelope.inputRef;
  const sourceEvidenceRef = payloadValueToString(payload.sourceEvidenceRef)
    ?? payloadValueToString(payload.screenshotEvidenceRef);
  const executableAnchorPoint = {
    x: Math.round(geometry.viewportWidth / 2),
    y: Math.round(geometry.viewportHeight / 2),
  };

  return JSON.parse(JSON.stringify({
    abilityGroupId: "mouse-scroll",
    childCapabilityId: "scroll-browser-viewport",
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
    activationSnapshotRef: envelope.activationSnapshotRef,
    capabilityCallId: envelope.capabilityCallId,
    nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
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
      activationSnapshotRef: envelope.activationSnapshotRef,
      capabilityCallId: envelope.capabilityCallId,
      nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
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
    bounds: {
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
    },
    direction: "down",
    magnitude: "onePage",
    repeat: 2,
    safetyPolicy: {
      primitiveTimeoutMs: 60000,
      maxDurationMs: 60000,
    },
  }));
};
