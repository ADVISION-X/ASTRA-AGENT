import { buildCommanderRuntimeProof } from "../runtime/commander-proof-builder.js";
import { buildCommanderConsoleResult } from "../runtime/commander-result-builder.js";
import type { CommanderConsoleChildContext } from "../runtime/commander-console-executor.js";
import { commanderFlag } from "./commander-proof.js";

type InvalidInputPayload = {
  rawInput: unknown;
  errorMessage: string;
  context: CommanderConsoleChildContext;
};

type InvalidInputResolution = {
  childCapabilityId: string;
  operatorRef: string;
};

const resolveChildCapabilityId = (rawInput: unknown) => (
  typeof rawInput === "object"
  && rawInput !== null
  && "childCapabilityId" in rawInput
  && typeof (rawInput as { childCapabilityId?: unknown }).childCapabilityId === "string"
)
  ? (rawInput as { childCapabilityId: string }).childCapabilityId
  : "invalid-child-capability";

const resolveOperatorRef = (rawInput: unknown, defaultOperatorRef: string) => (
  typeof rawInput === "object"
  && rawInput !== null
  && "operatorRef" in rawInput
  && typeof (rawInput as { operatorRef?: unknown }).operatorRef === "string"
)
  ? (rawInput as { operatorRef: string }).operatorRef
  : defaultOperatorRef;

const resolveInvalidInput = (input: InvalidInputPayload): InvalidInputResolution => ({
  childCapabilityId: resolveChildCapabilityId(input.rawInput),
  operatorRef: resolveOperatorRef(input.rawInput, input.context.defaultOperatorRef),
});

const buildInvalidInputOutcome = (errorMessage: string) => ({
  status: "failed" as const,
  output: null,
  failureReason: errorMessage,
  reviewRequiredReason: null,
  inputRef: "commander_console:invalid_input",
  outputRef: null,
  commandId: null,
  readRequestId: null,
  runId: null,
  missionId: null,
  traceId: null,
  commandEnvelopeRef: null,
  resultEnvelopeRef: null,
  readModelSource: null,
  targetRecordRef: null,
  evidenceRefs: [],
  dataQualityFlags: [commanderFlag("input_schema_failed", "fatal", errorMessage)],
  boundaryDecision: "blocked" as const,
  commandDecision: null,
  readDecision: "blocked-by-read-gate" as const,
  transportDecision: null,
  hardStopDecision: null,
  policyDecision: "blocked" as const,
});

const buildInvalidInputRuntimeProof = (input: InvalidInputPayload, resolved: InvalidInputResolution) => {
  const startedAt = input.context.clock.nowIso();
  const startedMs = input.context.clock.monotonicNowMs();
  const endedAt = input.context.clock.nowIso();
  const endedMs = input.context.clock.monotonicNowMs();
  return buildCommanderRuntimeProof({
    child: {
      childCapabilityId: resolved.childCapabilityId,
      childKind: "read",
      boundaryDecision: "blocked",
      readModelSource: null,
    },
    operatorRef: resolved.operatorRef,
    startedAt,
    endedAt,
    durationMs: input.context.clock.elapsedMs(startedMs, endedMs),
    outcome: buildInvalidInputOutcome(input.errorMessage),
  });
};

export function buildInvalidCommanderInputResult(input: InvalidInputPayload) {
  const resolved = resolveInvalidInput(input);
  return buildCommanderConsoleResult({
    childCapabilityId: resolved.childCapabilityId,
    status: "failed",
    output: null,
    failureReason: input.errorMessage,
    reviewRequiredReason: null,
    runtimeProof: buildInvalidInputRuntimeProof(input, resolved),
  });
}