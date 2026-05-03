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

type OpenResultBuilderInput = {
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
  dataQualityFlags: OpenDataQualityFlag[];
  sessionSnapshotAvailable: boolean;
  sessionSnapshotFailureReason: string | null;
};

type OpenResultEnvelopeInput = OpenResultBuilderInput & {
  output: OpenResult["output"];
  sourceRef: string;
  openAttemptRef: string;
  pageStateHandoffRef: string | null;
};

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

const buildOpenResultOutput = (input: OpenResultBuilderInput, sourceRef: string, openAttemptRef: string, pageStateHandoffRef: string | null) => {
  if (input.postOpenStateDecision.status !== "success") {
    return null;
  }

  return OpenOutputSchema.parse({
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
    pageStateHandoffRef,
    pageStateHandoffRequired: true,
  });
};

const buildOpenResultEnvelopeCoreFields = (input: OpenResultEnvelopeInput, runtimeProof: OpenResult["runtimeProof"]) => ({
  abilityGroupId: "open",
  childCapabilityId: input.request.childCapabilityId,
  platformId: input.request.platformId,
  targetKind: input.request.targetKind,
  status: input.postOpenStateDecision.status,
  missionId: input.request.missionId,
  runId: input.request.runId,
  sessionId: input.request.sessionId,
  roundId: input.request.roundId,
  videoVisitId: input.request.videoVisitId,
  stepId: input.request.stepId,
  mapPackageId: input.request.mapPackageId,
  mapPackageVersion: input.request.mapPackageVersion,
  selectedMapId: input.request.selectedMapId,
  selectedMapVersion: input.request.selectedMapVersion,
  activationSnapshotRef: input.request.activationSnapshotRef,
  capabilityCallId: input.request.capabilityCallId,
  nerveBusEnvelopeId: input.request.nerveBusEnvelopeId,
  message: buildStatusMessage({
    status: input.postOpenStateDecision.status,
    openedUrl: input.navigationDecision.openedUrl,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    childCapabilityId: input.request.childCapabilityId,
  }),
  targetUrl: input.targetPolicyDecision.resolvedTargetUrl,
  openedUrl: input.navigationDecision.openedUrl,
  targetTitle: input.targetPolicyDecision.resolvedTargetTitle,
  pageTitleAfter: input.navigationDecision.pageTitleAfter,
  pageStateHandoffRequired: input.postOpenStateDecision.pageStateHandoffRequired,
  output: input.output,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  diagnosticPayloadRef: runtimeProof.diagnosticPayloadRef,
  dataQualityFlags: runtimeProof.dataQualityFlags,
});

const buildOpenResultRuntimeProof = (input: OpenResultEnvelopeInput) => buildOpenProof({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: input.targetPolicyDecision,
    urlSafetyDecision: input.urlSafetyDecision,
    sessionDecision: input.sessionDecision,
    navigationDecision: input.navigationDecision,
    postOpenStateDecision: input.postOpenStateDecision,
    idempotencyKey: input.idempotencyKey,
    idempotencyDecision: input.idempotencyDecision,
    beforeSession: input.beforeSession,
    afterSession: input.afterSession,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    startedMonotonicMs: input.startedMonotonicMs,
    endedMonotonicMs: input.endedMonotonicMs,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    sourceRef: input.sourceRef,
    openAttemptRef: input.openAttemptRef,
    pageStateHandoffRef: input.pageStateHandoffRef,
    sessionSnapshotAvailable: input.sessionSnapshotAvailable,
    sessionSnapshotFailureReason: input.sessionSnapshotFailureReason,
    dataQualityFlags: input.dataQualityFlags,
  });

const buildOpenResultEnvelope = (input: OpenResultEnvelopeInput): OpenResult => {
  const runtimeProof = buildOpenResultRuntimeProof(input);

  return OpenResultSchema.parse({
    ...buildOpenResultEnvelopeCoreFields(input, runtimeProof),
    runtimeProof,
  });
};

export function buildOpenResult(input: OpenResultBuilderInput): OpenResult {
  const sourceRef = input.request.sourceRef;
  const openAttemptRef = input.navigationDecision.navigationAttemptRef;
  const pageStateHandoffRef = input.postOpenStateDecision.pageStateHandoffRef;

  const output = buildOpenResultOutput(input, sourceRef, openAttemptRef, pageStateHandoffRef);

  return buildOpenResultEnvelope({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: input.targetPolicyDecision,
    urlSafetyDecision: input.urlSafetyDecision,
    sessionDecision: input.sessionDecision,
    navigationDecision: input.navigationDecision,
    postOpenStateDecision: input.postOpenStateDecision,
    idempotencyKey: input.idempotencyKey,
    idempotencyDecision: input.idempotencyDecision,
    beforeSession: input.beforeSession,
    afterSession: input.afterSession,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    startedMonotonicMs: input.startedMonotonicMs,
    endedMonotonicMs: input.endedMonotonicMs,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.dataQualityFlags,
    sessionSnapshotAvailable: input.sessionSnapshotAvailable,
    sessionSnapshotFailureReason: input.sessionSnapshotFailureReason,
    output,
    sourceRef,
    openAttemptRef,
    pageStateHandoffRef,
  });
}