import type {
  VisualTargetAbilityResult,
  VisualTargetDataQualityFlag,
  VisualTargetFailureReason,
  VisualTargetOutput,
} from "../contract.js";
import { VisualTargetAbilityResultSchema } from "../schema.js";
import { buildStableVisualTargetRef } from "../shared/visual-target-types.js";
import { resolveVisualTargetChain } from "./visual-target-chain.js";
import type { VisualTargetFailureTrace } from "./visual-target-input-gate.js";
import { buildVisualTargetRuntimeProof, type VisualTargetRuntimeDecisionTrace, type VisualTargetRuntimeTelemetry } from "./visual-target-proof-builder.js";

const MAX_STATUS_MESSAGE_LENGTH = 500;

function clampStatusMessage(statusMessage: string): string {
  if (statusMessage.length <= MAX_STATUS_MESSAGE_LENGTH) {
    return statusMessage;
  }

  return `${statusMessage.slice(0, MAX_STATUS_MESSAGE_LENGTH - 3).trimEnd()}...`;
}

function resolveVisualTargetRefs(input: {
  trace: VisualTargetFailureTrace;
  status: "success" | "failed" | "review_required";
  failureReason: import("../contract.js").VisualTargetFailureReason | null;
  reviewRequiredReason: string | null;
  output: import("../contract.js").VisualTargetOutput | null;
}) {
  const refSeed = [input.trace.inputRef, input.status, input.failureReason, input.reviewRequiredReason, input.output?.sourceCandidateRef ?? null];
  const debugLogRef = buildStableVisualTargetRef("visual-target-debug-log", refSeed);
  const structuredRuntimeEventRef = buildStableVisualTargetRef("visual-target-runtime-event", refSeed);
  const diagnosticPayloadRef = input.status === "success" ? null : buildStableVisualTargetRef("visual-target-diagnostic", refSeed);
  const outputRef = input.status === "success" && input.output !== null
    ? buildStableVisualTargetRef("visual-target-output", [input.trace.inputRef, input.output.targetId, input.output.sourceCandidateRef])
    : null;

  return { debugLogRef, structuredRuntimeEventRef, diagnosticPayloadRef, outputRef };
}

type VisualTargetResultInput = {
  request: import("../contract.js").ParsedVisualTargetAbilityInput | null;
  trace: VisualTargetFailureTrace;
  status: "success" | "failed" | "review_required";
  failureReason: VisualTargetFailureReason | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  output: VisualTargetOutput | null;
  rejectedCandidateRefs: string[];
  startedAt: string;
  endedAt: string;
  durationMs: number;
  decisions: VisualTargetRuntimeDecisionTrace;
  telemetry: Omit<VisualTargetRuntimeTelemetry, "diagnosticPayloadRef" | "debugLogRef" | "structuredRuntimeEventRef">;
  dataQualityFlags: VisualTargetDataQualityFlag[];
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
};

function buildVisualTargetResultPayload(input: {
  result: VisualTargetResultInput;
  refs: ReturnType<typeof resolveVisualTargetRefs>;
  runtimeProof: ReturnType<typeof buildVisualTargetRuntimeProof>;
}) {
  const chain = resolveVisualTargetChain(input.result.request, input.result.trace);
  const statusMessage = clampStatusMessage(input.result.statusMessage);
  const output = input.result.status === "success" && input.refs.outputRef !== null && input.result.output !== null
    ? input.result.output.targetNature === "action"
      ? {
          ...input.result.output,
          geometryGuardHandoff: {
            ...input.result.output.geometryGuardHandoff,
            sourceVisualTargetResultRef: input.refs.outputRef,
          },
        }
      : input.result.output
    : input.result.output;
  return {
    abilityGroupId: "visual-target",
    childCapabilityId: input.result.trace.childCapabilityId,
    targetNature: input.result.status === "success"
      ? input.result.output?.targetNature ?? input.result.trace.targetNature
      : input.result.trace.targetNature,
    status: input.result.status,
    ...chain,
    sessionId: input.result.trace.sessionId,
    roundId: input.result.trace.roundId,
    videoVisitId: input.result.trace.videoVisitId,
    targetType: input.result.status === "success"
      ? input.result.request?.targetType ?? input.result.trace.targetType
      : input.result.trace.targetType,
    visualTargetResultRef: input.refs.outputRef,
    output,
    failureReason: input.result.failureReason,
    reviewRequiredReason: input.result.reviewRequiredReason,
    statusMessage,
    debugLogRef: input.refs.debugLogRef,
    diagnosticPayloadRef: input.refs.diagnosticPayloadRef,
    dataQualityFlags: input.result.dataQualityFlags,
    startedAt: input.result.startedAt,
    endedAt: input.result.endedAt,
    createdAt: input.result.endedAt,
    durationMs: input.result.durationMs,
    runtimeProof: input.runtimeProof,
  };
}

export function buildVisualTargetResult(input: VisualTargetResultInput): VisualTargetAbilityResult {
  const refs = resolveVisualTargetRefs({
    trace: input.trace,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    output: input.output,
  });
  const runtimeProof = buildVisualTargetRuntimeProof({
    request: input.request,
    trace: input.trace,
    output: input.output,
    outputRef: refs.outputRef,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    rejectedCandidateRefs: input.rejectedCandidateRefs,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    decisions: input.decisions,
    telemetry: {
      ...input.telemetry,
      diagnosticPayloadRef: refs.diagnosticPayloadRef,
      debugLogRef: refs.debugLogRef,
      structuredRuntimeEventRef: refs.structuredRuntimeEventRef,
    },
    dataQualityFlags: input.dataQualityFlags,
    clock: input.clock,
  });

  return VisualTargetAbilityResultSchema.parse(buildVisualTargetResultPayload({ result: input, refs, runtimeProof }));
}