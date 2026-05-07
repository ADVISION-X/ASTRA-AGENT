import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import sharp from "sharp";

import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { resolveAbilityResultProofSummary, type AbilityResultProofSummary } from "../../capabilities/orchestration/runtime/ability-result-proof-summary-registry.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

type SupportedPostActionChildCapabilityId =
  | "verify-page-opened"
  | "verify-comments-panel-opened"
  | "verify-comments-panel-closed"
  | "verify-video-changed-after-scroll"
  | "verify-not-interested-result"
  | "verify-target-state-changed";

type PostActionInputPolicy = {
  childCapabilityId: SupportedPostActionChildCapabilityId;
  outcomeType: "page_opened" | "comments_panel_opened" | "comments_panel_closed" | "video_changed_after_scroll" | "not_interested_result" | "target_state_changed";
  sourceAbilityGroupId: "open" | "mouse-click" | "mouse-scroll";
  sourceChildCapabilityId: "open-tiktok" | "open-facebook" | "open-local-workbench" | "click-browser-coordinate" | "scroll-browser-viewport";
  sourceActionType: string;
  verificationMode: "observation_only" | "visual_evidence" | "before_after_comparison";
  requireAfterEvidence: boolean;
  requireBeforeAfterComparison: boolean;
  requiresVisualEvidence: boolean;
  executionRefField: "navigationAttemptRef" | "primitiveExecutionRef" | "scrollExecutionRef";
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

const resolveOpenSourceChildCapabilityId = (selectedMapId: string) => {
  if (selectedMapId.includes("facebook")) {
    return "open-facebook" as const;
  }
  if (selectedMapId.includes("tiktok")) {
    return "open-tiktok" as const;
  }
  return "open-local-workbench" as const;
};

const POST_ACTION_POLICY_BY_COMMAND: Partial<Record<string, Omit<PostActionInputPolicy, "sourceChildCapabilityId"> & {
  sourceChildCapabilityId?: PostActionInputPolicy["sourceChildCapabilityId"];
}>> = {
  "verify-page-opened": {
    childCapabilityId: "verify-page-opened",
    outcomeType: "page_opened",
    sourceAbilityGroupId: "open",
    sourceActionType: "open_feed",
    verificationMode: "observation_only",
    requireAfterEvidence: false,
    requireBeforeAfterComparison: false,
    requiresVisualEvidence: false,
    executionRefField: "navigationAttemptRef",
  },
  "verify-comments-panel-opened": {
    childCapabilityId: "verify-comments-panel-opened",
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
  "verify-comments-panel-closed": {
    childCapabilityId: "verify-comments-panel-closed",
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
  "verify-video-changed-after-scroll": {
    childCapabilityId: "verify-video-changed-after-scroll",
    outcomeType: "video_changed_after_scroll",
    sourceAbilityGroupId: "mouse-scroll",
    sourceChildCapabilityId: "scroll-browser-viewport",
    sourceActionType: "scroll_next_video",
    verificationMode: "before_after_comparison",
    requireAfterEvidence: true,
    requireBeforeAfterComparison: true,
    requiresVisualEvidence: false,
    executionRefField: "scrollExecutionRef",
  },
  "verify-not-interested-result": {
    childCapabilityId: "verify-not-interested-result",
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
  childCapabilityId: "verify-target-state-changed",
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
  return {
    ...policy,
    sourceChildCapabilityId: policy.sourceChildCapabilityId ?? resolveOpenSourceChildCapabilityId(envelope.selectedMapId),
  };
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

const resolveIsoBefore = (isoTimestamp: string) => {
  const parsed = Date.parse(isoTimestamp);
  return Number.isFinite(parsed) ? new Date(parsed - 1).toISOString() : new Date(Date.now() - 1).toISOString();
};

const hashFileSha256 = async (filePath: string) => createHash("sha256")
  .update(await readFile(filePath))
  .digest("hex");

const buildPerceptualImageSignature = async (filePath: string): Promise<string> => {
  const { data } = await sharp(filePath)
    .grayscale()
    .resize(16, 16, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = [...data];
  const average = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  const bits = pixels.map((value) => (value >= average ? "1" : "0")).join("");
  return `ahash16:${bits}`;
};

const buildImageIdentitySignature = async (filePath: string): Promise<string> => {
  try {
    return await buildPerceptualImageSignature(filePath);
  } catch {
    return `sha256:${await hashFileSha256(filePath)}`;
  }
};

const resolveExpectedUrlHost = (selectedMapId: string) => {
  if (selectedMapId.includes("facebook")) {
    return "www.facebook.com";
  }
  if (selectedMapId.includes("tiktok")) {
    return "www.tiktok.com";
  }
  return null;
};

const buildPageStateObservation = (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  sourceProofRef: string,
  summary: string,
) => {
  const session = runtime.browserController.getSessionState();
  const currentUrl = session.currentUrl || DEFAULT_PAGE_URL_BY_MAP[envelope.selectedMapId as keyof typeof DEFAULT_PAGE_URL_BY_MAP] || null;
  return {
    ref: `${envelope.inputRef}:page-state`,
    kind: "page_state" as const,
    source: {
      sourceAbilityGroupId: "page-state" as const,
      sourceChildCapabilityId: "detect-platform-page-kind",
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
  navigationAttemptRef: input.policy.executionRefField === "navigationAttemptRef" ? input.sourceProofRef : null,
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
  expectedUrlHost: policy.childCapabilityId === "verify-page-opened" ? resolveExpectedUrlHost(envelope.selectedMapId) : null,
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

const buildVideoIdentityEvidencePair = async (input: {
  runtime: WorkbenchRuntime;
  envelope: AbilityCommandEnvelope;
  payload: Record<string, string | number | boolean | null>;
  sourceProofRef: string;
  sourceSummary: AbilityResultProofSummary | null;
}) => {
  const promptInputRef = payloadValueToString(input.payload.promptInputRef);
  const screenshotEvidenceRef = payloadValueToString(input.payload.screenshotEvidenceRef);
  const beforeProofSummary = resolveAbilityResultProofSummary(promptInputRef) ?? resolveAbilityResultProofSummary(screenshotEvidenceRef);
  const beforeStorageRef = readSummaryString(beforeProofSummary, "aiInputStorageRef")
    ?? readSummaryString(beforeProofSummary, "artifactStorageRef")
    ?? readSummaryString(beforeProofSummary, "sourceStorageRef");
  const beforeSignature = beforeStorageRef
    ? await buildImageIdentitySignature(beforeStorageRef)
    : readSummaryString(beforeProofSummary, "preparedImageHash")
    ?? readSummaryString(beforeProofSummary, "outputHash")
    ?? readSummaryString(beforeProofSummary, "artifactHash");
  const beforeProofRef = readSummaryString(beforeProofSummary, "sourceScreenshotEvidenceId")
    ?? screenshotEvidenceRef
    ?? promptInputRef;

  if (beforeSignature === null || beforeProofRef === null) {
    return null;
  }

  const actionStartedAt = readSummaryString(input.sourceSummary, "primitiveStartedAt")
    ?? readSummaryString(input.sourceSummary, "startedAt")
    ?? input.envelope.createdAt;
  const actionEndedAt = readSummaryString(input.sourceSummary, "primitiveEndedAt")
    ?? readSummaryString(input.sourceSummary, "endedAt")
    ?? input.envelope.createdAt;
  const beforeCapturedAt = resolveIsoBefore(actionStartedAt);
  const afterCapture = await input.runtime.browserController.screenshotRegion({
    regionLabel: "post-scroll-video-identity",
    contentLines: ["post-action video identity evidence"],
  });
  const afterSignature = await buildImageIdentitySignature(afterCapture.sourceFilePath);
  const session = input.runtime.browserController.getSessionState();

  const beforeEvidence = {
    evidenceRef: beforeProofRef,
    evidenceKind: "video_identity" as const,
    source: {
      sourceAbilityGroupId: "screenshot" as const,
      sourceChildCapabilityId: "capture-browser-viewport",
      sourceProofRef: beforeProofRef,
    },
    capturedAt: beforeCapturedAt,
    sessionId: input.envelope.sessionId,
    roundId: input.envelope.roundId,
    videoVisitId: input.envelope.videoVisitId,
  };
  const afterEvidence = {
    evidenceRef: `${input.envelope.inputRef}:post-scroll-video-identity:evidence`,
    evidenceKind: "video_identity" as const,
    source: {
      sourceAbilityGroupId: "post-action-verification" as const,
      sourceChildCapabilityId: "verify-video-changed-after-scroll",
      sourceProofRef: input.sourceProofRef,
    },
    capturedAt: afterCapture.createdAt,
    sessionId: input.envelope.sessionId,
    roundId: input.envelope.roundId,
    videoVisitId: input.envelope.videoVisitId,
  };

  return {
    beforeAfterEvidence: { beforeEvidence, afterEvidence },
    observations: [
      {
        ref: `${input.envelope.inputRef}:video-identity:before`,
        kind: "video_identity" as const,
        source: beforeEvidence.source,
        capturedAt: beforeCapturedAt,
        sessionId: input.envelope.sessionId,
        roundId: input.envelope.roundId,
        videoVisitId: input.envelope.videoVisitId,
        payload: {
          kind: "video_identity" as const,
          role: "before" as const,
          videoId: null,
          visualSignature: beforeSignature,
          confirmed: true,
        },
      },
      {
        ref: `${input.envelope.inputRef}:video-identity:after`,
        kind: "video_identity" as const,
        source: afterEvidence.source,
        capturedAt: afterCapture.createdAt,
        sessionId: input.envelope.sessionId,
        roundId: input.envelope.roundId,
        videoVisitId: input.envelope.videoVisitId,
        payload: {
          kind: "video_identity" as const,
          role: "after" as const,
          videoId: session.currentUrl || afterCapture.pageUrl || null,
          visualSignature: afterSignature,
          confirmed: true,
        },
      },
    ],
    actionStartedAt,
    actionEndedAt,
  };
};

export const buildPostActionVerificationInput = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const policy = resolvePostActionInputPolicy(envelope);
  const sourceProofRef = resolveSourceProofRef(envelope, payload);
  const sourceSummary = resolveAbilityResultProofSummary(sourceProofRef);
  const videoIdentityEvidence = policy.childCapabilityId === "verify-video-changed-after-scroll"
    ? await buildVideoIdentityEvidencePair({ runtime, envelope, payload, sourceProofRef, sourceSummary })
    : null;
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
      ...(videoIdentityEvidence ? {
        startedAt: videoIdentityEvidence.actionStartedAt,
        endedAt: videoIdentityEvidence.actionEndedAt,
      } : {}),
    },
    beforeAfterEvidence: videoIdentityEvidence?.beforeAfterEvidence ?? { beforeEvidence: null, afterEvidence: null },
    observationSet: {
      observations: videoIdentityEvidence?.observations ?? [buildPageStateObservation(runtime, envelope, sourceProofRef, inputPayload.summary)],
    },
    verificationPolicy: buildVerificationPolicy(policy),
    confidencePolicy: { minimumConfidence: 0.5, allowReviewRequired: true },
    inputRef: envelope.inputRef,
    idempotencyKey: envelope.idempotencyKey,
  }));
};
