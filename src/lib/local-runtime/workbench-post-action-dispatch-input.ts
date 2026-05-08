import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { resolveAbilityResultProofSummary, type AbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

type SupportedPostActionChildCapabilityId =
  | "observe-page-open-attempt"
  | "observe-comments-panel-open-attempt"
  | "observe-comments-panel-close-attempt"
  | "observe-not-interested-attempt"
  | "observe-target-state-transition";

type PostActionInputPolicy = {
  childCapabilityId: SupportedPostActionChildCapabilityId;
  outcomeType: "page_opened" | "comments_panel_opened" | "comments_panel_closed" | "not_interested_result" | "target_state_changed";
  sourceAbilityGroupId: "open" | "mouse-click" | "mouse-scroll";
  sourceChildCapabilityId: "open-tiktok" | "open-facebook" | "click-browser-coordinate" | "scroll-browser-viewport";
  sourceActionType: string;
  verificationMode: "observation_only" | "visual_evidence" | "before_after_comparison";
  requireAfterEvidence: boolean;
  requireBeforeAfterComparison: boolean;
  requiresVisualEvidence: boolean;
  executionRefField: "primitiveExecutionRef" | "scrollExecutionRef";
};

const DEFAULT_PAGE_URL_BY_MAP = {
  "facebook.seeding-video.discovery.meta.v1": "https://www.facebook.com/reel/",
  "tiktok.seeding-video.discovery.meta.v1": "https://www.tiktok.com/foryou",
} as const;

const normalizePageStateLogin = (loginState: string | null | undefined) => {
  if (loginState === "logged_in") {
    return "ready" as const;
  }
  if (loginState === "login_required" || loginState === "review_required") {
    return loginState;
  }
  return "unknown" as const;
};

const resolveCanonicalPlatformUrl = (selectedMapId: string | null | undefined): string | null =>
  DEFAULT_PAGE_URL_BY_MAP[selectedMapId as keyof typeof DEFAULT_PAGE_URL_BY_MAP] ?? null;

const resolveCanonicalPlatformHost = (selectedMapId: string | null | undefined): string | null => {
  const canonicalUrl = resolveCanonicalPlatformUrl(selectedMapId);
  if (!canonicalUrl) {
    return null;
  }
  return new URL(canonicalUrl).hostname;
};

const POST_ACTION_POLICY_BY_COMMAND: Partial<Record<string, PostActionInputPolicy>> = {
  "observe-page-open-attempt": {
    childCapabilityId: "observe-page-open-attempt",
    outcomeType: "page_opened",
    sourceAbilityGroupId: "open",
    sourceChildCapabilityId: "open-tiktok",
    sourceActionType: "open_page",
    verificationMode: "observation_only",
    requireAfterEvidence: false,
    requireBeforeAfterComparison: false,
    requiresVisualEvidence: false,
    executionRefField: "primitiveExecutionRef",
  },
  "observe-comments-panel-open-attempt": {
    childCapabilityId: "observe-comments-panel-open-attempt",
    outcomeType: "comments_panel_opened",
    sourceAbilityGroupId: "mouse-click",
    sourceChildCapabilityId: "click-browser-coordinate",
    sourceActionType: "open_comments",
    verificationMode: "visual_evidence",
    requireAfterEvidence: true,
    requireBeforeAfterComparison: false,
    requiresVisualEvidence: true,
    executionRefField: "primitiveExecutionRef",
  },
  "observe-comments-panel-close-attempt": {
    childCapabilityId: "observe-comments-panel-close-attempt",
    outcomeType: "comments_panel_closed",
    sourceAbilityGroupId: "mouse-click",
    sourceChildCapabilityId: "click-browser-coordinate",
    sourceActionType: "close_comments",
    verificationMode: "visual_evidence",
    requireAfterEvidence: true,
    requireBeforeAfterComparison: false,
    requiresVisualEvidence: true,
    executionRefField: "primitiveExecutionRef",
  },
  "observe-not-interested-attempt": {
    childCapabilityId: "observe-not-interested-attempt",
    outcomeType: "not_interested_result",
    sourceAbilityGroupId: "mouse-click",
    sourceChildCapabilityId: "click-browser-coordinate",
    sourceActionType: "not_interested",
    verificationMode: "before_after_comparison",
    requireAfterEvidence: true,
    requireBeforeAfterComparison: true,
    requiresVisualEvidence: false,
    executionRefField: "primitiveExecutionRef",
  },
};

const DEFAULT_POST_ACTION_POLICY: PostActionInputPolicy = {
  childCapabilityId: "observe-target-state-transition",
  outcomeType: "target_state_changed",
  sourceAbilityGroupId: "mouse-click",
  sourceChildCapabilityId: "click-browser-coordinate",
  sourceActionType: "click_target_state_change",
  verificationMode: "before_after_comparison",
  requireAfterEvidence: true,
  requireBeforeAfterComparison: true,
  requiresVisualEvidence: false,
  executionRefField: "primitiveExecutionRef",
};

const resolvePostActionInputPolicy = (envelope: AbilityCommandEnvelope): PostActionInputPolicy => {
  const policy = POST_ACTION_POLICY_BY_COMMAND[envelope.commandName] ?? DEFAULT_POST_ACTION_POLICY;
  return policy;
};

const resolveSourceProofRef = (
  envelope: AbilityCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
) => {
  return payloadValueToString(payload.abilityResultRef)
    ?? payloadValueToString(payload.sourceEvidenceRef)
    ?? envelope.inputRef;
};

const readSummaryString = (summary: AbilityResultProofSummary | null, key: string): string | null => {
  const value = summary?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const buildPageStateObservation = (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  sourceProofRef: string,
  summary: string,
) => {
  const session = runtime.browserController.getSessionState();
  const currentUrl = session.currentUrl || resolveCanonicalPlatformUrl(envelope.selectedMapId) || null;
  return {
    ref: `${envelope.inputRef}:page-state`,
    kind: "page_state" as const,
    source: {
      sourceAbilityGroupId: "page-state" as const,
      sourceChildCapabilityId: "observe-platform-surface",
      sourceProofRef,
    },
    capturedAt: new Date().toISOString(),
    sessionId: envelope.sessionId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    payload: {
      kind: "page_state" as const,
      currentUrl,
      loginState: normalizePageStateLogin(session.loginState),
      commentsPanelOpen: null,
      modalOverlayPresent: null,
      recommendationChanged: null,
      changeSummary: summary,
      targetStateChanged: null,
      targetType: null,
      wrongDomain: null,
    },
  };
};

const buildActionProof = (input: {
  envelope: AbilityCommandEnvelope;
  sourceProofRef: string;
  policy: PostActionInputPolicy;
  sourceSummary?: AbilityResultProofSummary | null;
}) => ({
  actionProofRef: input.sourceProofRef,
  actionLogRef: input.sourceProofRef,
  actionRecordRef: null,
  sourceRuntimeProofRef: input.sourceProofRef,
  sourceActionResultRef: input.sourceProofRef,
  sourceActionOutputRef: input.sourceProofRef,
  sourceAbilityGroupId: input.policy.sourceAbilityGroupId,
  sourceChildCapabilityId: input.policy.sourceChildCapabilityId,
  actionType: input.policy.sourceActionType,
  actionStatus: "success" as const,
  primitiveExecutionRef: input.policy.executionRefField === "primitiveExecutionRef" ? input.sourceProofRef : null,
  navigationAttemptRef: null,
  scrollExecutionRef: input.policy.executionRefField === "scrollExecutionRef"
    ? readSummaryString(input.sourceSummary ?? null, "scrollExecutionRef") ?? input.sourceProofRef
    : null,
  sessionId: input.envelope.sessionId,
  roundId: input.envelope.roundId,
  videoVisitId: input.envelope.videoVisitId,
  startedAt: readSummaryString(input.sourceSummary ?? null, "primitiveStartedAt")
    ?? readSummaryString(input.sourceSummary ?? null, "startedAt")
    ?? input.envelope.createdAt,
  endedAt: readSummaryString(input.sourceSummary ?? null, "primitiveEndedAt")
    ?? readSummaryString(input.sourceSummary ?? null, "endedAt")
    ?? input.envelope.createdAt,
  selfReportedOnly: false,
});

const buildExpectedOutcome = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  policy: PostActionInputPolicy,
) => ({
  outcomeType: policy.outcomeType,
  description: inputPayload.summary,
  expectedUrlHost: policy.childCapabilityId === "observe-page-open-attempt" ? resolveCanonicalPlatformHost(envelope.selectedMapId) : null,
  expectedUrlPrefix: null,
  expectedState: null,
  expectedTargetType: null,
  requiresBeforeAfterComparison: policy.requireBeforeAfterComparison,
  requiresVisualEvidence: policy.requiresVisualEvidence,
});

const buildVerificationPolicy = (policy: PostActionInputPolicy) => ({
  verificationMode: policy.verificationMode,
  requireAfterEvidence: policy.requireAfterEvidence,
  requireBeforeAfterComparison: policy.requireBeforeAfterComparison,
  allowSelfReportedSuccess: false,
});

const buildPostActionChainFields = (envelope: AbilityCommandEnvelope) => ({
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
});

export const buildPostActionVerificationInput = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const policy = resolvePostActionInputPolicy(envelope);
  const sourceProofRef = resolveSourceProofRef(envelope, payload);
  const sourceSummary = resolveAbilityResultProofSummary(sourceProofRef);
  return JSON.parse(JSON.stringify({
    abilityGroupId: "post-action-verification",
    childCapabilityId: policy.childCapabilityId,
    requestedBy: "orchestration",
    ...buildPostActionChainFields(envelope),
    sourceAbilityGroupId: policy.sourceAbilityGroupId,
    sourceChildCapabilityId: policy.sourceChildCapabilityId,
    sourceActionType: policy.sourceActionType,
    expectedOutcome: buildExpectedOutcome(envelope, inputPayload, policy),
    actionProof: {
      ...buildActionProof({ envelope, sourceProofRef, policy, sourceSummary }),
    },
    beforeAfterEvidence: { beforeEvidence: null, afterEvidence: null },
    observationSet: {
      observations: [buildPageStateObservation(runtime, envelope, sourceProofRef, inputPayload.summary)],
    },
    verificationPolicy: buildVerificationPolicy(policy),
    inputRef: envelope.inputRef,
    idempotencyKey: envelope.idempotencyKey,
  }));
};
