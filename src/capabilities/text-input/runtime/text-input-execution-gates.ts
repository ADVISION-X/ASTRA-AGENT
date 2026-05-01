import type { ParsedTextInputAbilityInput } from "../contract.js";
import { validateApprovedText } from "./approved-text-gate.js";
import { validateClipboardPolicy } from "./clipboard-policy-gate.js";
import { validateCommitPolicy } from "./commit-policy-gate.js";
import { validateFocusProof } from "./focus-proof-gate.js";
import { validateInputTargetProof } from "./input-target-proof-gate.js";
import { validateKeyPolicy } from "./key-policy-gate.js";
import { validateSensitiveText } from "./sensitive-text-gate.js";
import { validateTextPolicy } from "./text-policy-gate.js";
import { validateTextSourceProof } from "./text-source-proof-gate.js";
import { buildRejectedTextInputResult, type TextInputRuntimeDecisionState } from "./text-input-execution-support.js";
import type { TextInputResultSeed } from "./text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";

type GateOutcome = {
  status: "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "allow" | "block" | "review_required";
  dataQualityFlags: string[];
};

function buildGateFailureResult(input: {
  seed: TextInputResultSeed;
  context: TextInputRuntimeContext;
  state: TextInputRuntimeDecisionState;
  gate: GateOutcome;
}) {
  return buildRejectedTextInputResult({
    seed: input.seed,
    context: input.context,
    state: input.state,
    status: input.gate.status,
    failureReason: input.gate.failureReason,
    reviewRequiredReason: input.gate.reviewRequiredReason,
    statusMessage: input.gate.statusMessage,
    policyDecision: input.gate.policyDecision,
    dataQualityFlags: input.gate.dataQualityFlags,
  });
}

export function runTextInputExecutionGates(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
  seed: TextInputResultSeed;
  state: TextInputRuntimeDecisionState;
}) {
  const targetGate = validateInputTargetProof({ request: input.request });
  if (!targetGate.ok) return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: targetGate });

  const focusGate = validateFocusProof({ request: input.request, currentIsoTimestamp: input.context.clock.now().isoTimestamp });
  if (!focusGate.ok) return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: focusGate });

  const sourceGate = validateTextSourceProof({ request: input.request });
  if (!sourceGate.ok) return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: sourceGate });

  const approvedTextGate = validateApprovedText({ request: input.request });
  if (!approvedTextGate.ok) return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: approvedTextGate });

  const textPolicyGate = validateTextPolicy({ request: input.request });
  if (!textPolicyGate.ok) return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: textPolicyGate });

  const sensitiveGate = validateSensitiveText({ request: input.request });
  if (!sensitiveGate.ok) {
    input.state.sensitiveTextDecision = sensitiveGate.sensitiveTextDecision;
    input.state.redactionDecision = sensitiveGate.redactionDecision;
    return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: sensitiveGate });
  }
  input.state.sensitiveTextDecision = sensitiveGate.sensitiveTextDecision;
  input.state.redactionDecision = sensitiveGate.redactionDecision;

  const keyGate = validateKeyPolicy({ request: input.request });
  if (!keyGate.ok) {
    input.state.keyPolicyDecision = keyGate.keyPolicyDecision;
    return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: keyGate });
  }
  input.state.keyPolicyDecision = keyGate.keyPolicyDecision;

  const commitGate = validateCommitPolicy({ request: input.request });
  if (!commitGate.ok) {
    input.state.keyPolicyDecision = commitGate.keyPolicyDecision;
    return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: commitGate });
  }
  input.state.commitPolicyRef = commitGate.commitPolicyRef;

  const clipboardGate = validateClipboardPolicy({ request: input.request });
  if (!clipboardGate.ok) {
    input.state.clipboardDecision = clipboardGate.clipboardDecision;
    return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: clipboardGate });
  }
  input.state.clipboardProofRef = clipboardGate.clipboardProofRef;

  return null;
}
