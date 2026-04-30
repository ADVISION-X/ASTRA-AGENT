import type { OpenRequest } from "../../capabilities/open/contract.js";
import type { AbilityCommandEnvelope, NerveBusPayloadDocument } from "../../capabilities/nerve-bus/index.js";
import { StructuredRuntimeEventSchema } from "../../types/structured-log.js";
import { createId } from "./ids.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

export const buildOpenAbilityInput = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): OpenRequest => {
  const payload = payloadDocumentToObject(inputPayload);
  return {
    abilityGroupId: "open" as const,
    childCapabilityId: "open-tiktok" as const,
    platformId: "tiktok-web" as const,
    targetKind: "platform-feed" as const,
    requestedBy: "orchestration" as const,
    sourceAbilityGroupId: "orchestration" as const,
    sourceChildCapabilityId: envelope.commandName,
    missionId: envelope.missionId,
    runId: envelope.mapId,
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    reason: inputPayload.summary,
    targetUrl: payloadValueToString(payload.targetUrl),
    targetTitle: payloadValueToString(payload.targetTitle),
    targetProfileRef: null,
    sourceRef: payloadValueToString(payload.sourceEvidenceRef),
  };
};

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

export const buildPostActionVerificationInput = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => JSON.parse(JSON.stringify({
  abilityGroupId: "post-action-verification",
  childCapabilityId: envelope.commandName === "verify-comments-open" ? "verify-comments-panel-opened" : "verify-action-result",
  requestedBy: "orchestration",
  sessionId: envelope.missionId,
  roundId: envelope.stepId,
  videoVisitId: null,
  expectedOutcome: { outcomeKind: "state_change", summary: inputPayload.summary },
  actionProof: {
    actionProofRef: envelope.inputRef,
    sourceAbilityGroupId: "mouse-click",
    sourceChildCapabilityId: "click-browser-coordinate",
    sourceRuntimeProofRef: envelope.inputRef,
    sourceActionResultRef: envelope.inputRef,
    sourceActionOutputRef: envelope.inputRef,
    actionLogRef: envelope.inputRef,
    actionRecordRef: envelope.inputRef,
  },
  beforeAfterEvidence: { beforeEvidence: null, afterEvidence: null },
  observationSet: {
    observations: [{
      ref: `${envelope.inputRef}:observation`,
      kind: "runtime_signal",
      observedAt: new Date().toISOString(),
      confidence: 0.5,
      source: { sourceAbilityGroupId: "post-action-verification", sourceChildCapabilityId: envelope.commandName, sourceProofRef: envelope.inputRef },
      payload: { signalType: "action_completed", value: true, detail: inputPayload.summary },
    }],
  },
  verificationPolicy: { requireBeforeAfterEvidence: false, requireObservationSupport: false, allowReviewRequired: true },
  confidencePolicy: { minimumConfidence: 0.5, allowReviewRequired: true },
  inputRef: envelope.inputRef,
}));

export const buildForensicsRuntimeEventInput = (envelope: AbilityCommandEnvelope) =>
  JSON.parse(JSON.stringify({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: {
      structuredRuntimeEvent: StructuredRuntimeEventSchema.parse({
        eventId: createId("event"),
        eventType: "ABILITY_DISPATCH",
        level: "INFO",
        phase: "ability-dispatch",
        component: "nerve-bus",
        owner: "Nerve Bus",
        abilityGroupId: "nerve-bus",
        childCapabilityId: "orchestration-to-ability",
        sessionId: envelope.missionId,
        missionId: envelope.missionId,
        roundId: envelope.stepId,
        videoVisitId: null,
        mapId: envelope.mapId,
        traceId: envelope.traceId,
        spanId: envelope.spanId,
        attemptId: envelope.attemptId,
        step: envelope.stepId,
        status: "success",
        reason: `Dispatched ${envelope.commandName}.`,
        createdAt: new Date().toISOString(),
        refs: [],
        inputRefs: [envelope.inputRef],
        outputRefs: [],
        evidenceRefs: [],
        proofRefs: [],
        artifactRefs: [],
        actionLogRefs: [],
        dataQualityFlags: [],
      }),
    },
  }));

export const buildPageStateDispatchInput = (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
) => {
  const session = runtime.browserController.getSessionState();
  return JSON.parse(JSON.stringify({
    childCapabilityId: envelope.commandName === "detect-feed-ready" ? "detect-feed-ready" : "detect-platform-page-kind",
    runId: envelope.mapId,
    missionId: envelope.missionId,
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: "page-state-dispatch",
    requestedBy: "orchestration",
    snapshot: {
      snapshotId: `${envelope.inputRef}:snapshot`,
      currentUrl: session.currentUrl || "https://www.tiktok.com/foryou",
      currentTitle: session.currentTitle ?? "",
      browserLoginState: session.loginState,
      viewport: { width: 1, height: 1, deviceScaleFactor: 1 },
      scrollOffset: { x: 0, y: 0 },
      capturedAt: new Date().toISOString(),
      sourceAbilityGroupId: "runtime-signal",
      sourceChildCapabilityId: "nerve-bus-dispatch",
      sourceProofRef: envelope.inputRef,
    },
    observations: [],
    sourceEvidenceRefs: [envelope.inputRef],
    freshnessPolicy: { maxSnapshotAgeMs: 300000, maxObservationAgeMs: 300000, maxObservationSkewMs: 300000 },
    confidencePolicy: { minimumConfidence: 0.5, allowReviewRequired: true },
    statePolicy: { expectedPlatformHost: null, allowLocalWorkbench: true, allowModalOverlay: false, allowUnknownState: true },
    openHandoff: { openProofRef: envelope.inputRef, browserSessionRef: envelope.missionId, platformProfileId: "tiktok-web" },
    previousPageStateFingerprint: null,
  }));
};