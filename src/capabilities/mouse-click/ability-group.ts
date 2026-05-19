import type {
  MouseClickAbilityGroup,
  MouseClickAbilityInput,
  MouseClickChildCapabilityId,
  ParsedMouseClickAbilityInput,
  MouseClickExecutionContext,
} from "./contract.js";
import { MouseClickAbilityInputSchema, MouseClickAbilityResultSchema } from "./schema.js";
import { createMouseClickCapabilityRegistry, listMouseClickChildren } from "./registry.js";

type MouseClickAbilityGroupFailureReason =
  | "input_schema_invalid"
  | "unknown_child_capability"
  | "child_execution_failed";

type MouseClickAbilityGroupFailure = {
  proofId: string;
  childCapabilityId: MouseClickChildCapabilityId;
  failureReason: MouseClickAbilityGroupFailureReason;
  missionId: string;
  runId: string;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string;
  capabilityCallId: string;
  nerveBusEnvelopeId: string;
  geometryGuardRef: string;
  geometryGuardProofRef: string;
  sourceCoordinateProofRef: string;
  normalizedClickPoint: { x: number; y: number };
  button: "left" | "right";
  clickCount: 1 | 2;
};

type ParsedFailureInput = {
  parsed: ParsedMouseClickAbilityInput;
  childCapabilityId: MouseClickChildCapabilityId;
  failureReason: Exclude<
    MouseClickAbilityGroupFailureReason,
    "input_schema_invalid"
  >;
  proofId: string;
};

const resolveDefaultChildCapabilityId = (
  input: MouseClickAbilityInput,
): MouseClickChildCapabilityId =>
  typeof input.childCapabilityId === "string"
  && [
    "left-click-browser-viewport-once",
    "double-left-click-browser-viewport",
    "right-click-browser-viewport-once",
  ].includes(input.childCapabilityId as string)
    ? (input.childCapabilityId as MouseClickChildCapabilityId)
    : "left-click-browser-viewport-once";

const resolveStringOrUnknown = (value: unknown): string =>
  typeof value === "string" ? value : "unknown";

const buildFailureOutput = (
  childCapabilityId: MouseClickChildCapabilityId,
) => ({
  abilityGroupId: "mouse-click" as const,
  childCapabilityId,
  status: "failed" as const,
  actionExecutionRef: null,
  primitiveExecutionRef: null,
});

const buildFailureRuntimeProof = (
  failure: MouseClickAbilityGroupFailure,
  now: string,
) => ({
  proofId: failure.proofId,
  missionId: failure.missionId,
  runId: failure.runId,
  sessionId: failure.sessionId,
  roundId: failure.roundId,
  videoVisitId: failure.videoVisitId,
  stepId: failure.stepId,
  capabilityCallId: failure.capabilityCallId,
  nerveBusEnvelopeId: failure.nerveBusEnvelopeId,
  abilityGroupId: "mouse-click",
  childCapabilityId: failure.childCapabilityId,
  geometryGuardRef: failure.geometryGuardRef,
  geometryGuardProofRef: failure.geometryGuardProofRef,
  sourceCoordinateProofRef: failure.sourceCoordinateProofRef,
  coordinateSpace: "browserViewport",
  normalizedClickPoint: failure.normalizedClickPoint,
  executableCoordinate: failure.normalizedClickPoint,
  button: failure.button,
  clickCount: failure.clickCount,
  status: "failed",
  failureReason: failure.failureReason,
  reviewRequiredReason: null,
  startedAt: now,
  endedAt: now,
  primitiveStartedAt: null,
  primitiveEndedAt: null,
  durationMs: 0,
  primitiveExecutionRef: null,
});

const buildFailureResult = (
  failure: MouseClickAbilityGroupFailure,
) => {
  const now = new Date().toISOString();
  return MouseClickAbilityResultSchema.parse({
    abilityGroupId: "mouse-click",
    childCapabilityId: failure.childCapabilityId,
    status: "failed",
    failureReason: failure.failureReason,
    reviewRequiredReason: null,
    output: buildFailureOutput(failure.childCapabilityId),
    runtimeProof: buildFailureRuntimeProof(failure, now),
  });
};

const buildParsedFailureResult = (
  input: ParsedFailureInput,
) => buildFailureResult({
  proofId: input.proofId,
  childCapabilityId: input.childCapabilityId,
  failureReason: input.failureReason,
  missionId: input.parsed.missionId,
  runId: input.parsed.runId,
  sessionId: input.parsed.sessionId,
  roundId: input.parsed.roundId,
  videoVisitId: input.parsed.videoVisitId,
  stepId: input.parsed.stepId,
  capabilityCallId: input.parsed.capabilityCallId,
  nerveBusEnvelopeId: input.parsed.nerveBusEnvelopeId,
  geometryGuardRef: input.parsed.geometryGuardRef,
  geometryGuardProofRef: input.parsed.geometryGuardProofRef,
  sourceCoordinateProofRef: input.parsed.sourceCoordinateProofRef,
  normalizedClickPoint: input.parsed.geometryGuardNormalizedClickPoint,
  button: "left",
  clickCount: 1,
});

function buildInputParseFailureResult(input: MouseClickAbilityInput) {
  return buildFailureResult({
    proofId: `mc:proof:parse-fail:${Date.now()}`,
    childCapabilityId: resolveDefaultChildCapabilityId(input),
    failureReason: "input_schema_invalid",
    missionId: resolveStringOrUnknown(input.missionId),
    runId: resolveStringOrUnknown(input.runId),
    sessionId: resolveStringOrUnknown(input.sessionId),
    roundId: null,
    videoVisitId: null,
    stepId: resolveStringOrUnknown(input.stepId),
    capabilityCallId: resolveStringOrUnknown(input.capabilityCallId),
    nerveBusEnvelopeId: resolveStringOrUnknown(input.nerveBusEnvelopeId),
    geometryGuardRef: resolveStringOrUnknown(input.geometryGuardRef),
    geometryGuardProofRef: resolveStringOrUnknown(input.geometryGuardProofRef),
    sourceCoordinateProofRef: resolveStringOrUnknown(input.sourceCoordinateProofRef),
    normalizedClickPoint: { x: 0, y: 0 },
    button: "left",
    clickCount: 1,
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
    return buildParsedFailureResult({
      parsed,
      childCapabilityId,
      failureReason: "unknown_child_capability",
      proofId: `mc:proof:unknown-child:${Date.now()}`,
    });
  }

  try {
    return MouseClickAbilityResultSchema.parse(await capability.execute(parsed, context));
  } catch {
    return buildParsedFailureResult({
      parsed,
      childCapabilityId,
      failureReason: "child_execution_failed",
      proofId: `mc:proof:exec-fail:${Date.now()}`,
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
