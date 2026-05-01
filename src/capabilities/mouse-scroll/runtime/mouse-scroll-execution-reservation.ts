import { buildReservationRejectedResult } from "./mouse-scroll-blocked-result-builder.js";
import { buildPrimitiveFailureResult, buildPrimitiveSuccessResult } from "./mouse-scroll-primitive-result-builder.js";
import type {
  MouseScrollExecutionInput,
} from "./mouse-scroll-execution-contract.js";
import type { ReservedMouseScrollExecution, ValidatedMouseScrollExecution } from "./mouse-scroll-execution-stage-types.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";
import { runPrimitiveScroll } from "./primitive-scroll-runner.js";

export function reserveMouseScrollExecution(validated: ValidatedMouseScrollExecution, context: MouseScrollExecutionContext) {
  const reservation = context.idempotency.reserve({
    sessionId: validated.seed.sessionId,
    roundId: validated.seed.roundId,
    videoVisitId: validated.seed.videoVisitId,
    geometryGuardRef: validated.seed.geometryGuardRef,
    purpose: validated.seed.purpose,
    direction: validated.seed.direction,
    magnitude: validated.seed.magnitude,
    delta: validated.deltaResolution.executableDelta,
    repeat: validated.seed.repeat,
    nowMs: context.clock.now().monotonicMs,
    allowReplay: validated.seed.safetyPolicy.allowReplay,
    cooldownMs: validated.seed.safetyPolicy.cooldownMs,
    ttlMs: validated.seed.safetyPolicy.idempotencyTtlMs,
  });

  return reservation.ok
    ? { ok: true as const, execution: { ...validated, reservation } }
    : { ok: false as const, result: buildReservationRejectedResult(validated, reservation, context) };
}

const createPrimitiveScrollInput = (reserved: ReservedMouseScrollExecution, input: MouseScrollExecutionInput) => ({
  context: input.context,
  attemptRef: reserved.seed.attemptRef,
  scrollExecutionRef: reserved.reservation.scrollExecutionRef,
  idempotencyKey: reserved.reservation.idempotencyKey,
  sessionId: reserved.seed.sessionId,
  roundId: reserved.seed.roundId,
  videoVisitId: reserved.seed.videoVisitId,
  geometryGuardProofRef: reserved.seed.geometryGuardProofRef ?? reserved.seed.sourceCoordinateProofRef,
  sourceCoordinateProofRef: reserved.seed.sourceCoordinateProofRef,
  sourceTargetRef: reserved.seed.sourceTargetRef ?? "mouse-scroll-target-missing",
  operatorApprovalRef: reserved.seed.safetyPolicy.desktopScreenOperatorApprovalRef,
  targetLabel: `${reserved.seed.purpose}:${reserved.seed.childCapabilityId}`,
  coordinateSpace: input.expectedCoordinateSpace,
  executableAnchor: reserved.safetyGate.executableAnchor,
  executableDelta: reserved.deltaResolution.executableDelta,
  repeat: reserved.seed.repeat,
  timeoutMs: reserved.seed.safetyPolicy.primitiveTimeoutMs,
  maxDurationMs: reserved.seed.safetyPolicy.maxDurationMs,
});

export async function runReservedMouseScrollExecution(reserved: ReservedMouseScrollExecution, input: MouseScrollExecutionInput) {
  const primitiveResult = await runPrimitiveScroll(createPrimitiveScrollInput(reserved, input));
  return primitiveResult.ok
    ? buildPrimitiveSuccessResult(reserved, primitiveResult)
    : buildPrimitiveFailureResult(reserved, primitiveResult);
}