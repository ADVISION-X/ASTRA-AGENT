import { buildPrimitiveIterationProof } from "./primitive-scroll-runner-result.js";
import type { PrimitiveAbortDecision, PrimitiveIterationStatus, PrimitiveTimeoutDecision } from "./primitive-scroll-runner-result.types.js";
import type { PrimitiveClockSnapshot, PrimitiveExecutionStore } from "./primitive-scroll-runner-types.js";

type AppendIterationProofInput = {
  store: PrimitiveExecutionStore;
  repeatIndex: number;
  primitiveCallId: string;
  primitiveExecutionRef: string | null;
  status: PrimitiveIterationStatus;
  iterationStarted: PrimitiveClockSnapshot;
  iterationEnded: PrimitiveClockSnapshot;
  timeoutDecision: PrimitiveTimeoutDecision;
  abortDecision: PrimitiveAbortDecision;
  portHangDetected: boolean;
  primitivePortKind: string;
};

const createIterationProof = (input: AppendIterationProofInput) => {
  return buildPrimitiveIterationProof({
    repeatIndex: input.repeatIndex,
    primitiveCallId: input.primitiveCallId,
    primitiveExecutionRef: input.primitiveExecutionRef,
    status: input.status,
    startedAt: input.iterationStarted.isoTimestamp,
    endedAt: input.iterationEnded.isoTimestamp,
    durationMs: Math.max(0, Math.round(input.iterationEnded.monotonicMs - input.iterationStarted.monotonicMs)),
    timeoutDecision: input.timeoutDecision,
    abortDecision: input.abortDecision,
    portHangDetected: input.portHangDetected,
    primitivePortKind: input.primitivePortKind,
  });
};

export const appendIterationProof = (input: AppendIterationProofInput) => {
  input.store.perIterationPrimitiveProofs.push(createIterationProof(input));
};

export const resolveExecutionRef = (primitiveExecutionRef: string) => {
  return primitiveExecutionRef.trim().length > 0 ? primitiveExecutionRef : null;
};