import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import { PageStateAbilityInputSchema } from "../schema.js";
import type { PageStateAbilityInput, PageStateChildCapabilityId, PageStateDataQualityFlag, PageStateFailureReason, PageStateType } from "../schema.js";
import { createPageStateFingerprint } from "./page-state-fingerprint.js";
import { buildPageStateRuntimeProof } from "./page-state-proof-builder.js";
import { buildPageStateResult } from "./page-state-result-builder.js";

function createFallbackRequest(rawInput: unknown, childCapabilityId: PageStateChildCapabilityId): PageStateAbilityInput {
  const fallback = PageStateAbilityInputSchema.parse({
    childCapabilityId,
    runId: "invalid-run",
    missionId: "invalid-mission",
    sessionId: "invalid-session",
    roundId: "invalid-round",
    videoVisitId: "invalid-video-visit",
    requestedBy: "page-state-invalid-input",
    snapshot: {
      snapshotId: "invalid-snapshot",
      currentUrl: "https://invalid.local/",
      currentTitle: "Invalid Page State Input",
      browserLoginState: "unknown",
      viewport: { width: 1, height: 1, deviceScaleFactor: 1 },
      scrollOffset: { x: 0, y: 0 },
      capturedAt: "1970-01-01T00:00:00.000Z",
      sourceAbilityGroupId: "runtime-signal",
      sourceChildCapabilityId: "invalid-input",
      sourceProofRef: "page-state-invalid-input:proof",
    },
    observations: [],
    sourceEvidenceRefs: ["page-state-invalid-input:evidence"],
    freshnessPolicy: { maxSnapshotAgeMs: 0, maxObservationAgeMs: 0, maxObservationSkewMs: 0 },
    confidencePolicy: { minimumConfidence: 1, allowReviewRequired: false },
    statePolicy: { expectedPlatformHost: null, allowLocalWorkbench: false, allowModalOverlay: false, allowUnknownState: false },
    openHandoff: { openProofRef: "page-state-invalid-input:handoff", browserSessionRef: "page-state-invalid-input:session", platformProfileId: "invalid-profile" },
    previousPageStateFingerprint: null,
  });

  if (typeof rawInput !== "object" || rawInput === null) {
    return fallback;
  }

  const partial = rawInput as Partial<Record<string, unknown>>;
  return {
    ...fallback,
    childCapabilityId: typeof partial.childCapabilityId === "string" ? (partial.childCapabilityId as PageStateChildCapabilityId) : childCapabilityId,
  };
}

export function dispatchInvalidPageStateInput(input: {
  rawInput: unknown;
  clock: PageStateClockPort;
}): import("../schema.js").PageStateAbilityResult {
  const request = createFallbackRequest(input.rawInput, "detect-page-abnormality");
  return dispatchPageStateFailure({
    request,
    failureReason: "invalid_input",
    stateSummary: "Page State rejected the request because the public input schema did not parse.",
    reviewRequiredReason: null,
    clock: input.clock,
  });
}

export function dispatchPageStateFailure(input: {
  request: PageStateAbilityInput;
  failureReason: PageStateFailureReason;
  stateSummary: string;
  reviewRequiredReason?: string | null;
  pageStateType?: PageStateType;
  status?: "failed" | "review_required" | "blocked";
  decision?: "fail" | "review_required" | "block";
  dataQualityFlags?: PageStateDataQualityFlag[];
  clock: PageStateClockPort;
}): import("../schema.js").PageStateAbilityResult {
  const startedAt = input.clock.now();
  const endedAt = input.clock.now();
  const observationRefs = input.request.observations.map((observation) => observation.observationId);
  const pageStateType = input.pageStateType ?? "unknown_page";
  const pageStateFingerprint = createPageStateFingerprint({ request: input.request, pageStateType, observationRefs });
  const outcome = {
    childCapabilityId: input.request.childCapabilityId,
    pageStateType,
    stateSummary: input.stateSummary,
    confidence: 0,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    dataQualityFlags: input.dataQualityFlags ?? [],
    matchedObservationIds: observationRefs,
    supportingEvidenceRefs: [...input.request.sourceEvidenceRefs],
    supportingReasons: [input.stateSummary],
    status: input.status ?? "failed",
    decision: input.decision ?? "fail",
    failureReason: input.failureReason,
    resolvedProfileId: null,
  };
  const runtimeProof = buildPageStateRuntimeProof({
    request: input.request,
    timing: { startedAt, endedAt },
    trace: {
      inputDecision: input.failureReason === "invalid_input" ? "fail" : "allow",
      sourceDecision: input.failureReason === "observation_source_forbidden" ? "fail" : "allow",
      freshnessDecision: input.failureReason === "snapshot_stale" || input.failureReason === "observation_stale" ? "review_required" : "fail",
      platformDecision: input.failureReason === "platform_mismatch" ? "block" : "match",
      classificationDecision: input.decision ?? "fail",
      proceedDecision: input.decision ?? "fail",
    },
    status: outcome.status,
    decision: outcome.decision,
    pageStateType,
    confidence: outcome.confidence,
    failureReason: input.failureReason,
    reviewRequiredReason: outcome.reviewRequiredReason,
    pageStateFingerprint,
    observationRefs,
    dataQualityFlags: outcome.dataQualityFlags,
  });

  return buildPageStateResult({
    request: input.request,
    outcome,
    runtimeProof,
    observationRefs,
    pageStateFingerprint,
  });
}