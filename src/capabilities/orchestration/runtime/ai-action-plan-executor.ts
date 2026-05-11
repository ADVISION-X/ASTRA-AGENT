/**
 * AI Action Plan Executor — runs an ExecutionPlan via the Nerve Bus.
 *
 * Moved from muscle-memory/executor. Execution belongs to Orchestration, not the registry.
 */

import { buildAbilityOutputSchemaRef } from "./step-dispatch-shared.js";
import {
  AiActionPlanExecutionResultSchema,
  type AiActionPlanExecutionActionResult,
  type AiActionPlanExecutionResult,
} from "./ai-action-plan-execution-result.schema.js";
import type { ExecutionAction, ExecutionPlan } from "./ai-action-plan-decoder.js";

// ─── Types ─────────────────────────────────────────────────────────────────

type PayloadRefs = Record<string, unknown> & {
  abilityResultRef?: string | null;
  productLeadRecordRef?: string | null;
  nextItemAdvanceProofRef?: string | null;
  reviewRequiredRef?: string | null;
};

type DispatchInputValue = string | number | boolean | null | undefined;

type ExecutionChain = {
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  bindingPackageId: string;
  bindingPackageVersion: string;
  bindingVersion: string;
  bindingActivationRef: string;
  bindingSnapshotRef: string;
};

type AbilityDispatchResult = {
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  payloadRefs: PayloadRefs;
};

type AbilityDispatchCommand = {
  missionId: string;
  mapId: string;
  stepId: string;
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  bindingPackageId: string;
  bindingPackageVersion: string;
  bindingVersion: string;
  bindingActivationRef: string;
  bindingSnapshotRef: string;
  targetAbilityGroupId: string;
  childCapabilityId: string;
  expectedOutputSchemaRef: string;
  postClickObservation: boolean;
  payloadRefs: PayloadRefs;
  actionInputRef?: string | null;
  dispatchInput?: Record<string, DispatchInputValue>;
  sequenceNo: number;
  idempotencyKey: string;
  timeoutMs: number;
};

type ExecuteAiActionPlanInput = {
  state: { payloadRefs: PayloadRefs };
  map: { mapId: string };
  missionId: string;
  chain: ExecutionChain;
  sequenceNo: number;
  idempotencyKey: string;
  plan: ExecutionPlan;
  nerveBus: {
    sendCommandToAbility(command: AbilityDispatchCommand): Promise<AbilityDispatchResult>;
  };
};

// ─── Summary helpers ───────────────────────────────────────────────────────

