import { createHash } from "node:crypto";

import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import { PAGE_STATE_ABILITY_GROUP_ID, PageStateAbilityResultSchema, PageStateRuntimeProofSchema } from "../schema.js";
import type { PageStateAbilityInput, PageStateDataQualityFlag, PageStateFailureReason, PageStateType } from "../schema.js";
import type { PageStateExecutionTrace } from "../shared/page-state-types.js";
import { createPageStateFingerprint } from "./page-state-fingerprint.js";
import { buildPageStateRuntimeProof } from "./page-state-proof-builder.js";
import { buildPageStateResult } from "./page-state-result-builder.js";

const PAGE_STATE_FAILURE_TRACE_OVERRIDES: Partial<Record<PageStateFailureReason, Partial<PageStateExecutionTrace>>> = {
  invalid_input: { inputDecision: "fail" },
  observation_source_forbidden: { sourceDecision: "fail" },
  payload_budget_exceeded: { payloadBudgetDecision: "fail" },
  missing_observation_support: { observationBindingDecision: "fail" },
  snapshot_stale: { freshnessDecision: "review_required" },
  observation_stale: { freshnessDecision: "review_required" },
  platform_mismatch: { platformDecision: "block" },
  output_boundary_violation: { outputBoundaryDecision: "fail" },
  insufficient_signal: { criticalDataQualityDecision: "review_required" },
  low_confidence: { criticalDataQualityDecision: "review_required" },
} as const;

const buildPageStateFailureTrace = (input: {
  failureReason: PageStateFailureReason;
  decision?: "fail" | "review_required" | "block";
}): PageStateExecutionTrace => {
  const override = PAGE_STATE_FAILURE_TRACE_OVERRIDES[input.failureReason];
  const classificationDecision = input.decision ?? "fail";
  return {
    inputDecision: override?.inputDecision ?? "allow",
    sourceDecision: override?.sourceDecision ?? "allow",
    payloadBudgetDecision: override?.payloadBudgetDecision ?? "allow",
    observationBindingDecision: override?.observationBindingDecision ?? "bound",
    freshnessDecision: override?.freshnessDecision ?? "fail",
    platformDecision: override?.platformDecision ?? "match",
    classificationDecision,
    outputBoundaryDecision: override?.outputBoundaryDecision ?? "allow",
    criticalDataQualityDecision: override?.criticalDataQualityDecision ?? "fail",
    proceedDecision: classificationDecision,
  };
};

