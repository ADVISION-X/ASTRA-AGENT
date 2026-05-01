import { finalizeFailure } from "./transport-failure-finalizer.js";
import { buildGovernedFailureResult } from "./transport-result-builder.js";
import { enforceTransportSequencePolicy } from "./transport-sequence-policy.js";
import { resolveTransportTimeoutGate } from "./transport-timeout-gate.js";

export const nerveBusExecutorFlowSupport = {
  finalizeFailure,
  buildGovernedFailureResult,
  enforceTransportSequencePolicy,
  resolveTransportTimeoutGate,
};