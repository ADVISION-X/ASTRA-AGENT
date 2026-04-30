import type { ForensicsClockPort } from "../ports/forensics-clock-port.js";
import type { ForensicsAbilityInput, ForensicsFailure, ForensicsIntegrityDecision, ForensicsPolicyDecision, ForensicsResult } from "../schema.js";
import { createForensicsFailure } from "./forensics-failure.js";
import { buildForensicsResult } from "./forensics-result-builder.js";

export function buildForensicsDispatchFailure(input: {
  request: ForensicsAbilityInput;
  policyDecision: ForensicsPolicyDecision;
  integrityDecision: ForensicsIntegrityDecision;
  failureCode: ForensicsFailure["code"];
  failureMessage: string;
  detail?: string | null;
  startedAt: string;
  endedAt: string;
  clock: ForensicsClockPort;
}): ForensicsResult {
  return buildForensicsResult({
    request: input.request,
    policyDecision: input.policyDecision,
    integrityDecision: input.integrityDecision,
    storedRecord: null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    failureReason: createForensicsFailure({
      code: input.failureCode,
      message: input.failureMessage,
      detail: input.detail ?? null,
    }),
    reviewRequiredReason: null,
    clock: input.clock,
  });
}