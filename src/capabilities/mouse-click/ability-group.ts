import type {
  MouseClickAbilityGroup,
  MouseClickAbilityInput,
  MouseClickChildCapabilityId,
  ParsedMouseClickAbilityInput,
  MouseClickExecutionContext,
} from "./contract.js";
import { MouseClickAbilityInputSchema, MouseClickAbilityResultSchema } from "./schema.js";
import { createMouseClickCapabilityRegistry, listMouseClickChildren } from "./registry.js";

function buildInputParseFailureResult(input: MouseClickAbilityInput) {
  const abilityGroupId = "mouse-click" as const;
  const childCapabilityId =
    typeof input.childCapabilityId === "string" &&
    ["left-click-browser-viewport-once", "double-left-click-browser-viewport", "right-click-browser-viewport-once"].includes(input.childCapabilityId as string)
      ? (input.childCapabilityId as MouseClickChildCapabilityId)
      : ("left-click-browser-viewport-once" as MouseClickChildCapabilityId);

  const now = new Date().toISOString();
  return MouseClickAbilityResultSchema.parse({
    abilityGroupId,
    childCapabilityId,
    status: "failed",
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    output: { abilityGroupId, childCapabilityId, status: "failed", actionExecutionRef: null, primitiveExecutionRef: null },
    runtimeProof: {
      proofId: `mc:proof:parse-fail:${Date.now()}`,
      missionId: typeof input.missionId === "string" ? input.missionId : "unknown",
      runId: typeof input.runId === "string" ? input.runId : "unknown",
      sessionId: typeof input.sessionId === "string" ? input.sessionId : "unknown",
      roundId: null,
      videoVisitId: null,
      stepId: typeof input.stepId === "string" ? input.stepId : "unknown",
      capabilityCallId: typeof input.capabilityCallId === "string" ? input.capabilityCallId : "unknown",
      nerveBusEnvelopeId: typeof input.nerveBusEnvelopeId === "string" ? input.nerveBusEnvelopeId : "unknown",
      abilityGroupId,
      childCapabilityId,
      geometryGuardRef: typeof input.geometryGuardRef === "string" ? input.geometryGuardRef : "unknown",
      geometryGuardProofRef: typeof input.geometryGuardProofRef === "string" ? input.geometryGuardProofRef : "unknown",
      sourceCoordinateProofRef: typeof input.sourceCoordinateProofRef === "string" ? input.sourceCoordinateProofRef : "unknown",
      coordinateSpace: "browserViewport",
      normalizedClickPoint: { x: 0, y: 0 },
      executableCoordinate: { x: 0, y: 0 },
      button: "left",
      clickCount: 1,
      status: "failed",
      failureReason: "input_schema_invalid",
      reviewRequiredReason: null,
      startedAt: now,
      endedAt: now,
      primitiveStartedAt: null,
      primitiveEndedAt: null,
      durationMs: 0,
      primitiveExecutionRef: null,
    },
  });
}

async function dispatchToChild(
  registry: ReturnType<typeof createMouseClickCapabilityRegistry>,
  childCapabilityId: MouseClickChildCapabilityId,
  parsed: ParsedMouseClickAbilityInput,
  context: MouseClickExecutionContext,
) {
  const capability = registry.get(childCapabilityId);
  if (!capability) {
    const now = new Date().toISOString();
    return MouseClickAbilityResultSchema.parse({
      abilityGroupId: "mouse-click",
      childCapabilityId,
      status: "failed",
      failureReason: "unknown_child_capability",
      reviewRequiredReason: null,
      output: { abilityGroupId: "mouse-click", childCapabilityId, status: "failed", actionExecutionRef: null, primitiveExecutionRef: null },
      runtimeProof: {
        proofId: `mc:proof:unknown-child:${Date.now()}`,
        missionId: parsed.missionId,
        runId: parsed.runId,
        sessionId: parsed.sessionId,
        roundId: parsed.roundId,
        videoVisitId: parsed.videoVisitId,
        stepId: parsed.stepId,
        capabilityCallId: parsed.capabilityCallId,
        nerveBusEnvelopeId: parsed.nerveBusEnvelopeId,
        abilityGroupId: "mouse-click",
        childCapabilityId,
        geometryGuardRef: parsed.geometryGuardRef,
        geometryGuardProofRef: parsed.geometryGuardProofRef,
        sourceCoordinateProofRef: parsed.sourceCoordinateProofRef,
        coordinateSpace: "browserViewport",
        normalizedClickPoint: parsed.geometryGuardNormalizedClickPoint,
        executableCoordinate: parsed.geometryGuardNormalizedClickPoint,
        button: "left",
        clickCount: 1,
        status: "failed",
        failureReason: "unknown_child_capability",
        reviewRequiredReason: null,
        startedAt: now,
        endedAt: now,
        primitiveStartedAt: null,
        primitiveEndedAt: null,
        durationMs: 0,
        primitiveExecutionRef: null,
      },
    });
  }

  try {
    return MouseClickAbilityResultSchema.parse(await capability.execute(parsed, context));
  } catch (error) {
    const now = new Date().toISOString();
    return MouseClickAbilityResultSchema.parse({
      abilityGroupId: "mouse-click",
      childCapabilityId,
      status: "failed",
      failureReason: "child_execution_failed",
      reviewRequiredReason: null,
      output: { abilityGroupId: "mouse-click", childCapabilityId, status: "failed", actionExecutionRef: null, primitiveExecutionRef: null },
      runtimeProof: {
        proofId: `mc:proof:exec-fail:${Date.now()}`,
        missionId: parsed.missionId,
        runId: parsed.runId,
        sessionId: parsed.sessionId,
        roundId: parsed.roundId,
        videoVisitId: parsed.videoVisitId,
        stepId: parsed.stepId,
        capabilityCallId: parsed.capabilityCallId,
        nerveBusEnvelopeId: parsed.nerveBusEnvelopeId,
        abilityGroupId: "mouse-click",
        childCapabilityId,
        geometryGuardRef: parsed.geometryGuardRef,
        geometryGuardProofRef: parsed.geometryGuardProofRef,
        sourceCoordinateProofRef: parsed.sourceCoordinateProofRef,
        coordinateSpace: "browserViewport",
        normalizedClickPoint: parsed.geometryGuardNormalizedClickPoint,
        executableCoordinate: parsed.geometryGuardNormalizedClickPoint,
        button: "left",
        clickCount: 1,
        status: "failed",
        failureReason: "child_execution_failed",
        reviewRequiredReason: null,
        startedAt: now,
        endedAt: now,
        primitiveStartedAt: null,
        primitiveEndedAt: null,
        durationMs: 0,
        primitiveExecutionRef: null,
      },
    });
  }
}

type CreateMouseClickAbilityGroupInput = {
  context: MouseClickExecutionContext;
};

export function createMouseClickAbilityGroup(
  input: CreateMouseClickAbilityGroupInput,
): MouseClickAbilityGroup {
  const registry = createMouseClickCapabilityRegistry();

  return {
    listChildCapabilityIds(): MouseClickChildCapabilityId[] {
      return listMouseClickChildren();
    },
    async execute(inputValue: MouseClickAbilityInput) {
      const parsed = MouseClickAbilityInputSchema.safeParse(inputValue);
      if (!parsed.success) {
        return buildInputParseFailureResult(inputValue);
      }
      return dispatchToChild(registry, parsed.data.childCapabilityId, parsed.data, input.context);
    },
  };
}
