import type { AiAbilityResult, AiRuntimeExecutionOutput } from "../contract.js";
import { evaluateAiOutputBoundary } from "./ai-output-boundary-gate.js";
import { evaluateAiQualityGate } from "./ai-quality-gate.js";
import { evaluateAiSafetyPolicy } from "./ai-safety-policy-gate.js";
import { validateAiRuntimeOutput } from "./ai-schema-gate.js";
import { finalizeTerminalResult } from "./ai-terminal-result.js";
import type { AiExecutionPlan } from "./ai-pre-runtime.js";

type AiRuntimeTerminalInput = {
  status: AiAbilityResult["status"];
  failureReason: string | null;
  reviewRequiredReason: string | null;
  implementationStatus: string;
  schemaValidationStatus: AiAbilityResult["schemaValidationStatus"];
  qualityDecision: AiAbilityResult["runtimeProof"]["qualityDecision"];
  dataQualityFlags: string[];
  output: AiAbilityResult["output"];
  qualityDecisionReason: string | null;
  schemaDecision: AiAbilityResult["runtimeProof"]["schemaDecision"];
  boundaryViolationCount: number;
  schemaIssueCount: number;
};

const buildAiRuntimeTerminalBase = (input: {
  plan: AiExecutionPlan;
  runtimeResult: AiRuntimeExecutionOutput;
  boundaryDecision: ReturnType<typeof evaluateAiOutputBoundary>;
  safetyDecision: ReturnType<typeof evaluateAiSafetyPolicy>;
  terminal: AiRuntimeTerminalInput;
}) => ({
  request: input.plan.request,
  childContract: input.plan.childContract,
  context: input.plan.context,
  promptContract: input.plan.promptContract,
  status: input.terminal.status,
  failureReason: input.terminal.failureReason,
  reviewRequiredReason: input.terminal.reviewRequiredReason,
  implementationStatus: input.terminal.implementationStatus,
  modelProvider: input.runtimeResult.modelProvider,
  runtime: input.runtimeResult.runtime,
  modelName: input.runtimeResult.modelName,
  confidence: input.runtimeResult.confidence,
  costEstimate: input.runtimeResult.costEstimate,
  schemaValidationStatus: input.terminal.schemaValidationStatus,
  providerDecision: input.plan.providerDecision.decision,
  dataPolicyDecision: input.plan.dataDecision.decision,
  costPolicyDecision: input.plan.costDecision.decision,
  safetyPolicyDecision: input.safetyDecision.decision,
  schemaDecision: input.terminal.schemaDecision,
  qualityDecision: input.terminal.qualityDecision,
  outputBoundaryDecision: input.boundaryDecision.decision,
  disabledProviderDecision: "not_applicable" as const,
  dataQualityFlags: input.terminal.dataQualityFlags,
  output: input.terminal.output,
});

const buildAiRuntimeTerminalMeta = (
  runtimeResult: AiRuntimeExecutionOutput,
  input: AiRuntimeTerminalInput,
) => ({
  rawOutputRef: runtimeResult.rawOutputRef,
  rawOutputHash: runtimeResult.rawOutputHash,
  runtimeCallId: runtimeResult.runtimeCallId,
  timeoutMs: runtimeResult.timeoutMs,
  attemptIndex: runtimeResult.attemptIndex,
  retryCount: runtimeResult.retryCount,
  circuitBreakerState: runtimeResult.circuitBreakerState,
  gatewayDurationMs: runtimeResult.gatewayDurationMs,
  schemaIssueCount: input.schemaIssueCount,
  boundaryViolationCount: input.boundaryViolationCount,
  qualityDecisionReason: input.qualityDecisionReason,
  createdAt: runtimeResult.createdAt,
});

const buildAiRuntimeTerminalResult = (input: {
  plan: AiExecutionPlan;
  runtimeResult: AiRuntimeExecutionOutput;
  boundaryDecision: ReturnType<typeof evaluateAiOutputBoundary>;
  safetyDecision: ReturnType<typeof evaluateAiSafetyPolicy>;
  terminal: AiRuntimeTerminalInput;
}) =>
  finalizeTerminalResult({
    ...buildAiRuntimeTerminalBase(input),
    ...buildAiRuntimeTerminalMeta(input.runtimeResult, input.terminal),
  });

const resolveAiTerminalRuntimeFailure = (
  runtimeResult: AiRuntimeExecutionOutput,
): string | null => (
  ["runtime_threw", "runtime_timeout", "circuit_breaker_open", "concurrency_limited"].includes(runtimeResult.implementationStatus)
    ? runtimeResult.implementationStatus
    : null
);

const resolveAiRuntimeSchemaIssues = (
  plan: AiExecutionPlan,
  runtimeResult: AiRuntimeExecutionOutput,
) => plan.resolvedSchema.outputSchema
  ? validateAiRuntimeOutput(plan.resolvedSchema.outputSchema, runtimeResult.output)
  : { valid: false as const, issues: ["expected_output_schema_missing"] };

