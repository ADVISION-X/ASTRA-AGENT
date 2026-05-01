import { createHash } from "node:crypto";

import { PostActionVerificationAbilityInputSchema } from "../schema.js";
import { buildPostActionRuntimeProof } from "./verification-proof-builder.js";
import { buildPostActionVerificationResult } from "./verification-result-builder.js";
import type { PostActionFailureReason, PostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

function buildDispatchFailureRuntimeProof(input: {
  request: PostActionVerificationAbilityInput | null;
  context: PostActionVerificationRuntimeContext;
  started: ReturnType<PostActionVerificationRuntimeContext["clock"]["now"]>;
  ended: ReturnType<PostActionVerificationRuntimeContext["clock"]["now"]>;
  status: "failed" | "review_required";
  verificationDecision: "failed" | "review_required";
  inputRef: string;
  diagnosticPayloadRef: string;
  parseDigest: string;
  statusMessage: string;
  failureReason: PostActionFailureReason;
  reviewRequiredReason?: string | null;
  parseErrors?: string[];
}) {
  return buildPostActionRuntimeProof({
    request: input.request,
    context: input.context,
    startedAt: input.started.isoTimestamp,
    endedAt: input.ended.isoTimestamp,
    startedMonotonicMs: input.started.monotonicMs,
    endedMonotonicMs: input.ended.monotonicMs,
    status: input.status,
    verificationDecision: input.verificationDecision,
    confidence: 0,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    inputDecision: "dispatch_failure",
    actionProofDecision: "dispatch_failure",
    evidenceSourceDecision: "dispatch_failure",
    beforeAfterDecision: "dispatch_failure",
    policyDecision: "dispatch_failure",
    outputBoundaryDecision: "dispatch_failure",
    criticalDataQualityDecision: "dispatch_failure",
    observationBindingDecision: "dispatch_failure",
    beforeAfterPairDecision: "dispatch_failure",
    verificationDecisionTrace: ["dispatch_failure"],
    dataQualityFlags: ["dispatch_failure"],
    inputRef: input.inputRef,
    outputRef: null,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    receivedShapeHash: input.parseDigest,
  });
}

function buildDispatchFailureResult(input: {
  request: PostActionVerificationAbilityInput | null;
  status: "failed" | "review_required";
  failureReason: PostActionFailureReason;
  reviewRequiredReason?: string | null;
  statusMessage: string;
  runtimeProof: ReturnType<typeof buildPostActionRuntimeProof>;
  diagnosticPayloadRef: string;
}) {
  return buildPostActionVerificationResult({
    request: input.request,
    assessment: null,
    status: input.status,
    verificationDecision: input.status === "review_required" ? "review_required" : "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    statusMessage: input.statusMessage,
    runtimeProof: input.runtimeProof,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    dataQualityFlags: ["dispatch_failure"],
  });
}

export function dispatchPostActionVerificationFailure(input: {
  rawInput: PostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  status?: "failed" | "review_required";
  failureReason: PostActionFailureReason;
  reviewRequiredReason?: string | null;
  statusMessage: string;
  parseErrors?: string[];
}) {
  const parsed = PostActionVerificationAbilityInputSchema.safeParse(input.rawInput);
  const request = parsed.success ? parsed.data : null;
  const started = input.context.clock.now();
  const ended = input.context.clock.now();
  const status = input.status ?? "failed";
  const verificationDecision = status === "review_required" ? "review_required" : "failed";
  const parseDigest = createHash("sha256")
    .update(JSON.stringify({ rawInput: input.rawInput, parseErrors: input.parseErrors ?? [] }))
    .digest("hex");
  const inputRef = request?.inputRef ?? `post-action-verification:invalid-input:${parseDigest.slice(0, 16)}`;
  const diagnosticPayloadRef = `post-action-verification:diagnostic:${parseDigest.slice(0, 16)}`;
  const runtimeProof = buildDispatchFailureRuntimeProof({
    request,
    context: input.context,
    started,
    ended,
    status,
    verificationDecision,
    inputRef,
    diagnosticPayloadRef,
    parseDigest,
    statusMessage: input.statusMessage,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    parseErrors: input.parseErrors,
  });

  return buildDispatchFailureResult({
    request,
    status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    runtimeProof,
    diagnosticPayloadRef,
  });
}
