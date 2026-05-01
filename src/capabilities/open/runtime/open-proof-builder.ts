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

type OpenProofBuilderInput = {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  targetPolicyDecision: OpenTargetPolicyDecision;
  urlSafetyDecision: OpenUrlSafetyDecision;
  sessionDecision: OpenSessionDecision;
  navigationDecision: OpenNavigationDecision;
  postOpenStateDecision: PostOpenStateDecision;
  idempotencyKey: string;
  idempotencyDecision: "reserved" | "duplicate_review_required" | "already_on_target" | "scope_capacity_exceeded" | "not_started";
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
  pageStateHandoffRef: string | null;
  sessionSnapshotAvailable: boolean;
  sessionSnapshotFailureReason: string | null;
  dataQualityFlags: OpenDataQualityFlag[];
};

const buildOpenProofCoreFields = (input: OpenProofBuilderInput) => ({
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
  missionIdSource: "provided" as const,
  runIdSource: "provided" as const,
  sessionIdSource: "provided" as const,
  childCapabilityIdSource: "provided" as const,
  failureInputParseDecision: "parsed" as const,
  inputRef: `${input.request.runId}:input`,
  outputRef: input.postOpenStateDecision.status === "success" ? `${input.request.runId}:output` : null,
  diagnosticPayloadRef: input.postOpenStateDecision.status === "success" ? null : `${input.request.runId}:diagnostic`,
  targetProfileRef: input.targetPolicyDecision.targetProfileRef,
  targetUrl: input.targetPolicyDecision.resolvedTargetUrl,
  targetUrlSource: input.targetPolicyDecision.targetUrlSource,
  openedUrl: input.navigationDecision.openedUrl,
  redirectChain: input.navigationDecision.redirectChain,
  browserProfileRef: input.afterSession.browserProfileRef,
  browserMode: input.afterSession.browserMode,
  profileVerificationStatus: input.afterSession.profileVerificationStatus,
  loginStateBefore: input.beforeSession.loginState,
  loginStateAfter: input.afterSession.loginState,
  pageTitleAfter: input.afterSession.currentTitle,
});

const buildOpenProofDecisionFields = (input: OpenProofBuilderInput) => ({
  idempotencyKey: input.idempotencyKey,
  idempotencyDecision: input.idempotencyDecision,
  openAttemptRef: input.openAttemptRef,
  navigationCallId: input.navigationDecision.navigationCallId,
  navigationAttemptRef: input.navigationDecision.navigationAttemptRef,
  timeoutDecision: input.navigationDecision.timeoutDecision,
  abortDecision: input.navigationDecision.abortDecision,
  circuitBreakerState: input.navigationDecision.circuitBreakerState,
  targetPolicyDecision: input.targetPolicyDecision,
  urlSafetyDecision: input.urlSafetyDecision,
  sessionDecision: input.sessionDecision,
  navigationDecision: input.navigationDecision,
  postOpenDecision: input.postOpenStateDecision,
  preliminaryOpenClassification: input.postOpenStateDecision.classification,
  pageStateHandoffRequired: input.postOpenStateDecision.pageStateHandoffRequired,
  pageStateHandoffRef: input.pageStateHandoffRef,
});

const buildOpenProofTailFields = (input: OpenProofBuilderInput, durationMs: number) => ({
  sourceRef: input.sourceRef,
  sessionSnapshotAvailable: input.sessionSnapshotAvailable,
  sessionSnapshotFailureReason: input.sessionSnapshotFailureReason,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs,
  status: input.postOpenStateDecision.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  dataQualityFlags: input.dataQualityFlags,
  clock: {
    portKind: OPEN_CLOCK_KIND,
    startedMonotonicMs: input.startedMonotonicMs,
    endedMonotonicMs: input.endedMonotonicMs,
  },
});

export function buildOpenProof(input: OpenProofBuilderInput): OpenRuntimeProof {
  const durationMs = Math.max(0, Math.round(input.endedMonotonicMs - input.startedMonotonicMs));

  return OpenRuntimeProofSchema.parse({
    ...buildOpenProofCoreFields(input),
    ...buildOpenProofDecisionFields(input),
    ...buildOpenProofTailFields(input, durationMs),
  });
}