export function dispatchInvalidPageStateInput(input: {
  rawInput: unknown;
  issues: readonly { path?: readonly (string | number)[]; message: string }[];
  clock: PageStateClockPort;
}): import("../schema.js").PageStateAbilityResult {
  const startedAt = input.clock.now();
  const endedAt = input.clock.now();
  const receivedShapeHash = createHash("sha256").update(JSON.stringify(input.rawInput)).digest("hex");
  const issueSummary = input.issues.map((issue) => `${issue.path?.join(".") ?? "input"}: ${issue.message}`).join("; ");
  const diagnosticPayloadRef = `page-state-diagnostic:invalid-input:${receivedShapeHash.slice(0, 24)}`;
  const runtimeProof = PageStateRuntimeProofSchema.parse({
    proofId: `page-state-proof:invalid-input:${receivedShapeHash.slice(0, 24)}`,
    runId: null, missionId: null, sessionId: null, roundId: null, videoVisitId: null,
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID, childCapabilityId: null,
    inputRef: `page-state-input:invalid:${receivedShapeHash.slice(0, 16)}`,
    outputRef: null, diagnosticPayloadRef, debugLogRef: `page-state-debug:invalid-input:${receivedShapeHash.slice(0, 24)}`,
    structuredRuntimeEventRef: null, snapshotId: null, snapshotProofRef: null, openHandoffProofRef: null,
    browserSessionRef: null, platformProfileId: null, resolvedPlatformProfileId: null, matchedHost: null,
    sourceAbilityGroupId: null, sourceChildCapabilityId: null, observationRefs: [], sourceEvidenceRefs: [],
    inputPayloadHash: receivedShapeHash, snapshotHash: null, observationHash: null, pageStateFingerprint: null,
    previousPageStateFingerprint: null, currentUrl: null, currentTitle: null, classificationSource: "invalid_input_failure",
    inputDecision: "fail", sourceBindingDecision: "fail", observationBindingDecision: "fail", freshnessDecision: "fail",
    platformDecision: "fail", classificationDecision: "fail", outputBoundaryDecision: "fail", criticalDataQualityDecision: "fail",
    proceedDecision: "fail", startedAt: startedAt.isoTimestamp, endedAt: endedAt.isoTimestamp,
    durationMs: endedAt.epochMs - startedAt.epochMs, status: "failed", decision: "fail", failureReason: "invalid_input",
    reviewRequiredReason: null, dataQualityFlags: ["insufficient_signal"], receivedShapeHash,
  });

  return PageStateAbilityResultSchema.parse({
    status: "failed", decision: "fail", abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID, childCapabilityId: null,
    runId: null, missionId: null, sessionId: null, roundId: null, videoVisitId: null,
    output: null, pageStateType: null, stateSummary: null, confidence: null,
    evidenceRefs: [], observationRefs: [], sourceEvidenceRefs: [], pageStateFingerprint: null, previousPageStateFingerprint: null,
    failureReason: "invalid_input", reviewRequiredReason: null, dataQualityFlags: ["insufficient_signal"],
    debugLogRef: runtimeProof.debugLogRef, structuredRuntimeEventRef: null, diagnosticPayloadRef, receivedShapeHash, runtimeProof,
  });
}

export function dispatchPageStateFailure(input: {
  request: PageStateAbilityInput;
  failureReason: PageStateFailureReason;
  stateSummary: string;
  reviewRequiredReason?: string | null;
  pageStateType?: PageStateType;
  status?: "failed" | "review_required";
  decision?: "fail" | "review_required" | "block";
  dataQualityFlags?: PageStateDataQualityFlag[];
  clock: PageStateClockPort;
}): import("../schema.js").PageStateAbilityResult {
  const startedAt = input.clock.now();
  const endedAt = input.clock.now();
  const observationRefs = input.request.observations.map((observation) => observation.observationId);
  const pageStateType = input.pageStateType ?? "unknown_page";
  const pageStateFingerprint = createPageStateFingerprint({ request: input.request, pageStateType, observationRefs });
  const outcome = { childCapabilityId: input.request.childCapabilityId, pageStateType, stateSummary: input.stateSummary, confidence: 0, reviewRequiredReason: input.reviewRequiredReason ?? null, dataQualityFlags: input.dataQualityFlags ?? [], matchedObservationIds: observationRefs, supportingEvidenceRefs: [...input.request.sourceEvidenceRefs], supportingReasons: [input.stateSummary], status: input.status ?? "failed", decision: input.decision ?? "fail", failureReason: input.failureReason, resolvedProfileId: null, matchedHost: null };
  const runtimeProof = buildPageStateRuntimeProof({
    request: input.request,
    timing: { startedAt, endedAt },
    trace: buildPageStateFailureTrace({ failureReason: input.failureReason, decision: input.decision ?? "fail" }),
    status: outcome.status, decision: outcome.decision, pageStateType, confidence: outcome.confidence, failureReason: input.failureReason, reviewRequiredReason: outcome.reviewRequiredReason, pageStateFingerprint, observationRefs, dataQualityFlags: outcome.dataQualityFlags,
    diagnosticPayloadRef: `page-state-diagnostic:${input.request.runId}:${input.request.childCapabilityId}:${input.failureReason}`,
  });

  return buildPageStateResult({ request: input.request, outcome, runtimeProof, observationRefs, pageStateFingerprint });
}