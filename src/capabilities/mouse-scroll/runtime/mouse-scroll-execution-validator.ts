import { validateGeometryScrollProof } from "./geometry-scroll-proof-gate.js";
import { buildMouseScrollExecutionSeed } from "./mouse-scroll-input-gate.js";
import { buildBlockedResult } from "./mouse-scroll-blocked-result-builder.js";
import { validatePreScrollSafety } from "./pre-scroll-safety-gate.js";
import { resolveScrollDelta } from "./scroll-delta-resolver.js";
import { validateScrollPolicy } from "./scroll-policy-gate.js";
import type {
  MouseScrollExecutionInput,
  MouseScrollExecutionSeed,
} from "./mouse-scroll-execution-contract.js";
import type { ValidatedMouseScrollExecution } from "./mouse-scroll-execution-stage-types.js";

type ValidationSuccess<T> = { ok: true; value: T };
type ValidationFailure = { ok: false; result: ReturnType<typeof buildBlockedResult> };

const validateGeometryGate = (
  input: MouseScrollExecutionInput,
  seed: MouseScrollExecutionSeed,
): ValidationFailure | ValidationSuccess<ValidatedMouseScrollExecution["geometryGate"]> => {
  const geometryGate = validateGeometryScrollProof({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (geometryGate.ok) {
    return { ok: true, value: geometryGate };
  }

  return {
    ok: false,
    result: buildBlockedResult({
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
    }),
  };
};

const validatePolicyGate = (
  input: MouseScrollExecutionInput,
  seed: MouseScrollExecutionSeed,
): ValidationFailure | ValidationSuccess<ValidatedMouseScrollExecution["policyGate"]> => {
  const nowIsoTimestamp = input.context.clock.now().isoTimestamp;
  const policyGate = validateScrollPolicy({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace, nowIsoTimestamp });
  if (policyGate.ok) {
    return { ok: true, value: policyGate };
  }

  return {
    ok: false,
    result: buildBlockedResult({
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
    }),
  };
};

const validateSafetyGate = (
  input: MouseScrollExecutionInput,
  seed: MouseScrollExecutionSeed,
): ValidationFailure | ValidationSuccess<ValidatedMouseScrollExecution["safetyGate"]> => {
  const safetyGate = validatePreScrollSafety({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (safetyGate.ok) {
    return { ok: true, value: safetyGate };
  }

  return {
    ok: false,
    result: buildBlockedResult({
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
    }),
  };
};

const validateDeltaResolution = (
  input: MouseScrollExecutionInput,
  seed: MouseScrollExecutionSeed,
  safetyGate: ValidatedMouseScrollExecution["safetyGate"],
): ValidationFailure | ValidationSuccess<ValidatedMouseScrollExecution["deltaResolution"]> => {
  const deltaResolution = resolveScrollDelta({
    request: input.request,
    coordinateSpace: input.expectedCoordinateSpace,
    direction: input.request.direction,
    magnitude: input.request.magnitude,
    bounds: safetyGate.bounds,
    region: safetyGate.region,
  });
  if (deltaResolution.ok) {
    return { ok: true, value: deltaResolution };
  }

  return {
    ok: false,
    result: buildBlockedResult({
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
    }),
  };
};

export function validateMouseScrollExecution(input: MouseScrollExecutionInput): ValidationFailure | { ok: true; execution: ValidatedMouseScrollExecution } {
  const seed = buildMouseScrollExecutionSeed(input.request);
  const geometryGate = validateGeometryGate(input, seed);
  if (!geometryGate.ok) {
    return geometryGate;
  }

  const policyGate = validatePolicyGate(input, seed);
  if (!policyGate.ok) {
    return policyGate;
  }

  const safetyGate = validateSafetyGate(input, seed);
  if (!safetyGate.ok) {
    return safetyGate;
  }

  const deltaResolution = validateDeltaResolution(input, seed, safetyGate.value);
  if (!deltaResolution.ok) {
    return deltaResolution;
  }

  return {
    ok: true,
    execution: {
      seed,
      geometryGate: geometryGate.value,
      policyGate: policyGate.value,
      safetyGate: safetyGate.value,
      deltaResolution: deltaResolution.value,
    },
  };
}