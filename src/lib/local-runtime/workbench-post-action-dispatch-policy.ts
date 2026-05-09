import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";

type SupportedPostActionChildCapabilityId =
  | "observe-page-open-attempt"
  | "observe-comments-panel-open-attempt"
  | "observe-comments-panel-close-attempt"
  | "observe-not-interested-attempt"
  | "observe-target-state-transition"
  | "verify-action-result";

export type PostActionInputPolicy = {
  childCapabilityId: SupportedPostActionChildCapabilityId;
  outcomeType: "page_opened" | "comments_panel_opened" | "comments_panel_closed" | "not_interested_applied" | "target_state_changed";
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
    outcomeType: "not_interested_applied",
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
  childCapabilityId: "verify-action-result",
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

export const normalizePageStateLogin = (loginState: string | null | undefined) => {
  if (loginState === "logged_in") {
    return "ready" as const;
  }
  if (loginState === "login_required" || loginState === "review_required") {
    return loginState;
  }
  return "unknown" as const;
};

export const resolveCanonicalPlatformUrl = (selectedMapId: string | null | undefined): string | null =>
  DEFAULT_PAGE_URL_BY_MAP[selectedMapId as keyof typeof DEFAULT_PAGE_URL_BY_MAP] ?? null;

const resolveCanonicalPlatformHost = (selectedMapId: string | null | undefined): string | null => {
  const canonicalUrl = resolveCanonicalPlatformUrl(selectedMapId);
  return canonicalUrl ? new URL(canonicalUrl).hostname : null;
};

export const resolvePostActionInputPolicy = (envelope: AbilityCommandEnvelope): PostActionInputPolicy => {
  return POST_ACTION_POLICY_BY_COMMAND[envelope.commandName] ?? DEFAULT_POST_ACTION_POLICY;
};

export const buildExpectedOutcome = (
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

export const buildVerificationPolicy = (policy: PostActionInputPolicy) => ({
  verificationMode: policy.verificationMode,
  requireAfterEvidence: policy.requireAfterEvidence,
  requireBeforeAfterComparison: policy.requireBeforeAfterComparison,
  allowSelfReportedSuccess: false,
});

export const buildPostActionChainFields = (envelope: AbilityCommandEnvelope) => ({
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