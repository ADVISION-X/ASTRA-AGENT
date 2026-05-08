import { TextInputAbilityResultSchema } from "../schema.js";
import { buildStableTextInputRef } from "../shared/text-input-types.js";
import type { TextInputResultSeed } from "./text-input-input-gate.js";
import { buildTextInputDebugBundle } from "./text-input-debug-events.js";
import { validateTextInputOutputBoundary } from "./text-input-output-boundary-gate.js";
import { buildTextInputRuntimeProof } from "./text-input-proof-builder.js";
import {
  buildTextInputAbilityResultPayload,
  buildTextInputCandidateOutput,
  buildTextInputRuntimeProofArtifactInput,
  buildTextInputRuntimeProofIdentityInput,
  buildTextInputRuntimeProofLifecycleInput,
  buildTextInputRuntimeProofPolicyInput,
  buildTextInputRuntimeProofTargetInput,
} from "./text-input-result-builder-support.js";

function buildOutputBoundaryDecision(status: "success" | "failed" | "review_required") {
  return status === "success"
    ? "valid"
    : status === "review_required"
      ? "review_required_clipboard_restore_failed"
      : "invalid_failure_payload";
}

function buildRuntimeProofForResult(input: Parameters<typeof buildTextInputResult>[0], params: {
  outputRef: string | null;
  diagnosticPayloadRef: string;
  debugBundle: { debugLogRef: string; structuredRuntimeEventRef: string };
  outputBoundary: {
    status: "success" | "failed" | "review_required";
    failureReason: string | null;
    reviewRequiredReason: string | null;
    dataQualityFlags: string[];
  };
  postActionVerificationHandoffRef: string | null;
}) {
  return buildTextInputRuntimeProof({
    ...buildTextInputRuntimeProofIdentityInput(input, params.outputRef, params.diagnosticPayloadRef, params.debugBundle),
    ...buildTextInputRuntimeProofArtifactInput(input),
    ...buildTextInputRuntimeProofTargetInput(input),
    ...buildTextInputRuntimeProofPolicyInput({
      ...input,
      outputBoundaryDecision: buildOutputBoundaryDecision(params.outputBoundary.status),
    }),
    ...buildTextInputRuntimeProofLifecycleInput({
      ...input,
      postActionVerificationHandoffRef: params.postActionVerificationHandoffRef,
      outputBoundaryStatus: params.outputBoundary.status,
      dataQualityFlags: params.outputBoundary.dataQualityFlags,
      failureReason: params.outputBoundary.failureReason,
      reviewRequiredReason: params.outputBoundary.reviewRequiredReason,
    }),
    clock: input.clock,
  });
}

export function buildTextInputResult(input: {
  seed: TextInputResultSeed;
  actionExecutionRef: string | null;
  primitiveExecutionRef: string | null;
  clearPrimitiveExecutionRef: string | null;
  writePrimitiveExecutionRef: string | null;
  operationRef: string | null;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "allow" | "block" | "review_required";
  sensitiveTextDecision: "allowed" | "blocked" | "review_required";
  redactionDecision: "masked" | "hash_only" | "none";
  keyPolicyDecision: "allowed" | "blocked_enter" | "blocked_modifier" | "blocked_unknown";
  clipboardDecision: "not_used" | "snapshot_captured" | "prepared" | "restored" | "cleared" | "failed";
  clipboardSnapshotRef: string | null;
  clipboardProofRef: string | null;
  originalClipboardHash: string | null;
  restoredClipboardHash: string | null;
  commitPolicyRef: string | null;
  typedTextHash: string | null;
  keySequenceHash: string | null;
  primitiveDecision: "not_run" | "started" | "succeeded" | "failed" | "aborted" | "timed_out";
  primitivePortKind: string;
  replaceWriteMode: "type-text" | "paste-text" | null;
  primitiveStartedAt: string | null;
  primitiveEndedAt: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  dataQualityFlags: string[];
}) {
  const postActionVerificationHandoffRef = buildPostActionVerificationHandoffRef(input);
  const candidateOutput = buildTextInputCandidateOutput(input, postActionVerificationHandoffRef);

  const outputBoundary = validateTextInputOutputBoundary({
    requestedStatus: input.status,
    candidateOutput,
    failureReason: input.failureReason as never,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    dataQualityFlags: input.dataQualityFlags,
  });
  const debugBundle = buildTextInputDebugBundle({
    seed: input.seed,
    status: outputBoundary.status,
    clipboardDecision: input.clipboardDecision,
    dataQualityFlags: outputBoundary.dataQualityFlags,
  });
  const diagnosticPayloadRef = debugBundle.diagnosticPayloadRef;
  const outputRef = buildTextInputOutputRef(input.seed.attemptRef, outputBoundary.status);
  const runtimeProof = buildRuntimeProofForResult(input, {
    outputRef,
    diagnosticPayloadRef,
    debugBundle,
    outputBoundary,
    postActionVerificationHandoffRef,
  });

  return TextInputAbilityResultSchema.parse(buildTextInputAbilityResultPayload(input, outputBoundary, { debugBundle, diagnosticPayloadRef }, runtimeProof));
}

function buildPostActionVerificationHandoffRef(input: {
  status: "success" | "failed" | "review_required";
  actionExecutionRef: string | null;
  primitiveExecutionRef: string | null;
}): string | null {
  return input.status === "success" && input.actionExecutionRef && input.primitiveExecutionRef
    ? buildStableTextInputRef("text-input-post-action-verification-handoff", [input.actionExecutionRef, input.primitiveExecutionRef])
    : null;
}

function buildTextInputOutputRef(attemptRef: string, status: "success" | "failed" | "review_required"): string | null {
  return status === "success" ? buildStableTextInputRef("text-input-output", [attemptRef, status]) : null;
}