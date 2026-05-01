import type {
  VisualTargetAbilityResult,
  VisualTargetDataQualityFlag,
  VisualTargetFailureReason,
  VisualTargetOutput,
} from "../contract.js";
import { VisualTargetAbilityResultSchema } from "../schema.js";
import { buildStableVisualTargetRef } from "../shared/visual-target-types.js";
import type { VisualTargetFailureTrace } from "./visual-target-input-gate.js";
import { buildVisualTargetRuntimeProof, type VisualTargetRuntimeDecisionTrace, type VisualTargetRuntimeTelemetry } from "./visual-target-proof-builder.js";

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

export function buildVisualTargetResult(input: {
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
}): VisualTargetAbilityResult {
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

  return VisualTargetAbilityResultSchema.parse({
    abilityGroupId: "visual-target",
    childCapabilityId: input.trace.childCapabilityId,
    targetNature: input.status === "success" ? input.output?.targetNature ?? input.trace.targetNature : input.trace.targetNature,
    status: input.status,
    sessionId: input.trace.sessionId,
    roundId: input.trace.roundId,
    videoVisitId: input.trace.videoVisitId,
    targetType: input.status === "success" ? input.request?.targetType ?? input.trace.targetType : input.trace.targetType,
    output: input.output,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    debugLogRef: refs.debugLogRef,
    diagnosticPayloadRef: refs.diagnosticPayloadRef,
    dataQualityFlags: input.dataQualityFlags,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    createdAt: input.endedAt,
    durationMs: input.durationMs,
    runtimeProof,
  });
}