function readStringInput(action: ExecutionAction, key: string): string | null {
  const value = action.input[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function resolveGridCell(action: ExecutionAction): string | null {
  const directGridCell = readStringInput(action, "gridCell");
  if (directGridCell) return directGridCell;
  for (const [key, value] of Object.entries(action.input)) {
    if (key.endsWith("GridCell") && typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function buildDefaultSummary(action: ExecutionAction, status: AiActionPlanExecutionActionResult["status"]): string {
  if (status === "success") return `${action.sourceActionCode} executed.`;
  if (status === "review_required") return `${action.sourceActionCode} requested human review.`;
  if (status === "failed") return `${action.sourceActionCode} failed.`;
  return `${action.sourceActionCode} is pending.`;
}

function resolveActionSummaryFields(input: {
  action: ExecutionAction;
  status: AiActionPlanExecutionActionResult["status"];
  completedAt?: string | null;
}): Pick<AiActionPlanExecutionActionResult, "gridCell" | "targetName" | "summary" | "completedAt"> {
  return {
    gridCell: resolveGridCell(input.action),
    targetName: readStringInput(input.action, "targetName"),
    summary: buildDefaultSummary(input.action, input.status),
    completedAt: input.completedAt ?? null,
  };
}

// ─── Dispatch helpers ──────────────────────────────────────────────────────

type SyntheticDispatch = {
  mode: "nerve-bus" | "local-review-required";
  stepId: string;
  targetAbilityGroupId: string;
  childCapabilityId: string;
  timeoutMs: number;
};

function toSyntheticStepId(action: ExecutionAction): string {
  return `ai-plan:${action.sourceActionCode.toLowerCase().replaceAll("_", "-")}:${action.resolvedActionId}`;
}

function resolveSyntheticDispatch(action: ExecutionAction): SyntheticDispatch {
  if (
    action.sourceActionCode === "STOP_REVIEW_REQUIRED_ONCE"
    || (action.abilityGroupId === "orchestration" && action.childCapabilityId === "emergency-stop")
  ) {
    return {
      mode: "local-review-required",
      stepId: "stop-review-required",
      targetAbilityGroupId: "orchestration",
      childCapabilityId: "emergency-stop",
      timeoutMs: 0,
    };
  }
  return {
    mode: "nerve-bus",
    stepId: toSyntheticStepId(action),
    targetAbilityGroupId: action.abilityGroupId,
    childCapabilityId: action.childCapabilityId,
    timeoutMs: 60_000,
  };
}

function augmentPayloadRefs(action: ExecutionAction, payloadRefs: PayloadRefs): PayloadRefs {
  if (!payloadRefs.abilityResultRef) return payloadRefs;
  let next = payloadRefs;
  for (const refKey of action.successOutputRefs) {
    if (refKey === "abilityResultRef" || next[refKey] != null) continue;
    next = { ...next, [refKey]: payloadRefs.abilityResultRef };
  }
  return next;
}

function toDispatchInputValue(value: unknown): DispatchInputValue {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.stringify(value);
}

function buildActionDispatchInput(action: ExecutionAction, syntheticDispatch: SyntheticDispatch): Record<string, DispatchInputValue> {
  return {
    sourceActionCode: action.sourceActionCode,
    resolvedActionId: action.resolvedActionId,
    targetAbilityGroupId: syntheticDispatch.targetAbilityGroupId,
    targetChildCapabilityId: syntheticDispatch.childCapabilityId,
    ...Object.fromEntries(
      Object.entries(action.input)
        .map(([key, value]) => [key, toDispatchInputValue(value)] as const)
        .filter(([, value]) => value !== undefined),
    ),
  };
}

function resolveMissingPayloadRefs(action: ExecutionAction, payloadRefs: PayloadRefs): string[] {
  return (action.requiredPayloadRefs ?? []).filter((refKey) => payloadRefs[refKey] == null);
}

function buildActionResult(input: {
  action: ExecutionAction;
  syntheticDispatch: SyntheticDispatch;
  actionInputRef: string;
  status: AiActionPlanExecutionActionResult["status"];
  outputRef: string | null;
  failureReason: string | null;
}): AiActionPlanExecutionActionResult {
  return {
    resolvedActionId: input.action.resolvedActionId,
    sourceActionCode: input.action.sourceActionCode,
    syntheticStepId: input.syntheticDispatch.stepId,
    targetAbilityGroupId: input.syntheticDispatch.targetAbilityGroupId,
    childCapabilityId: input.syntheticDispatch.childCapabilityId,
    ...resolveActionSummaryFields({
      action: input.action,
      status: input.status,
      completedAt: new Date().toISOString(),
    }),
    actionInputRef: input.actionInputRef,
    status: input.status,
    outputRef: input.outputRef,
    failureReason: input.failureReason,
  };
}

function resolveFailureStatus(action: ExecutionAction, dispatchStatus: string): "failed" | "review_required" {
  if (dispatchStatus === "review_required" || action.onFailure === "review_required") {
    return "review_required";
  }
  return "failed";
}

async function dispatchExecutionAction(input: {
  executionInput: ExecuteAiActionPlanInput;
  action: ExecutionAction;
  actionIndex: number;
  payloadRefs: PayloadRefs;
}) {
  const { executionInput, action, payloadRefs } = input;
  const syntheticDispatch = resolveSyntheticDispatch(action);
  const actionInputRef = `${executionInput.missionId}:${action.resolvedActionId}:action-input`;

  if (syntheticDispatch.mode === "local-review-required") {
    const failureReason = "AI action plan requested fail-closed human review.";
    const reviewRequiredRef = `${action.resolvedActionId}:review-required`;
    const nextPayloadRefs: PayloadRefs = { ...payloadRefs, reviewRequiredRef };
    return {
      dispatchResult: { status: "review_required" as const, failureReason, payloadRefs: nextPayloadRefs },
      nextPayloadRefs,
      actionResult: buildActionResult({ action, syntheticDispatch, actionInputRef, status: "review_required", outputRef: reviewRequiredRef, failureReason }),
    };
  }

  const missingPayloadRefs = resolveMissingPayloadRefs(action, payloadRefs);
  if (missingPayloadRefs.length > 0) {
    const status = resolveFailureStatus(action, "failed");
    const failureReason = `Missing required payload refs for ${action.sourceActionCode}: ${missingPayloadRefs.join(", ")}.`;
    return {
      dispatchResult: { status, failureReason, payloadRefs },
      nextPayloadRefs: payloadRefs,
      actionResult: buildActionResult({ action, syntheticDispatch, actionInputRef, status, outputRef: null, failureReason }),
    };
  }

  const dispatchResult = await executionInput.nerveBus.sendCommandToAbility({
    missionId: executionInput.missionId,
    mapId: executionInput.map.mapId,
    stepId: syntheticDispatch.stepId,
    runId: executionInput.chain.runId,
    sessionId: executionInput.chain.sessionId,
    roundId: executionInput.chain.roundId,
    videoVisitId: executionInput.chain.videoVisitId,
    bindingPackageId: executionInput.chain.bindingPackageId,
    bindingPackageVersion: executionInput.chain.bindingPackageVersion,
    bindingVersion: executionInput.chain.bindingVersion,
    bindingActivationRef: executionInput.chain.bindingActivationRef,
    bindingSnapshotRef: executionInput.chain.bindingSnapshotRef,
    targetAbilityGroupId: syntheticDispatch.targetAbilityGroupId,
    childCapabilityId: syntheticDispatch.childCapabilityId,
    expectedOutputSchemaRef: buildAbilityOutputSchemaRef(syntheticDispatch.targetAbilityGroupId, syntheticDispatch.childCapabilityId),
    postClickObservation: false,
    payloadRefs,
    actionInputRef,
    dispatchInput: buildActionDispatchInput(action, syntheticDispatch),
    sequenceNo: executionInput.sequenceNo + input.actionIndex,
    idempotencyKey: `${executionInput.idempotencyKey}:${action.resolvedActionId}`,
    timeoutMs: syntheticDispatch.timeoutMs,
  });

  const nextPayloadRefs = augmentPayloadRefs(action, { ...payloadRefs, ...dispatchResult.payloadRefs });
  return {
    dispatchResult,
    nextPayloadRefs,
    actionResult: buildActionResult({
      action,
      syntheticDispatch,
      actionInputRef,
      status: dispatchResult.status,
      outputRef: dispatchResult.payloadRefs.abilityResultRef ?? null,
      failureReason: dispatchResult.failureReason,
    }),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function executeAiActionPlan(input: ExecuteAiActionPlanInput): Promise<AiActionPlanExecutionResult> {
  let payloadRefs = { ...input.state.payloadRefs };
  const actionResults: AiActionPlanExecutionActionResult[] = [];

  for (const [actionIndex, action] of input.plan.actions.entries()) {
    const dispatched = await dispatchExecutionAction({
      executionInput: input,
      action,
      actionIndex,
      payloadRefs,
    });
    payloadRefs = dispatched.nextPayloadRefs;
    actionResults.push(dispatched.actionResult);

    const dispatchStatus = dispatched.dispatchResult.status;
    if (dispatchStatus !== "success" && (action.required || action.onFailure !== "continue")) {
      return AiActionPlanExecutionResultSchema.parse({
        status: resolveFailureStatus(action, dispatchStatus),
        failureReason: dispatched.dispatchResult.failureReason ?? `AI plan action ${action.sourceActionCode} failed.`,
        payloadRefs,
        actionResults,
      });
    }
  }

  return AiActionPlanExecutionResultSchema.parse({
    status: "success",
    failureReason: null,
    payloadRefs,
    actionResults,
  });
}

/** Backward-compatible alias for callers using the old name. */
export const executeMuscleMemoryPlan = executeAiActionPlan;

export type { ExecuteAiActionPlanInput, PayloadRefs };
