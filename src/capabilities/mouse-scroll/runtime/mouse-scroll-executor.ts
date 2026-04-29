import type { MouseScrollAbilityContext, MouseScrollCoordinateSpace, MouseScrollFailureReason, ParsedMouseScrollAbilityInput } from "../contract.js";
import { validateGeometryScrollProof } from "./geometry-scroll-proof-gate.js";
import { buildMouseScrollExecutionSeed } from "./mouse-scroll-input-gate.js";
import { buildMouseScrollResult } from "./mouse-scroll-result-builder.js";
import { validatePreScrollSafety } from "./pre-scroll-safety-gate.js";
import { runPrimitiveScroll } from "./primitive-scroll-runner.js";
import { resolveScrollDelta } from "./scroll-delta-resolver.js";
import { validateScrollPolicy } from "./scroll-policy-gate.js";

function buildBlockedResult(input: {
  seed: ReturnType<typeof buildMouseScrollExecutionSeed>;
  context: MouseScrollAbilityContext;
  status: "failed" | "review_required";
  failureReason: MouseScrollFailureReason;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "allow" | "block" | "review_required" | "duplicate_skipped";
  geometryDecision: "allow" | "block" | "review_required";
  dataQualityFlags: string[];
}) {
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();
  return buildMouseScrollResult({
    seed: input.seed,
    idempotencyKey: `blocked:${input.seed.sessionId}:${input.seed.childCapabilityId}:${input.failureReason}`,
    scrollExecutionRef: `blocked:${input.seed.sessionId}:${input.seed.childCapabilityId}:${input.failureReason}`,
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
    geometryDecision: input.geometryDecision,
    primitiveDecision: "not_run",
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    dataQualityFlags: input.dataQualityFlags,
  });
}

export async function executeMouseScroll(input: {
  request: ParsedMouseScrollAbilityInput;
  expectedCoordinateSpace: MouseScrollCoordinateSpace;
  context: MouseScrollAbilityContext;
}) {
  const seed = buildMouseScrollExecutionSeed(input.request);

  const geometryGate = validateGeometryScrollProof({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (!geometryGate.ok) {
    return buildBlockedResult({
      seed,
      context: input.context,
      status: geometryGate.status,
      failureReason: geometryGate.failureReason,
      reviewRequiredReason: geometryGate.reviewRequiredReason,
      statusMessage: geometryGate.statusMessage,
      policyDecision: geometryGate.status === "review_required" ? "review_required" : "block",
      geometryDecision: geometryGate.geometryDecision,
      dataQualityFlags: geometryGate.dataQualityFlags,
    });
  }

  const policyGate = validateScrollPolicy({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (!policyGate.ok) {
    return buildBlockedResult({
      seed,
      context: input.context,
      status: policyGate.status,
      failureReason: policyGate.failureReason,
      reviewRequiredReason: policyGate.reviewRequiredReason,
      statusMessage: policyGate.statusMessage,
      policyDecision: policyGate.policyDecision,
      geometryDecision: "allow",
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
      geometryDecision: "allow",
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
      geometryDecision: "allow",
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
  });
  if (!reservation.ok) {
    return buildMouseScrollResult({
      seed,
      idempotencyKey: reservation.idempotencyKey,
      scrollExecutionRef: reservation.scrollExecutionRef,
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
      geometryDecision: "allow",
      primitiveDecision: "not_run",
      startedAt: input.context.clock.now().isoTimestamp,
      endedAt: input.context.clock.now().isoTimestamp,
      durationMs: 0,
      clock: { startedMonotonicMs: input.context.clock.now().monotonicMs, endedMonotonicMs: input.context.clock.now().monotonicMs },
      dataQualityFlags: reservation.dataQualityFlags,
    });
  }

  const primitiveResult = await runPrimitiveScroll({
    context: input.context,
    scrollExecutionRef: reservation.scrollExecutionRef,
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
      geometryDecision: "allow",
      primitiveDecision: primitiveResult.primitiveDecision,
      startedAt: primitiveResult.startedAt,
      endedAt: primitiveResult.endedAt,
      durationMs: primitiveResult.durationMs,
      clock: primitiveResult.clock,
      dataQualityFlags: primitiveResult.dataQualityFlags,
    });
  }

  return buildMouseScrollResult({
    seed,
    idempotencyKey: reservation.idempotencyKey,
    scrollExecutionRef: reservation.scrollExecutionRef,
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
    geometryDecision: "allow",
    primitiveDecision: primitiveResult.primitiveDecision,
    startedAt: primitiveResult.startedAt,
    endedAt: primitiveResult.endedAt,
    durationMs: primitiveResult.durationMs,
    clock: primitiveResult.clock,
    dataQualityFlags: deltaResolution.dataQualityFlags,
  });
}