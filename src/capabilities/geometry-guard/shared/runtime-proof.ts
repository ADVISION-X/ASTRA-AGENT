import type { GeometryGuardAbilityInput, GeometryGuardAbilityResult, GeometryGuardRuntimeProof } from "../contract.js";

export function buildGeometryGuardRuntimeProof(input: {
  callInput: GeometryGuardAbilityInput;
  geometryGuardRef: string;
  result: Pick<GeometryGuardAbilityResult, "guardDecision" | "normalizedCoordinateSpace">;
}): GeometryGuardRuntimeProof {
  return {
    abilityGroupId: input.callInput.abilityGroupId,
    childCapabilityId: input.callInput.childCapabilityId,
    geometryGuardRef: input.geometryGuardRef,
    guardDecision: input.result.guardDecision,
    sourceCoordinateSpace: input.callInput.sourceCoordinateSpace,
    normalizedCoordinateSpace: input.result.normalizedCoordinateSpace,
    sourceRefs: [
      input.callInput.sourceScreenshotEvidenceRef,
      input.callInput.sourceTargetRef,
      input.callInput.sourceAiResultRef,
    ].filter((value): value is string => Boolean(value)),
  };
}