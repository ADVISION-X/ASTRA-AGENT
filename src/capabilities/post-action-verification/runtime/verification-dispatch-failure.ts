import { createHash } from "node:crypto";

import { PostActionVerificationAbilityInputSchema } from "../schema.js";
import { buildPostActionRuntimeProof } from "./verification-proof-builder.js";
import { buildPostActionVerificationResult } from "./verification-result-builder.js";
import type { PostActionFailureReason, PostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

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
  const runtimeProof = buildPostActionRuntimeProof({
    request,
    context: input.context,
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    startedMonotonicMs: started.monotonicMs,
    endedMonotonicMs: ended.monotonicMs,
    status,
    verificationDecision,
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
    inputRef,
    outputRef: null,
    diagnosticPayloadRef,
    receivedShapeHash: parseDigest,
  });

  return buildPostActionVerificationResult({
    request,
    assessment: null,
    status,
    verificationDecision,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    statusMessage: input.statusMessage,
    runtimeProof,
    diagnosticPayloadRef,
    dataQualityFlags: ["dispatch_failure"],
  });
}
