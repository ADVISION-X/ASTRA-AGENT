import {
  MOUSE_CLICK_ABILITY_GROUP_ID,
  MOUSE_CLICK_BUTTON_MAP,
  MOUSE_CLICK_COUNT_MAP,
  buildMouseClickRef,
} from "../shared/constants.js";
import type {
  MouseClickAbilityResult,
  MouseClickExecutionContext,
  MouseClickFailureReason,
  ParsedMouseClickAbilityInput,
} from "../contract.js";
import { MouseClickAbilityResultSchema, MouseClickRuntimeProofSchema } from "../schema.js";
import { checkMouseClickPolicy } from "./policy.js";
import {
  checkAndReserveMouseClickIdempotency,
  releaseMouseClickIdempotency,
} from "./idempotency.js";

function buildProofId(input: ParsedMouseClickAbilityInput, suffix: string): string {
  return buildMouseClickRef("mc:proof", [
    input.missionId,
    input.runId,
    input.stepId,
    input.capabilityCallId,
    suffix,
  ]);
}

function buildRuntimeProof(
  input: ParsedMouseClickAbilityInput,
  status: "success" | "failed",
  failureReason: MouseClickFailureReason | null,
  startedAt: string,
  endedAt: string,
  primitiveStartedAt: string | null,
  primitiveEndedAt: string | null,
  primitiveExecutionRef: string | null,
) {
  const durationMs = Math.max(
    0,
    new Date(endedAt).getTime() - new Date(startedAt).getTime(),
  );
  const proofId = buildProofId(input, primitiveExecutionRef ?? `fail:${Date.now()}`);

  return MouseClickRuntimeProofSchema.parse({
    proofId,
    missionId: input.missionId,
    runId: input.runId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    stepId: input.stepId,
    capabilityCallId: input.capabilityCallId,
    nerveBusEnvelopeId: input.nerveBusEnvelopeId,
    abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    geometryGuardRef: input.geometryGuardRef,
    geometryGuardProofRef: input.geometryGuardProofRef,
    sourceCoordinateProofRef: input.sourceCoordinateProofRef,
    coordinateSpace: "browserViewport",
    normalizedClickPoint: input.geometryGuardNormalizedClickPoint,
    executableCoordinate: input.geometryGuardNormalizedClickPoint,
    button: MOUSE_CLICK_BUTTON_MAP[input.childCapabilityId],
    clickCount: MOUSE_CLICK_COUNT_MAP[input.childCapabilityId],
    status,
    failureReason,
    reviewRequiredReason: null,
    startedAt,
    endedAt,
    primitiveStartedAt,
    primitiveEndedAt,
    durationMs,
    primitiveExecutionRef,
  });
}

function buildResult(
  input: ParsedMouseClickAbilityInput,
  status: "success" | "failed",
  failureReason: MouseClickFailureReason | null,
  proof: ReturnType<typeof buildRuntimeProof>,
): MouseClickAbilityResult {
  return MouseClickAbilityResultSchema.parse({
    abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    status,
    failureReason,
    reviewRequiredReason: null,
    output: {
      abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
      childCapabilityId: input.childCapabilityId,
      status,
      actionExecutionRef: proof.proofId,
      primitiveExecutionRef: proof.primitiveExecutionRef,
    },
    runtimeProof: proof,
  });
}

function buildFailureResult(
  input: ParsedMouseClickAbilityInput,
  failureReason: MouseClickFailureReason,
  startedAt: string,
): MouseClickAbilityResult {
  const endedAt = new Date().toISOString();
  const proof = buildRuntimeProof(
    input,
    "failed",
    failureReason,
    startedAt,
    endedAt,
    null,
    null,
    null,
  );
  return buildResult(input, "failed", failureReason, proof);
}

/**
 * Core mouse click executor.
 *
 * Execution order:
 *   1. Policy check (Geometry Guard allow + source evidence + purpose)
 *   2. Idempotency check
 *   3. Primitive dispatch (BrowserController via port)
 *   4. Build proof
 *   5. Return result
 *
 * Mouse Click does NOT:
 *   - compute coordinates (consumed from Geometry Guard proof)
 *   - decide business success
 *   - force PAV
 *   - accept button/clickCount from callers (fixed by child)
 */
export async function executeMouseClick(
  input: ParsedMouseClickAbilityInput,
  context: MouseClickExecutionContext,
): Promise<MouseClickAbilityResult> {
  const startedAt = new Date().toISOString();

  // 1. Policy
  const policy = checkMouseClickPolicy(input);
  if (!policy.ok) {
    return buildFailureResult(input, policy.reason === "geometry_guard_not_allow" ? "geometry_guard_not_allow" : "policy_blocked", startedAt);
  }

  // 2. Idempotency
  if (!checkAndReserveMouseClickIdempotency(input.idempotencyKey)) {
    return buildFailureResult(input, "idempotency_replay", startedAt);
  }

  // 3. Primitive dispatch
  const primitiveRef = buildMouseClickRef("mc:primitive", [
    input.idempotencyKey,
    startedAt,
  ]);

  let primitiveResult: Awaited<
    ReturnType<MouseClickExecutionContext["primitivePort"]["click"]>
  >;

  try {
    primitiveResult = await context.primitivePort.click({
      primitiveRef,
      idempotencyKey: input.idempotencyKey,
      sessionId: input.sessionId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId,
      geometryGuardProofRef: input.geometryGuardProofRef,
      coordinateSpace: "browserViewport",
      executableCoordinate: input.geometryGuardNormalizedClickPoint,
      button: MOUSE_CLICK_BUTTON_MAP[input.childCapabilityId],
      clickCount: MOUSE_CLICK_COUNT_MAP[input.childCapabilityId],
      timeoutMs: input.timeoutMs,
    });
  } catch {
    releaseMouseClickIdempotency(input.idempotencyKey);
    return buildFailureResult(input, "primitive_failed", startedAt);
  }

  // 4. Build proof
  const endedAt = new Date().toISOString();
  const status = primitiveResult.ok ? "success" : "failed";
  const failureReason: MouseClickFailureReason | null = primitiveResult.ok
    ? null
    : "primitive_failed";

  if (!primitiveResult.ok) {
    releaseMouseClickIdempotency(input.idempotencyKey);
  }

  const proof = buildRuntimeProof(
    input,
    status,
    failureReason,
    startedAt,
    endedAt,
    primitiveResult.startedAt,
    primitiveResult.endedAt,
    primitiveResult.primitiveExecutionRef,
  );

  return buildResult(input, status, failureReason, proof);
}
