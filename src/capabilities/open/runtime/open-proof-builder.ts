import { createHash } from "node:crypto";

import type {
  BrowserSessionSnapshot,
  OpenDataQualityFlag,
  OpenFailure,
  OpenNavigationDecision,
  OpenRuntimeProof,
  OpenSessionDecision,
  OpenTargetPolicyDecision,
  OpenTargetProfile,
  OpenUrlSafetyDecision,
  ParsedOpenRequest,
  PostOpenStateDecision,
} from "../contract.js";
import { OpenRuntimeProofSchema } from "../schema.js";
import { OPEN_ABILITY_GROUP_ID } from "../shared/open-target-profile.js";
import { OPEN_CLOCK_KIND } from "../shared/open-proof.js";

function buildProofId(seed: string): string {
  return `open-proof:${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
}

export function buildOpenProof(input: {
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
  sourceRef: string;
  openAttemptRef: string;
  pageStateRef: string | null;
  forensicsRef: string | null;
  dataQualityFlags: OpenDataQualityFlag[];
}): OpenRuntimeProof {
  const durationMs = Math.max(0, Math.round(input.endedMonotonicMs - input.startedMonotonicMs));
  const targetProfileRef = `open-target-profile:${input.profile.childCapabilityId}`;
  const browserSessionRef = `browser-session:${input.afterSession.browserProfileRef}`;
  const targetUrlSource = input.request.targetUrl ? "provided" : "policy_resolved";

  return OpenRuntimeProofSchema.parse({
    proofId: buildProofId(`${input.request.runId}:${input.idempotencyKey}:${input.endedAt}`),
    runId: input.request.runId,
    missionId: input.request.missionId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    abilityGroupId: OPEN_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    platformId: input.request.platformId,
    targetKind: input.request.targetKind,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    inputRef: `${input.request.runId}:input`,
    outputRef: `${input.request.runId}:output`,
    targetProfileRef,
    targetUrl: input.targetPolicyDecision.resolvedTargetUrl,
    openedUrl: input.navigationDecision.openedUrl,
    redirectChain: input.navigationDecision.redirectChain,
    browserProfileRef: input.afterSession.browserProfileRef,
    browserMode: input.afterSession.browserMode,
    profileVerificationStatus: input.afterSession.profileVerificationStatus,
    loginStateBefore: input.beforeSession.loginState,
    loginStateAfter: input.afterSession.loginState,
    pageTitleAfter: input.afterSession.currentTitle,
    idempotencyKey: input.idempotencyKey,
    navigationAttemptRef: input.navigationDecision.navigationAttemptRef,
    pageStateHandoffRequired: input.postOpenStateDecision.pageStateHandoffRequired,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs,
    status: input.postOpenStateDecision.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    targetPolicyDecision: input.targetPolicyDecision,
    urlSafetyDecision: input.urlSafetyDecision,
    sessionDecision: input.sessionDecision,
    navigationDecision: input.navigationDecision,
    postOpenStateDecision: input.postOpenStateDecision,
    dataQualityFlags: input.dataQualityFlags,
    browserSessionRef,
    sourceRef: input.sourceRef,
    openAttemptRef: input.openAttemptRef,
    pageStateRef: input.pageStateRef,
    forensicsRef: input.forensicsRef,
    missionIdSource: "provided",
    runIdSource: "provided",
    sessionIdSource: "provided",
    targetUrlSource,
    childCapabilityIdSource: "provided",
    failureInputParseDecision: "parsed",
    clock: {
      portKind: OPEN_CLOCK_KIND,
      startedMonotonicMs: input.startedMonotonicMs,
      endedMonotonicMs: input.endedMonotonicMs,
    },
  });
}