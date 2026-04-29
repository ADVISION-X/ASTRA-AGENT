import type {
  BrowserSessionSnapshot,
  OpenDataQualityFlag,
  OpenFailure,
  OpenNavigationDecision,
  OpenResult,
  OpenSessionDecision,
  OpenTargetPolicyDecision,
  OpenTargetProfile,
  OpenUrlSafetyDecision,
  ParsedOpenRequest,
  PostOpenStateDecision,
} from "../contract.js";
import { OpenOutputSchema, OpenResultSchema } from "../schema.js";
import { buildOpenProof } from "./open-proof-builder.js";

function buildStatusMessage(input: {
  status: OpenResult["status"];
  openedUrl: string | null;
  failureReason: OpenFailure | null;
  reviewRequiredReason: string | null;
  childCapabilityId: string;
}) {
  if (input.status === "success") {
    return `${input.childCapabilityId} completed governed open${input.openedUrl ? ` to ${input.openedUrl}` : ""}`;
  }
  if (input.status === "review_required") {
    return input.reviewRequiredReason ?? `${input.childCapabilityId} requires operator review after governed open`;
  }
  return input.failureReason?.message ?? `${input.childCapabilityId} failed governed open`;
}

export function buildOpenResult(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  targetPolicyDecision: OpenTargetPolicyDecision;
  urlSafetyDecision: OpenUrlSafetyDecision;
  sessionDecision: OpenSessionDecision;
  navigationDecision: OpenNavigationDecision;
  postOpenStateDecision: PostOpenStateDecision;
  idempotencyKey: string;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  startedAt: string;
  endedAt: string;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  failureReason: OpenFailure | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: OpenDataQualityFlag[];
}): OpenResult {
  const sourceRef = input.request.sourceRef ?? `${input.request.sourceAbilityGroupId}:${input.request.sourceChildCapabilityId ?? "unknown"}:${input.request.runId}`;
  const openAttemptRef = input.navigationDecision.navigationAttemptRef;
  const pageStateRef = input.postOpenStateDecision.pageStateHandoffRequired
    ? `page-state:${input.request.roundId ?? "no-round"}:${input.request.childCapabilityId}`
    : null;
  const forensicsRef = null;

  const status = input.postOpenStateDecision.status;
  const output = status === "success"
    ? OpenOutputSchema.parse({
        targetProfileRef: input.targetPolicyDecision.targetProfileRef,
        targetUrl: input.targetPolicyDecision.resolvedTargetUrl,
        openedUrl: input.navigationDecision.openedUrl,
        redirectChain: input.navigationDecision.redirectChain,
        pageTitleAfter: input.afterSession.currentTitle,
        browserSessionRef: `browser-session:${input.afterSession.browserProfileRef}`,
        browserProfileRef: input.afterSession.browserProfileRef,
        browserMode: input.afterSession.browserMode,
        profileVerificationStatus: input.afterSession.profileVerificationStatus,
        loginStateBefore: input.beforeSession.loginState,
        loginStateAfter: input.afterSession.loginState,
        sourceRef,
        openAttemptRef,
        pageStateRef,
        forensicsRef,
        fallbackUsed: input.navigationDecision.fallbackUsed,
        pageStateHandoffRequired: input.postOpenStateDecision.pageStateHandoffRequired,
      })
    : null;

  return OpenResultSchema.parse({
    abilityGroupId: "open",
    childCapabilityId: input.request.childCapabilityId,
    platformId: input.request.platformId,
    targetKind: input.request.targetKind,
    status,
    message: buildStatusMessage({
      status,
      openedUrl: input.navigationDecision.openedUrl,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      childCapabilityId: input.request.childCapabilityId,
    }),
    targetUrl: input.targetPolicyDecision.resolvedTargetUrl,
    openedUrl: input.navigationDecision.openedUrl,
    targetTitle: input.targetPolicyDecision.resolvedTargetTitle,
    pageTitleAfter: input.afterSession.currentTitle,
    pageStateHandoffRequired: input.postOpenStateDecision.pageStateHandoffRequired,
    output,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    runtimeProof: buildOpenProof({
      request: input.request,
      profile: input.profile,
      targetPolicyDecision: input.targetPolicyDecision,
      urlSafetyDecision: input.urlSafetyDecision,
      sessionDecision: input.sessionDecision,
      navigationDecision: input.navigationDecision,
      postOpenStateDecision: input.postOpenStateDecision,
      idempotencyKey: input.idempotencyKey,
      beforeSession: input.beforeSession,
      afterSession: input.afterSession,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      startedMonotonicMs: input.startedMonotonicMs,
      endedMonotonicMs: input.endedMonotonicMs,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      sourceRef,
      openAttemptRef,
      pageStateRef,
      forensicsRef,
      dataQualityFlags: input.dataQualityFlags,
    }),
  });
}