import type { MouseScrollCoordinateSpace, MouseScrollFailureReason, ParsedMouseScrollAbilityInput } from "../contract.js";
import { validateGeometryScrollProof } from "./geometry-scroll-proof-gate.js";
import { buildMouseScrollExecutionSeed } from "./mouse-scroll-input-gate.js";
import { buildMouseScrollResult } from "./mouse-scroll-result-builder.js";
import { validatePreScrollSafety } from "./pre-scroll-safety-gate.js";
import { runPrimitiveScroll } from "./primitive-scroll-runner.js";
import { resolveScrollDelta } from "./scroll-delta-resolver.js";
import { validateScrollPolicy } from "./scroll-policy-gate.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";

function buildBlockedResult(input: {
  seed: ReturnType<typeof buildMouseScrollExecutionSeed>;
  context: MouseScrollExecutionContext;
  status: "failed" | "review_required";
  failureReason: MouseScrollFailureReason;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "allow" | "block" | "review_required" | "duplicate_review_required";
  policyDecisionReason: string | null;
  geometryDecision: "allow" | "block";
  geometryDecisionReason: string | null;
  safetyDecision: "allow" | "block";
  safetyDecisionReason: string | null;
  dataQualityFlags: string[];
}) {
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();
  return buildMouseScrollResult({
    seed: input.seed,
    idempotencyKey: null,
    scrollExecutionRef: null,
    rejectionRef: `blocked:${input.seed.attemptRef}:${input.failureReason}`,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    requestedDelta: null,
    executableDelta: null,
    requestedAnchor: input.seed.requestedAnchor,
    executableAnchor: null,
    primitiveExecutionRefs: [],
    policyDecision: input.policyDecision,
    policyDecisionReason: input.policyDecisionReason,
    geometryDecision: input.geometryDecision,
    geometryDecisionReason: input.geometryDecisionReason,
    safetyDecision: input.safetyDecision,
    safetyDecisionReason: input.safetyDecisionReason,
    primitiveDecision: "not_run",
    deltaResolutionDecision: null,
    deltaCapDecision: null,
    idempotencyDecision: null,
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    primitiveCallId: null,
    primitiveStartedAt: null,
    primitiveEndedAt: null,
    primitivePortKind: "browser-controller",
    timeoutDecision: "within_limit",
    abortDecision: "not_requested",
    circuitBreakerState: "closed",
    portHangDetected: false,
    perIterationPrimitiveProofs: [],
    primitiveTimeoutMs: input.seed.safetyPolicy.primitiveTimeoutMs,
    maxDurationMs: input.seed.safetyPolicy.maxDurationMs,
    dataQualityFlags: input.dataQualityFlags,
  });
}

