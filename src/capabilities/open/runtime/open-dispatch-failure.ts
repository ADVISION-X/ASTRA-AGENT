import type { OpenResult } from "../contract.js";
import {
  buildOpenDispatchFailureDerivedState,
  buildOpenDispatchFailureResult,
  buildOpenDispatchFailureRuntimeProof,
  type OpenDispatchFailureInput,
} from "./open-dispatch-failure-builders.js";

export function buildOpenDispatchFailure(input: OpenDispatchFailureInput): OpenResult {
  const derived = buildOpenDispatchFailureDerivedState(input);
  const runtimeProof = buildOpenDispatchFailureRuntimeProof(input, derived);
  return buildOpenDispatchFailureResult(input, derived, runtimeProof);
}