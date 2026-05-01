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

function runTextInputPreExecutionGates(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
}) {
  const targetGate = validateInputTargetProof({ request: input.request });
  if (!targetGate.ok) return targetGate;

  const focusGate = validateFocusProof({ request: input.request, currentIsoTimestamp: input.context.clock.now().isoTimestamp });
  if (!focusGate.ok) return focusGate;

  const sourceGate = validateTextSourceProof({ request: input.request });
  if (!sourceGate.ok) return sourceGate;

  const approvedTextGate = validateApprovedText({ request: input.request });
  if (!approvedTextGate.ok) return approvedTextGate;

  return validateTextPolicy({ request: input.request });
}

function runTextInputStatefulExecutionGates(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
  state: TextInputRuntimeDecisionState;
}) {
  const sensitiveGate = validateSensitiveText({ request: input.request });
  input.state.sensitiveTextDecision = sensitiveGate.sensitiveTextDecision;
  input.state.redactionDecision = sensitiveGate.redactionDecision;
  if (!sensitiveGate.ok) return sensitiveGate;

  const keyGate = validateKeyPolicy({ request: input.request });
  input.state.keyPolicyDecision = keyGate.keyPolicyDecision;
  if (!keyGate.ok) return keyGate;

  const commitGate = validateCommitPolicy({ request: input.request });
  input.state.keyPolicyDecision = commitGate.keyPolicyDecision;
  if (!commitGate.ok) return commitGate;

  const clipboardGate = validateClipboardPolicy({ request: input.request });
  input.state.clipboardDecision = clipboardGate.clipboardDecision;
  if (!clipboardGate.ok) return clipboardGate;

  input.state.clipboardProofRef = clipboardGate.clipboardProofRef;
  return null;
}

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

function runTextInputExecutionGates(input: {
  request: ParsedTextInputAbilityInput;
  context: TextInputRuntimeContext;
  seed: TextInputResultSeed;
  state: TextInputRuntimeDecisionState;
}) {
  const preExecutionGate = runTextInputPreExecutionGates({ request: input.request, context: input.context });
  if (!preExecutionGate.ok) return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: preExecutionGate });

  const statefulGate = runTextInputStatefulExecutionGates({ request: input.request, context: input.context, state: input.state });
  if (statefulGate) return buildGateFailureResult({ seed: input.seed, context: input.context, state: input.state, gate: statefulGate });

  return null;
}


export { runTextInputExecutionGates };
