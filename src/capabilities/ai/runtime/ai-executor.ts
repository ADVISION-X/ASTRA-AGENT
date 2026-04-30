import type { AiAbilityResult, AiChildContract, AiExecutionContext, ParsedAiAbilityInput } from "../contract.js";
import { buildAiDisabledProviderOutput } from "./ai-disabled-provider-result.js";
import { parseAiExecutorInput } from "./ai-input-gate.js";
import { evaluateAiCostPolicy } from "./ai-cost-policy-gate.js";
import { evaluateAiDataPolicy } from "./ai-data-policy-gate.js";
import { evaluateAiOutputBoundary } from "./ai-output-boundary-gate.js";
import { evaluateAiPayloadBudgetGate } from "./ai-payload-budget-gate.js";
import { evaluateAiProviderPolicy } from "./ai-provider-policy-gate.js";
import { evaluateAiQualityGate } from "./ai-quality-gate.js";
import { buildAiResult } from "./ai-result-builder.js";
import { runAiRuntimeCall } from "./ai-runtime-call-runner.js";
import { evaluateAiRuntimeHealthGate } from "./ai-runtime-health-gate.js";
import { evaluateAiSafetyPolicy } from "./ai-safety-policy-gate.js";
import { resolveAiSchemaContract, validateAiInternalCandidate, validateAiRuntimeOutput } from "./ai-schema-gate.js";

function finalizeTerminalResult(input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  context: AiExecutionContext;
  promptContract: ReturnType<AiExecutionContext["promptRegistry"]["resolvePromptContract"]>;
  status: AiAbilityResult["status"];
  failureReason: string | null;
  reviewRequiredReason: string | null;
  implementationStatus: string;
  modelProvider: AiAbilityResult["modelProvider"];
  runtime: string;
  modelName: string;
  confidence: number | null;
  costEstimate: number | null;
  schemaValidationStatus: AiAbilityResult["schemaValidationStatus"];
  providerDecision: AiAbilityResult["runtimeProof"]["providerDecision"];
  dataPolicyDecision: AiAbilityResult["runtimeProof"]["dataPolicyDecision"];
  costPolicyDecision: AiAbilityResult["runtimeProof"]["costPolicyDecision"];
  safetyPolicyDecision: AiAbilityResult["runtimeProof"]["safetyPolicyDecision"];
  schemaDecision: AiAbilityResult["runtimeProof"]["schemaDecision"];
  qualityDecision: AiAbilityResult["runtimeProof"]["qualityDecision"];
  outputBoundaryDecision: AiAbilityResult["runtimeProof"]["outputBoundaryDecision"];
  disabledProviderDecision: AiAbilityResult["runtimeProof"]["disabledProviderDecision"];
  dataQualityFlags: string[];
  output: AiAbilityResult["output"];
  rawOutputRef?: string | null;
  rawOutputHash?: string | null;
  runtimeCallId?: string | null;
  timeoutMs?: number | null;
  attemptIndex?: number;
  retryCount?: number;
  circuitBreakerState?: AiAbilityResult["runtimeProof"]["circuitBreakerState"];
  gatewayDurationMs?: number | null;
  schemaIssueCount?: number;
  boundaryViolationCount?: number;
  qualityDecisionReason?: string | null;
  createdAt?: string | null;
}) {
  const started = input.context.clock.startRun();
  const ended = input.context.clock.finishRun(started);
  return buildAiResult({
    request: input.request,
    childContract: input.childContract,
    promptContract: input.promptContract,
    status: input.status,
    modelProvider: input.modelProvider,
    modelName: input.modelName,
    modelRole: input.promptContract.modelRole,
    runtime: input.runtime,
    implementationStatus: input.implementationStatus,
    outputAuthority: input.status === "success" ? "authoritative" : "non_authoritative",
    output: input.status === "success" ? input.output : null,
    rawOutputRef: input.rawOutputRef ?? null,
    schemaValidationStatus: input.schemaValidationStatus,
    confidence: input.confidence,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    costEstimate: input.costEstimate,
    createdAt: input.createdAt ?? ended.endedAt,
    started,
    ended,
    providerDecision: input.providerDecision,
    dataPolicyDecision: input.dataPolicyDecision,
    costPolicyDecision: input.costPolicyDecision,
    safetyPolicyDecision: input.safetyPolicyDecision,
    schemaDecision: input.schemaDecision,
    qualityDecision: input.qualityDecision,
    outputBoundaryDecision: input.outputBoundaryDecision,
    disabledProviderDecision: input.disabledProviderDecision,
    rawOutputHash: input.rawOutputHash ?? null,
    runtimeCallId: input.runtimeCallId ?? null,
    timeoutMs: input.timeoutMs ?? null,
    attemptIndex: input.attemptIndex ?? 0,
    retryCount: input.retryCount ?? 0,
    circuitBreakerState: input.circuitBreakerState ?? "not_applicable",
    gatewayDurationMs: input.gatewayDurationMs ?? null,
    schemaIssueCount: input.schemaIssueCount ?? 0,
    boundaryViolationCount: input.boundaryViolationCount ?? 0,
    qualityDecisionReason: input.qualityDecisionReason ?? null,
    dataQualityFlags: input.dataQualityFlags,
  });
}