const evaluateAiRuntimeDecisions = (
  plan: AiExecutionPlan,
  runtimeResult: AiRuntimeExecutionOutput,
) => {
  const boundaryDecision = evaluateAiOutputBoundary(runtimeResult.output);
  const safetyDecision = evaluateAiSafetyPolicy({
    request: plan.request,
    promptForbiddenOutputs: plan.promptContract.forbiddenOutputs,
    provisionalOutput: runtimeResult.output,
  });
  const schemaIssues = resolveAiRuntimeSchemaIssues(plan, runtimeResult);
  const terminalRuntimeFailure = resolveAiTerminalRuntimeFailure(runtimeResult);
  const qualityDecision = evaluateAiQualityGate({
    request: plan.request,
    confidence: runtimeResult.confidence,
    schemaIssues: schemaIssues.valid ? [] : schemaIssues.issues,
    policyReason: boundaryDecision.reason ?? safetyDecision.reason ?? terminalRuntimeFailure,
  });
  return { boundaryDecision, safetyDecision, schemaIssues, terminalRuntimeFailure, qualityDecision };
};

const buildAiRejectedRuntimeResult = (
  plan: AiExecutionPlan,
  runtimeResult: AiRuntimeExecutionOutput,
  input: ReturnType<typeof evaluateAiRuntimeDecisions>,
) => {
  const reason = input.qualityDecision.reason ?? input.boundaryDecision.reason ?? input.safetyDecision.reason ?? "schema_validation_failed";
  return buildAiRuntimeTerminalResult(plan, runtimeResult, input.boundaryDecision, input.safetyDecision, {
    status: input.qualityDecision.decision === "review_required" ? "review_required" : "failed",
    failureReason: input.qualityDecision.decision === "blocked" ? reason : null,
    reviewRequiredReason: input.qualityDecision.decision === "review_required" ? reason : null,
    implementationStatus: "governed_output_rejected",
    schemaValidationStatus: input.qualityDecision.schemaValidationStatus,
    qualityDecision: input.qualityDecision.decision,
    dataQualityFlags: [...input.qualityDecision.flags, ...input.boundaryDecision.flags, ...input.safetyDecision.flags],
    output: null,
    qualityDecisionReason: reason,
    schemaDecision: input.schemaIssues.valid ? plan.resolvedSchema.decision : "review_required",
    boundaryViolationCount: input.boundaryDecision.flags.length,
    schemaIssueCount: input.schemaIssues.valid ? 0 : input.schemaIssues.issues.length,
  });
};

const buildAiRuntimeFailureResult = (
  plan: AiExecutionPlan,
  runtimeResult: AiRuntimeExecutionOutput,
  evaluation: ReturnType<typeof evaluateAiRuntimeDecisions>,
) =>
  buildAiRuntimeTerminalResult({
    plan,
    runtimeResult,
    boundaryDecision: evaluation.boundaryDecision,
    safetyDecision: evaluation.safetyDecision,
    terminal: {
      status: "failed",
      failureReason: evaluation.terminalRuntimeFailure,
      reviewRequiredReason: null,
      implementationStatus: runtimeResult.implementationStatus,
      schemaValidationStatus: "invalid",
      qualityDecision: "blocked",
      dataQualityFlags: evaluation.terminalRuntimeFailure ? [evaluation.terminalRuntimeFailure] : [],
      output: null,
      qualityDecisionReason: evaluation.terminalRuntimeFailure,
      schemaDecision: plan.resolvedSchema.decision,
      boundaryViolationCount: 0,
      schemaIssueCount: 0,
    },
  });

const buildAiSuccessfulRuntimeResult = (
  plan: AiExecutionPlan,
  runtimeResult: AiRuntimeExecutionOutput,
  evaluation: ReturnType<typeof evaluateAiRuntimeDecisions>,
) =>
  buildAiRuntimeTerminalResult({
    plan,
    runtimeResult,
    boundaryDecision: evaluation.boundaryDecision,
    safetyDecision: evaluation.safetyDecision,
    terminal: {
      status: "success",
      failureReason: null,
      reviewRequiredReason: null,
      implementationStatus: runtimeResult.implementationStatus,
      schemaValidationStatus: evaluation.qualityDecision.schemaValidationStatus,
      qualityDecision: evaluation.qualityDecision.decision,
      dataQualityFlags: [],
      output: evaluation.schemaIssues.output,
      qualityDecisionReason: null,
      schemaDecision: plan.resolvedSchema.decision,
      boundaryViolationCount: 0,
      schemaIssueCount: 0,
    },
  });

export function resolveAiRuntimeResult(
  plan: AiExecutionPlan,
  runtimeResult: AiRuntimeExecutionOutput,
): AiAbilityResult {
  const evaluation = evaluateAiRuntimeDecisions(plan, runtimeResult);
  if (evaluation.terminalRuntimeFailure !== null) {
    return buildAiRuntimeFailureResult(plan, runtimeResult, evaluation);
  }

  if (evaluation.schemaIssues.valid === false || evaluation.boundaryDecision.decision !== "allow" || evaluation.safetyDecision.decision !== "allow" || evaluation.qualityDecision.decision !== "pass") {
    return buildAiRejectedRuntimeResult(plan, runtimeResult, evaluation);
  }

  return buildAiSuccessfulRuntimeResult(plan, runtimeResult, evaluation);
}