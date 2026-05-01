import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

export const buildScreenshotCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => JSON.parse(JSON.stringify({
  abilityGroupId: "screenshot",
  childCapabilityId: envelope.commandName === "prepare-ai-input" ? "prepare-ai-input" : "capture-browser-viewport",
  sessionId: envelope.missionId,
  roundId: envelope.stepId,
  videoVisitId: null,
  missionId: envelope.missionId,
  runId: envelope.mapId,
  requestedBy: "orchestration",
  purpose: inputPayload.summary,
  sourceAbilityGroupId: "orchestration",
  sourceChildCapabilityId: envelope.commandName,
  idempotencyKey: envelope.idempotencyKey,
}));

export const buildVisualTargetCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  return JSON.parse(JSON.stringify({
    abilityGroupId: "visual-target",
    childCapabilityId: envelope.commandName === "detect-comments-button" ? "detect-comments-button" : "detect-next-video-region",
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    inputRef: envelope.inputRef,
    targetType: envelope.commandName === "detect-comments-button" ? "comments_button" : "next_video_region",
    targetNature: "action",
    sourceProof: {
      screenshot: { decision: "review_required", screenshotEvidenceRef: payloadValueToString(payload.screenshotEvidenceRef), screenshotProofRef: envelope.inputRef, coordinateSpace: "browser_viewport", imageSize: null, scaleMapping: null, reason: "Dispatch proof carried by Nerve Bus payload refs." },
      ai: { decision: "not_required", aiResultRef: null, aiProofRef: null, confidence: null, reason: null },
      pageState: { decision: "review_required", pageStateRef: payloadValueToString(payload.pageStateRef), pageStateProofRef: null, pageStateType: null, reason: "Page state is referenced by transport payload when available." },
    },
    candidates: [],
  }));
};

export const buildGeometryGuardCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  return JSON.parse(JSON.stringify({
    abilityGroupId: "geometry-guard",
    childCapabilityId: envelope.commandName === "normalize-coordinate-geometry" ? "validate-click-point" : "validate-coordinate-space",
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    requestedBy: "orchestration",
    purpose: inputPayload.summary,
    sourceAbilityGroupId: "visual-target",
    sourceChildCapabilityId: envelope.commandName,
    inputRef: envelope.inputRef,
    sourceScreenshotEvidenceRef: payloadValueToString(payload.screenshotEvidenceRef),
    sourceTargetRef: payloadValueToString(payload.visualTargetRef),
    sourceAiResultRef: null,
    sourceCoordinateSpace: "browserViewport",
    requestedExecutionSpace: "browserViewport",
    bbox: { x: 0, y: 0, width: 1, height: 1 },
    clickPoint: { x: 0, y: 0 },
    viewportSize: { width: 1, height: 1 },
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

export const buildTextInputCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const geometryProofRef = payloadValueToString(payload.geometryProofRef) ?? envelope.inputRef;
  const targetRef = payloadValueToString(payload.sourceTargetRef) ?? envelope.inputRef;
  return JSON.parse(JSON.stringify({
    abilityGroupId: "text-input",
    childCapabilityId: "type-text",
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    requestedBy: "orchestration",
    purpose: inputPayload.summary,
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    sourceOwner: "map-plugin",
    sourceProofRef: envelope.inputRef,
    targetRef,
    targetProofRef: geometryProofRef,
    targetProofOwner: "geometry-guard",
    targetKind: "commentComposer",
    focusProofRef: envelope.inputRef,
    focusProofOwner: "post-action-verification",
    focusVerifiedAt: envelope.createdAt,
    geometryGuardProofRef: payloadValueToString(payload.geometryProofRef),
    mouseClickProofRef: payloadValueToString(payload.abilityResultRef),
    postActionFocusVerificationRef: envelope.inputRef,
    operatorApprovalRef: null,
    humanApprovalRef: null,
    mapPolicyApprovalRef: envelope.mapId,
    inputText: "governed text input",
    inputTextRef: `${envelope.inputRef}:input-text`,
    inputTextHash: "sha256:governed-text-input",
    approvedText: "governed text input",
    approvedTextRef: `${envelope.inputRef}:approved-text`,
    approvedTextHash: "sha256:governed-text-input",
    approvedCommitRef: null,
  }));
};

export const buildMouseScrollCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const geometryProofRef = payloadValueToString(payload.geometryProofRef) ?? envelope.inputRef;
  return JSON.parse(JSON.stringify({
    abilityGroupId: "mouse-scroll",
    childCapabilityId: "scroll-browser-viewport",
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    requestedBy: "orchestration",
    purpose: inputPayload.summary,
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    sourceCoordinateProofRef: geometryProofRef,
    sourceEvidenceRef: payloadValueToString(payload.sourceEvidenceRef),
    sourceTargetRef: payloadValueToString(payload.sourceTargetRef) ?? envelope.inputRef,
    geometryScrollProof: { proofRef: geometryProofRef, normalizedCoordinateSpace: "browserViewport", normalizedAnchor: { x: 0, y: 0 }, normalizedBounds: { width: 1, height: 1 }, normalizedRegion: null },
    coordinateSpace: "browserViewport",
    bounds: { width: 1, height: 1 },
    direction: "down",
    magnitude: "medium",
  }));
};