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

type RuntimeProofInput = {
  input: ParsedMouseClickAbilityInput;
  status: "success" | "failed";
  failureReason: MouseClickFailureReason | null;
  startedAt: string;
  endedAt: string;
  primitiveStartedAt: string | null;
  primitiveEndedAt: string | null;
  primitiveExecutionRef: string | null;
};

type PrimitiveClickResult = Awaited<
  ReturnType<MouseClickExecutionContext["primitivePort"]["click"]>
>;

function buildProofId(input: ParsedMouseClickAbilityInput, suffix: string): string {
  return buildMouseClickRef("mc:proof", [
    input.missionId,
    input.runId,
    input.stepId,
    input.capabilityCallId,
    suffix,
  ]);
}

const buildRuntimeProofExecutionFields = (input: RuntimeProofInput) => ({
  missionId: input.input.missionId,
  runId: input.input.runId,
  sessionId: input.input.sessionId,
  roundId: input.input.roundId,
  videoVisitId: input.input.videoVisitId,
  stepId: input.input.stepId,
  capabilityCallId: input.input.capabilityCallId,
  nerveBusEnvelopeId: input.input.nerveBusEnvelopeId,
  abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
  childCapabilityId: input.input.childCapabilityId,
  geometryGuardRef: input.input.geometryGuardRef,
  geometryGuardProofRef: input.input.geometryGuardProofRef,
  sourceCoordinateProofRef: input.input.sourceCoordinateProofRef,
  coordinateSpace: "browserViewport" as const,
  normalizedClickPoint: input.input.geometryGuardNormalizedClickPoint,
  executableCoordinate: input.input.geometryGuardNormalizedClickPoint,
  button: MOUSE_CLICK_BUTTON_MAP[input.input.childCapabilityId],
  clickCount: MOUSE_CLICK_COUNT_MAP[input.input.childCapabilityId],
  status: input.status,
  failureReason: input.failureReason,
  reviewRequiredReason: null,
});

const buildRuntimeProofTimingFields = (input: RuntimeProofInput) => ({
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  primitiveStartedAt: input.primitiveStartedAt,
  primitiveEndedAt: input.primitiveEndedAt,
  durationMs: Math.max(
    0,
    new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime(),
  ),
  primitiveExecutionRef: input.primitiveExecutionRef,
});

function buildRuntimeProof(input: RuntimeProofInput) {
  const durationMs = Math.max(
    0,
    new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime(),
  );
  const proofId = buildProofId(
    input.input,
    input.primitiveExecutionRef ?? `fail:${Date.now()}`,
  );

  return MouseClickRuntimeProofSchema.parse({
    proofId,
    ...buildRuntimeProofExecutionFields(input),
    ...buildRuntimeProofTimingFields(input),
    durationMs,
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
  const proof = buildRuntimeProof({
    input,
    status: "failed",
    failureReason,
    startedAt,
    endedAt,
    primitiveStartedAt: null,
    primitiveEndedAt: null,
    primitiveExecutionRef: null,
  });
  return buildResult(input, "failed", failureReason, proof);
}

const resolvePolicyFailureReason = (
  reason: string,
): MouseClickFailureReason =>
  reason === "geometry_guard_not_allow"
    ? "geometry_guard_not_allow"
    : "policy_blocked";

const buildPrimitiveClickRequest = (
  input: ParsedMouseClickAbilityInput,
  primitiveRef: string,
) => ({
  primitiveRef,
  idempotencyKey: input.idempotencyKey,
  sessionId: input.sessionId,
  roundId: input.roundId,
  videoVisitId: input.videoVisitId,
  geometryGuardProofRef: input.geometryGuardProofRef,
  coordinateSpace: "browserViewport" as const,
  executableCoordinate: input.geometryGuardNormalizedClickPoint,
  button: MOUSE_CLICK_BUTTON_MAP[input.childCapabilityId],
  clickCount: MOUSE_CLICK_COUNT_MAP[input.childCapabilityId],
  timeoutMs: input.timeoutMs,
});

const buildPrimitiveResult = (
  input: ParsedMouseClickAbilityInput,
  startedAt: string,
  primitiveResult: PrimitiveClickResult,
): MouseClickAbilityResult => {
  const endedAt = new Date().toISOString();
  const status = primitiveResult.ok ? "success" : "failed";
  const failureReason: MouseClickFailureReason | null = primitiveResult.ok
    ? null
    : "primitive_failed";

  if (!primitiveResult.ok) {
    releaseMouseClickIdempotency(input.idempotencyKey);
  }

  const proof = buildRuntimeProof({
    input,
    status,
    failureReason,
    startedAt,
    endedAt,
    primitiveStartedAt: primitiveResult.startedAt,
    primitiveEndedAt: primitiveResult.endedAt,
    primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
  });

  return buildResult(input, status, failureReason, proof);
};

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
    return buildFailureResult(
      input,
      resolvePolicyFailureReason(policy.reason),
      startedAt,
    );
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

  try {
    const primitiveResult = await context.primitivePort.click(
      buildPrimitiveClickRequest(input, primitiveRef),
    );
    return buildPrimitiveResult(input, startedAt, primitiveResult);
  } catch {
    releaseMouseClickIdempotency(input.idempotencyKey);
    return buildFailureResult(input, "primitive_failed", startedAt);
  }
}