export async function executeAiChild(input: { request: ParsedAiAbilityInput; childContract: AiChildContract; context: AiExecutionContext }): Promise<AiAbilityResult> {
  const promptContract = input.context.promptRegistry.resolvePromptContract(input.request.taskType);

  const inputGate = parseAiExecutorInput(input.request, input.childContract.childCapabilityId);
  if (inputGate.ok === false) {
    return finalizeTerminalResult({
      request: input.request,
      childContract: input.childContract,
      context: input.context,
      promptContract,
      status: "failed",
      failureReason: inputGate.reason,
      reviewRequiredReason: null,
      implementationStatus: "input_gate_blocked",
      modelProvider: input.childContract.providerKind,
      runtime: "ai-executor",
      modelName: "unavailable",
      confidence: null,
      costEstimate: null,
      schemaValidationStatus: "invalid",
      providerDecision: "blocked",
      dataPolicyDecision: "not_applicable",
      costPolicyDecision: "not_applicable",
      safetyPolicyDecision: "allow",
      schemaDecision: "blocked",
      qualityDecision: "blocked",
      outputBoundaryDecision: "allow",
      disabledProviderDecision: "not_applicable",
      dataQualityFlags: [inputGate.reason],
      output: null,
    });
  }

  const providerDecision = evaluateAiProviderPolicy(inputGate.request, input.childContract);
  const dataDecision = evaluateAiDataPolicy(inputGate.request, input.childContract);
  const costDecision = evaluateAiCostPolicy(inputGate.request, input.childContract);
  const payloadBudgetDecision = evaluateAiPayloadBudgetGate(inputGate.request);
  const resolvedSchema = resolveAiSchemaContract(inputGate.request, promptContract);

  if (providerDecision.decision === "disabled") {
    const disabledOutput = buildAiDisabledProviderOutput(inputGate.request, input.childContract, promptContract);
    return finalizeTerminalResult({
      request: inputGate.request,
      childContract: input.childContract,
      context: input.context,
      promptContract,
      status: "failed",
      failureReason: "provider_disabled",
      reviewRequiredReason: null,
      implementationStatus: disabledOutput.implementationStatus,
      modelProvider: disabledOutput.modelProvider,
      runtime: disabledOutput.runtime,
      modelName: disabledOutput.modelName,
      confidence: null,
      costEstimate: null,
      schemaValidationStatus: "not_applicable",
      providerDecision: providerDecision.decision,
      dataPolicyDecision: "not_applicable",
      costPolicyDecision: "not_applicable",
      safetyPolicyDecision: "allow",
      schemaDecision: resolvedSchema.decision,
      qualityDecision: "blocked",
      outputBoundaryDecision: "allow",
      disabledProviderDecision: "disabled",
      dataQualityFlags: ["provider_disabled"],
      output: null,
    });
  }

  if (providerDecision.decision === "blocked" || resolvedSchema.decision === "blocked" || dataDecision.decision === "blocked" || costDecision.decision === "blocked" || payloadBudgetDecision.decision === "blocked") {
    const reason = providerDecision.reason ?? dataDecision.reason ?? costDecision.reason ?? resolvedSchema.reason ?? payloadBudgetDecision.reason ?? "provider_policy_blocked";
    return finalizeTerminalResult({
      request: inputGate.request,
      childContract: input.childContract,
      context: input.context,
      promptContract,
      status: "failed",
      failureReason: reason,
      reviewRequiredReason: null,
      implementationStatus: "policy_gate_blocked",
      modelProvider: input.childContract.providerKind,
      runtime: "ai-executor",
      modelName: "unavailable",
      confidence: null,
      costEstimate: null,
      schemaValidationStatus: resolvedSchema.decision === "blocked" ? "invalid" : "not_applicable",
      providerDecision: providerDecision.decision,
      dataPolicyDecision: dataDecision.decision,
      costPolicyDecision: costDecision.decision,
      safetyPolicyDecision: "allow",
      schemaDecision: resolvedSchema.decision,
      qualityDecision: "blocked",
      outputBoundaryDecision: "allow",
      disabledProviderDecision: "not_applicable",
      dataQualityFlags: [reason, ...payloadBudgetDecision.flags],
      output: null,
    });
  }

  if (providerDecision.decision === "review_required" || dataDecision.decision === "review_required" || costDecision.decision === "review_required") {
    const reason = providerDecision.reason ?? dataDecision.reason ?? costDecision.reason ?? "provider_policy_blocked";
    return finalizeTerminalResult({
      request: inputGate.request,
      childContract: input.childContract,
      context: input.context,
      promptContract,
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: reason,
      implementationStatus: "policy_gate_review_required",
      modelProvider: input.childContract.providerKind,
      runtime: "ai-executor",
      modelName: "unavailable",
      confidence: null,
      costEstimate: null,
      schemaValidationStatus: "not_applicable",
      providerDecision: providerDecision.decision,
      dataPolicyDecision: dataDecision.decision,
      costPolicyDecision: costDecision.decision,
      safetyPolicyDecision: "allow",
      schemaDecision: resolvedSchema.decision,
      qualityDecision: "review_required",
      outputBoundaryDecision: "allow",
      disabledProviderDecision: "not_applicable",
      dataQualityFlags: [reason],
      output: null,
      qualityDecisionReason: reason,
    });
  }

  if (input.childContract.providerKind === "internal") {
    const validation = validateAiInternalCandidate(inputGate.request, promptContract);
    if (validation.valid === false) {
      return finalizeTerminalResult({
        request: inputGate.request,
        childContract: input.childContract,
        context: input.context,
        promptContract,
        status: inputGate.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed",
        failureReason: inputGate.request.safetyPolicy.reviewOnSchemaFailure ? null : "internal_validation_failed",
        reviewRequiredReason: inputGate.request.safetyPolicy.reviewOnSchemaFailure ? "internal_validation_failed" : null,
        implementationStatus: "internal_schema_validation_failed",
        modelProvider: "internal",
        runtime: "internal-schema-validator",
        modelName: "schema-validator",
        confidence: 1,
        costEstimate: 0,
        schemaValidationStatus: "invalid",
        providerDecision: providerDecision.decision,
        dataPolicyDecision: dataDecision.decision,
        costPolicyDecision: costDecision.decision,
        safetyPolicyDecision: "allow",
        schemaDecision: "review_required",
        qualityDecision: inputGate.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "blocked",
        outputBoundaryDecision: "allow",
        disabledProviderDecision: "not_applicable",
        dataQualityFlags: validation.issues,
        output: null,
        schemaIssueCount: validation.issues.length,
        qualityDecisionReason: "internal_validation_failed",
      });
    }

    return finalizeTerminalResult({
      request: inputGate.request,
      childContract: input.childContract,
      context: input.context,
      promptContract,
      status: "success",
      failureReason: null,
      reviewRequiredReason: null,
      implementationStatus: "internal_schema_validated",
      modelProvider: "internal",
      runtime: "internal-schema-validator",
      modelName: "schema-validator",
      confidence: 1,
      costEstimate: 0,
      schemaValidationStatus: "valid",
      providerDecision: providerDecision.decision,
      dataPolicyDecision: dataDecision.decision,
      costPolicyDecision: costDecision.decision,
      safetyPolicyDecision: "allow",
      schemaDecision: "resolved",
      qualityDecision: "pass",
      outputBoundaryDecision: "allow",
      disabledProviderDecision: "not_applicable",
      dataQualityFlags: [],
      output: validation.output,
      qualityDecisionReason: null,
    });
  }

  const runtimeHealthDecision = await evaluateAiRuntimeHealthGate({
    request: inputGate.request,
    context: input.context,
  });

  if (runtimeHealthDecision.decision !== "allow") {
    const reason = runtimeHealthDecision.reason ?? "runtime_health_blocked";
    return finalizeTerminalResult({
      request: inputGate.request,
      childContract: input.childContract,
      context: input.context,
      promptContract,
      status: runtimeHealthDecision.decision === "review_required" ? "review_required" : "failed",
      failureReason: runtimeHealthDecision.decision === "blocked" ? reason : null,
      reviewRequiredReason: runtimeHealthDecision.decision === "review_required" ? reason : null,
      implementationStatus: "runtime_health_gate_blocked",
      modelProvider: input.childContract.providerKind,
      runtime: "ai-executor",
      modelName: "unavailable",
      confidence: null,
      costEstimate: null,
      schemaValidationStatus: "not_applicable",
      providerDecision: providerDecision.decision,
      dataPolicyDecision: dataDecision.decision,
      costPolicyDecision: costDecision.decision,
      safetyPolicyDecision: "allow",
      schemaDecision: resolvedSchema.decision,
      qualityDecision: runtimeHealthDecision.decision === "review_required" ? "review_required" : "blocked",
      outputBoundaryDecision: "allow",
      disabledProviderDecision: "not_applicable",
      dataQualityFlags: [reason],
      output: null,
      qualityDecisionReason: reason,
    });
  }

  const runtimeResult = await runAiRuntimeCall({
    request: inputGate.request,
    context: input.context,
  });
  const boundaryDecision = evaluateAiOutputBoundary(runtimeResult.output);
  const safetyDecision = evaluateAiSafetyPolicy({
    request: inputGate.request,
    promptForbiddenOutputs: promptContract.forbiddenOutputs,
    provisionalOutput: runtimeResult.output,
  });
  const schemaIssues = resolvedSchema.outputSchema
    ? validateAiRuntimeOutput(resolvedSchema.outputSchema, runtimeResult.output)
    : { valid: false as const, issues: ["expected_output_schema_missing"] };
  const terminalRuntimeFailure = ["runtime_threw", "runtime_timeout", "circuit_breaker_open", "concurrency_limited"].includes(runtimeResult.implementationStatus)
    ? runtimeResult.implementationStatus
    : null;
  const qualityDecision = evaluateAiQualityGate({
    request: inputGate.request,
    confidence: runtimeResult.confidence,
    schemaIssues: schemaIssues.valid === false ? schemaIssues.issues : [],
    policyReason: boundaryDecision.reason ?? safetyDecision.reason ?? terminalRuntimeFailure,
  });

  if (terminalRuntimeFailure !== null) {
    return finalizeTerminalResult({
      request: inputGate.request,
      childContract: input.childContract,
      context: input.context,
      promptContract,
      status: "failed",
      failureReason: terminalRuntimeFailure,
      reviewRequiredReason: null,
      implementationStatus: runtimeResult.implementationStatus,
      modelProvider: runtimeResult.modelProvider,
      runtime: runtimeResult.runtime,
      modelName: runtimeResult.modelName,
      confidence: runtimeResult.confidence,
      costEstimate: runtimeResult.costEstimate,
      schemaValidationStatus: "invalid",
      providerDecision: providerDecision.decision,
      dataPolicyDecision: dataDecision.decision,
      costPolicyDecision: costDecision.decision,
      safetyPolicyDecision: safetyDecision.decision,
      schemaDecision: resolvedSchema.decision,
      qualityDecision: "blocked",
      outputBoundaryDecision: boundaryDecision.decision,
      disabledProviderDecision: "not_applicable",
      dataQualityFlags: [terminalRuntimeFailure],
      output: null,
      rawOutputRef: runtimeResult.rawOutputRef,
      rawOutputHash: runtimeResult.rawOutputHash,
      runtimeCallId: runtimeResult.runtimeCallId,
      timeoutMs: runtimeResult.timeoutMs,
      attemptIndex: runtimeResult.attemptIndex,
      retryCount: runtimeResult.retryCount,
      circuitBreakerState: runtimeResult.circuitBreakerState,
      gatewayDurationMs: runtimeResult.gatewayDurationMs,
      qualityDecisionReason: terminalRuntimeFailure,
    });
  }

  if (schemaIssues.valid === false || boundaryDecision.decision !== "allow" || safetyDecision.decision !== "allow" || qualityDecision.decision !== "pass") {
    const reason = qualityDecision.reason ?? boundaryDecision.reason ?? safetyDecision.reason ?? "schema_validation_failed";
    return finalizeTerminalResult({
      request: inputGate.request,
      childContract: input.childContract,
      context: input.context,
      promptContract,
      status: qualityDecision.decision === "review_required" ? "review_required" : "failed",
      failureReason: qualityDecision.decision === "blocked" ? reason : null,
      reviewRequiredReason: qualityDecision.decision === "review_required" ? reason : null,
      implementationStatus: "governed_output_rejected",
      modelProvider: runtimeResult.modelProvider,
      runtime: runtimeResult.runtime,
      modelName: runtimeResult.modelName,
      confidence: runtimeResult.confidence,
      costEstimate: runtimeResult.costEstimate,
      schemaValidationStatus: qualityDecision.schemaValidationStatus,
      providerDecision: providerDecision.decision,
      dataPolicyDecision: dataDecision.decision,
      costPolicyDecision: costDecision.decision,
      safetyPolicyDecision: safetyDecision.decision,
      schemaDecision: !schemaIssues.valid ? "review_required" : resolvedSchema.decision,
      qualityDecision: qualityDecision.decision,
      outputBoundaryDecision: boundaryDecision.decision,
      disabledProviderDecision: "not_applicable",
      dataQualityFlags: [...qualityDecision.flags, ...boundaryDecision.flags, ...safetyDecision.flags],
      output: null,
      rawOutputRef: runtimeResult.rawOutputRef,
      rawOutputHash: runtimeResult.rawOutputHash,
      runtimeCallId: runtimeResult.runtimeCallId,
      timeoutMs: runtimeResult.timeoutMs,
      attemptIndex: runtimeResult.attemptIndex,
      retryCount: runtimeResult.retryCount,
      circuitBreakerState: runtimeResult.circuitBreakerState,
      gatewayDurationMs: runtimeResult.gatewayDurationMs,
      schemaIssueCount: schemaIssues.valid ? 0 : schemaIssues.issues.length,
      boundaryViolationCount: boundaryDecision.flags.length,
      qualityDecisionReason: reason,
      createdAt: runtimeResult.createdAt,
    });
  }

  return finalizeTerminalResult({
    request: inputGate.request,
    childContract: input.childContract,
    context: input.context,
    promptContract,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    implementationStatus: runtimeResult.implementationStatus,
    modelProvider: runtimeResult.modelProvider,
    runtime: runtimeResult.runtime,
    modelName: runtimeResult.modelName,
    confidence: runtimeResult.confidence,
    costEstimate: runtimeResult.costEstimate,
    schemaValidationStatus: qualityDecision.schemaValidationStatus,
    providerDecision: providerDecision.decision,
    dataPolicyDecision: dataDecision.decision,
    costPolicyDecision: costDecision.decision,
    safetyPolicyDecision: safetyDecision.decision,
    schemaDecision: resolvedSchema.decision,
    qualityDecision: qualityDecision.decision,
    outputBoundaryDecision: boundaryDecision.decision,
    disabledProviderDecision: "not_applicable",
    dataQualityFlags: [],
    output: schemaIssues.output,
    rawOutputRef: runtimeResult.rawOutputRef,
    rawOutputHash: runtimeResult.rawOutputHash,
    runtimeCallId: runtimeResult.runtimeCallId,
    timeoutMs: runtimeResult.timeoutMs,
    attemptIndex: runtimeResult.attemptIndex,
    retryCount: runtimeResult.retryCount,
    circuitBreakerState: runtimeResult.circuitBreakerState,
    gatewayDurationMs: runtimeResult.gatewayDurationMs,
    schemaIssueCount: 0,
    boundaryViolationCount: 0,
    qualityDecisionReason: null,
    createdAt: runtimeResult.createdAt,
  });
}