export async function executeMouseScroll(input: {
  request: ParsedMouseScrollAbilityInput;
  expectedCoordinateSpace: MouseScrollCoordinateSpace;
  context: MouseScrollExecutionContext;
}) {
  const seed = buildMouseScrollExecutionSeed(input.request);
  const policySnapshot = input.context.clock.now();

  const geometryGate = validateGeometryScrollProof({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (!geometryGate.ok) {
    return buildBlockedResult({
      seed,
      context: input.context,
      status: geometryGate.status,
      failureReason: geometryGate.failureReason,
      reviewRequiredReason: geometryGate.reviewRequiredReason,
      statusMessage: geometryGate.statusMessage,
      policyDecision: "block",
      policyDecisionReason: geometryGate.geometryDecisionReason,
      geometryDecision: geometryGate.geometryDecision,
      geometryDecisionReason: geometryGate.geometryDecisionReason,
      safetyDecision: "block",
      safetyDecisionReason: geometryGate.geometryDecisionReason,
      dataQualityFlags: geometryGate.dataQualityFlags,
    });
  }

  const policyGate = validateScrollPolicy({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace, nowIsoTimestamp: policySnapshot.isoTimestamp });
  if (!policyGate.ok) {
    return buildBlockedResult({
      seed,
      context: input.context,
      status: policyGate.status,
      failureReason: policyGate.failureReason,
      reviewRequiredReason: policyGate.reviewRequiredReason,
      statusMessage: policyGate.statusMessage,
      policyDecision: policyGate.policyDecision,
      policyDecisionReason: policyGate.policyDecisionReason,
      geometryDecision: "allow",
      geometryDecisionReason: "geometry_proof_bound",
      safetyDecision: "block",
      safetyDecisionReason: policyGate.policyDecisionReason,
      dataQualityFlags: policyGate.dataQualityFlags,
    });
  }

  const safetyGate = validatePreScrollSafety({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (!safetyGate.ok) {
    return buildBlockedResult({
      seed,
      context: input.context,
      status: "failed",
      failureReason: safetyGate.failureReason,
      reviewRequiredReason: null,
      statusMessage: safetyGate.statusMessage,
      policyDecision: safetyGate.policyDecision,
      policyDecisionReason: safetyGate.safetyDecisionReason,
      geometryDecision: "allow",
      geometryDecisionReason: "geometry_proof_bound",
      safetyDecision: safetyGate.safetyDecision,
      safetyDecisionReason: safetyGate.safetyDecisionReason,
      dataQualityFlags: safetyGate.dataQualityFlags,
    });
  }

  const deltaResolution = resolveScrollDelta({
    request: input.request,
    coordinateSpace: input.expectedCoordinateSpace,
    direction: input.request.direction,
    magnitude: input.request.magnitude,
    bounds: safetyGate.bounds,
    region: safetyGate.region,
  });
  if (!deltaResolution.ok) {
    return buildBlockedResult({
      seed,
      context: input.context,
      status: "failed",
      failureReason: deltaResolution.failureReason,
      reviewRequiredReason: null,
      statusMessage: deltaResolution.statusMessage,
      policyDecision: "block",
      policyDecisionReason: deltaResolution.failureReason,
      geometryDecision: "allow",
      geometryDecisionReason: "geometry_proof_bound",
      safetyDecision: "allow",
      safetyDecisionReason: safetyGate.safetyDecisionReason,
      dataQualityFlags: deltaResolution.dataQualityFlags,
    });
  }

  const reservation = input.context.idempotency.reserve({
    sessionId: seed.sessionId,
    roundId: seed.roundId,
    videoVisitId: seed.videoVisitId,
    geometryGuardRef: seed.geometryGuardRef,
    purpose: seed.purpose,
    direction: seed.direction,
    magnitude: seed.magnitude,
    delta: deltaResolution.executableDelta,
    repeat: seed.repeat,
    nowMs: input.context.clock.now().monotonicMs,
    allowReplay: seed.safetyPolicy.allowReplay,
    cooldownMs: seed.safetyPolicy.cooldownMs,
    ttlMs: seed.safetyPolicy.idempotencyTtlMs,
  });
  if (!reservation.ok) {
    const blockedSnapshot = input.context.clock.now();
    return buildMouseScrollResult({
      seed,
      idempotencyKey: reservation.idempotencyKey,
      scrollExecutionRef: reservation.scrollExecutionRef,
      rejectionRef: reservation.rejectionRef,
      status: reservation.status,
      failureReason: reservation.failureReason,
      reviewRequiredReason: reservation.reviewRequiredReason,
      statusMessage: reservation.statusMessage,
      requestedDelta: deltaResolution.requestedDelta,
      executableDelta: null,
      requestedAnchor: safetyGate.requestedAnchor,
      executableAnchor: null,
      primitiveExecutionRefs: [],
      policyDecision: reservation.policyDecision,
      policyDecisionReason: reservation.idempotencyDecision,
      geometryDecision: "allow",
      geometryDecisionReason: geometryGate.geometryDecisionReason,
      safetyDecision: safetyGate.safetyDecision,
      safetyDecisionReason: safetyGate.safetyDecisionReason,
      primitiveDecision: "not_run",
      deltaResolutionDecision: deltaResolution.deltaResolutionDecision,
      deltaCapDecision: deltaResolution.deltaCapDecision,
      idempotencyDecision: reservation.idempotencyDecision,
      startedAt: blockedSnapshot.isoTimestamp,
      endedAt: blockedSnapshot.isoTimestamp,
      durationMs: 0,
      clock: { startedMonotonicMs: blockedSnapshot.monotonicMs, endedMonotonicMs: blockedSnapshot.monotonicMs },
      primitiveCallId: null,
      primitiveStartedAt: null,
      primitiveEndedAt: null,
      primitivePortKind: "browser-controller",
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      circuitBreakerState: "closed",
      portHangDetected: false,
      perIterationPrimitiveProofs: [],
      primitiveTimeoutMs: seed.safetyPolicy.primitiveTimeoutMs,
      maxDurationMs: seed.safetyPolicy.maxDurationMs,
      dataQualityFlags: reservation.dataQualityFlags,
    });
  }

  const primitiveResult = await runPrimitiveScroll({
    context: input.context,
    attemptRef: seed.attemptRef,
    scrollExecutionRef: reservation.scrollExecutionRef,
    idempotencyKey: reservation.idempotencyKey,
    sessionId: seed.sessionId,
    roundId: seed.roundId,
    videoVisitId: seed.videoVisitId,
    geometryGuardProofRef: seed.geometryGuardProofRef ?? seed.sourceCoordinateProofRef,
    sourceCoordinateProofRef: seed.sourceCoordinateProofRef,
    sourceTargetRef: seed.sourceTargetRef ?? "mouse-scroll-target-missing",
    operatorApprovalRef: seed.safetyPolicy.desktopScreenOperatorApprovalRef,
    targetLabel: `${seed.purpose}:${seed.childCapabilityId}`,
    coordinateSpace: input.expectedCoordinateSpace,
    executableAnchor: safetyGate.executableAnchor,
    executableDelta: deltaResolution.executableDelta,
    repeat: seed.repeat,
    timeoutMs: seed.safetyPolicy.primitiveTimeoutMs,
    maxDurationMs: seed.safetyPolicy.maxDurationMs,
  });

  if (!primitiveResult.ok) {
    return buildMouseScrollResult({
      seed,
      idempotencyKey: reservation.idempotencyKey,
      scrollExecutionRef: reservation.scrollExecutionRef,
      rejectionRef: null,
      status: "failed",
      failureReason: primitiveResult.failureReason,
      reviewRequiredReason: null,
      statusMessage: primitiveResult.statusMessage,
      requestedDelta: deltaResolution.requestedDelta,
      executableDelta: null,
      requestedAnchor: safetyGate.requestedAnchor,
      executableAnchor: null,
      primitiveExecutionRefs: primitiveResult.primitiveExecutionRefs,
      policyDecision: "allow",
      policyDecisionReason: policyGate.policyDecisionReason,
      geometryDecision: "allow",
      geometryDecisionReason: geometryGate.geometryDecisionReason,
      safetyDecision: safetyGate.safetyDecision,
      safetyDecisionReason: safetyGate.safetyDecisionReason,
      primitiveDecision: primitiveResult.primitiveDecision,
      deltaResolutionDecision: deltaResolution.deltaResolutionDecision,
      deltaCapDecision: deltaResolution.deltaCapDecision,
      idempotencyDecision: reservation.idempotencyDecision,
      startedAt: primitiveResult.startedAt,
      endedAt: primitiveResult.endedAt,
      durationMs: primitiveResult.durationMs,
      clock: primitiveResult.clock,
      primitiveCallId: primitiveResult.primitiveCallId,
      primitiveStartedAt: primitiveResult.primitiveStartedAt,
      primitiveEndedAt: primitiveResult.primitiveEndedAt,
      primitivePortKind: primitiveResult.primitivePortKind,
      timeoutDecision: primitiveResult.timeoutDecision,
      abortDecision: primitiveResult.abortDecision,
      circuitBreakerState: primitiveResult.circuitBreakerState,
      portHangDetected: primitiveResult.portHangDetected,
      perIterationPrimitiveProofs: primitiveResult.perIterationPrimitiveProofs,
      primitiveTimeoutMs: seed.safetyPolicy.primitiveTimeoutMs,
      maxDurationMs: seed.safetyPolicy.maxDurationMs,
      dataQualityFlags: primitiveResult.dataQualityFlags,
    });
  }

  return buildMouseScrollResult({
    seed,
    idempotencyKey: reservation.idempotencyKey,
    scrollExecutionRef: reservation.scrollExecutionRef,
    rejectionRef: null,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    statusMessage: primitiveResult.statusMessage,
    requestedDelta: deltaResolution.requestedDelta,
    executableDelta: deltaResolution.executableDelta,
    requestedAnchor: safetyGate.requestedAnchor,
    executableAnchor: safetyGate.executableAnchor,
    primitiveExecutionRefs: primitiveResult.primitiveExecutionRefs,
    policyDecision: "allow",
    policyDecisionReason: policyGate.policyDecisionReason,
    geometryDecision: "allow",
    geometryDecisionReason: geometryGate.geometryDecisionReason,
    safetyDecision: safetyGate.safetyDecision,
    safetyDecisionReason: safetyGate.safetyDecisionReason,
    primitiveDecision: primitiveResult.primitiveDecision,
    deltaResolutionDecision: deltaResolution.deltaResolutionDecision,
    deltaCapDecision: deltaResolution.deltaCapDecision,
    idempotencyDecision: reservation.idempotencyDecision,
    startedAt: primitiveResult.startedAt,
    endedAt: primitiveResult.endedAt,
    durationMs: primitiveResult.durationMs,
    clock: primitiveResult.clock,
    primitiveCallId: primitiveResult.primitiveCallId,
    primitiveStartedAt: primitiveResult.primitiveStartedAt,
    primitiveEndedAt: primitiveResult.primitiveEndedAt,
    primitivePortKind: primitiveResult.primitivePortKind,
    timeoutDecision: primitiveResult.timeoutDecision,
    abortDecision: primitiveResult.abortDecision,
    circuitBreakerState: primitiveResult.circuitBreakerState,
    portHangDetected: primitiveResult.portHangDetected,
    perIterationPrimitiveProofs: primitiveResult.perIterationPrimitiveProofs,
    primitiveTimeoutMs: seed.safetyPolicy.primitiveTimeoutMs,
    maxDurationMs: seed.safetyPolicy.maxDurationMs,
    dataQualityFlags: deltaResolution.dataQualityFlags,
  });
}