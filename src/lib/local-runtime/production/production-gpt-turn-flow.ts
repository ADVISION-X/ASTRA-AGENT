import {
  GPT_TURN_FLOW_VERSION,
  type GptAbilityGroup,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
  type GptExecutionContext,
  type GptProviderContinuation,
  type GptTurnResumePoint,
} from "../../../capabilities/gpt/index.js";
import type { BrowserTargetLease } from "../../browser/browser-authority-api.js";
import { executionFailure, typedExecutionFailure } from "../../typed-failure.js";
import type { ProductionExecutionLease } from "./executor.js";
import {
  applyGptChildValue,
  buildGptTurnResult,
  gptChildInput,
  type GptTurnState,
} from "./gpt-turn-state.js";
import { persistedEvidenceRefs } from "./gpt-evidence-writer.js";
import type { ProviderTurnResult } from "./plugin.js";
import { ProductionRuntimeStore, type GptTurnDurableCheckpoint } from "./store.js";

type FlowRequest = Readonly<{
  jobId: string;
  pluginId: string;
  stepId: string;
  lease: ProductionExecutionLease;
  outputKind: "text" | "generated_image";
}>;

type FlowInput = Readonly<{
  gpt: GptAbilityGroup;
  store: ProductionRuntimeStore;
  request: FlowRequest;
  state: GptTurnState;
  browser: BrowserTargetLease;
  continuation: GptProviderContinuation | null;
  timeoutMs: number;
  inputHash: `sha256:${string}`;
  checkpoint: GptTurnDurableCheckpoint | null;
  context: GptExecutionContext;
  executeChild(intent: GptChildCapabilityIntent, context: GptExecutionContext): Promise<GptChildCapabilityResult>;
  failChild(result: GptChildCapabilityResult): never;
}>;

const resumePoint = (checkpoint: GptTurnDurableCheckpoint | null): GptTurnResumePoint | null => checkpoint ? {
  stepIndex: checkpoint.step_index,
  childCapabilityId: checkpoint.child_capability_id,
  status: checkpoint.status,
  mutationState: checkpoint.mutation_state,
} : null;

const resolveReconciledMutation = async (input: Readonly<{
  browser: BrowserTargetLease;
  pluginId: string;
  evidenceRef: string;
  reconcileOnly: boolean;
  result: GptChildCapabilityResult;
}>): Promise<boolean> => {
  const reconciled = input.reconcileOnly
    && input.result.status === "success"
    && input.browser.pendingMutationCount() === 1;
  if (!reconciled) return false;
  await input.browser.resolvePendingMutation({
    schemaVersion: "grasseye.browser.outcome-resolution.v1",
    ownerPluginId: input.pluginId,
    outcome: "TERMINAL_SUCCESS",
    positiveEvidenceRef: `${input.evidenceRef}#positive-postcondition`,
    negativeEvidenceRef: `${input.evidenceRef}#negative-postcondition-absent`,
    uniqueTargetRef: input.browser.target.targetRef,
    boundedAt: new Date().toISOString(),
  });
  return true;
};

const completedTurnResult = (
  state: GptTurnState,
  childCapabilityId: GptChildCapabilityIntent["childCapabilityId"],
  outputKind: FlowRequest["outputKind"],
  result: GptChildCapabilityResult,
): ProviderTurnResult | null => {
  const finalChild = outputKind === "text"
    ? childCapabilityId === "checkpoint_gpt_text_response"
    : childCapabilityId === "checkpoint_gpt_generated_image";
  return result.status === "success" && finalChild ? buildGptTurnResult(state) : null;
};

const checkpointTurnStep = async (input: Readonly<{
  flow: FlowInput;
  stepIndex: number;
  childCapabilityId: GptChildCapabilityIntent["childCapabilityId"];
  reconcileOnly: boolean;
  result: GptChildCapabilityResult;
  dispatchState: { used: boolean };
}>): Promise<void> => {
  const evidenceRef = persistedEvidenceRefs.get(input.result);
  if (!evidenceRef) throw executionFailure("review_required", "EVIDENCE_REF_MISSING");
  if (!input.flow.state.evidenceRefs.includes(evidenceRef)) input.flow.state.evidenceRefs.push(evidenceRef);
  if (input.result.status === "success") {
    applyGptChildValue(input.childCapabilityId, input.result.value, input.flow.state);
  }
  const reconciled = await resolveReconciledMutation({
    browser: input.flow.browser,
    pluginId: input.flow.request.pluginId,
    evidenceRef,
    reconcileOnly: input.reconcileOnly,
    result: input.result,
  });
  if (input.childCapabilityId === "submit_exact_gpt_turn_once"
    && input.result.proof.committedMutation !== "no") {
    input.dispatchState.used = true;
    input.flow.request.lease.provider_turns_used += 1;
  }
  input.flow.store.writeGptTurnCheckpoint(input.flow.request.jobId, input.flow.request.stepId, {
    schema_version: "gpt-turn-checkpoint.v2",
    flow_version: GPT_TURN_FLOW_VERSION,
    input_hash: input.flow.inputHash,
    step_index: input.stepIndex,
    child_capability_id: input.childCapabilityId,
    status: input.result.status === "success" ? "success" : "failed",
    mutation_state: reconciled ? "confirmed" : input.result.proof.committedMutation,
    postcondition_result: input.result.proof.postconditionResult,
    evidence_ref: evidenceRef,
    evidence_hash: input.result.proof.evidenceHash,
    provider_dispatch_used: input.dispatchState.used,
    state: structuredClone(input.flow.state),
    result: completedTurnResult(input.flow.state, input.childCapabilityId, input.flow.request.outputKind, input.result),
  });
};

const dispatchTurnChild = async (
  input: FlowInput,
  intent: GptChildCapabilityIntent,
  context: GptExecutionContext,
): Promise<GptChildCapabilityResult> => {
  if (intent.childCapabilityId === "submit_exact_gpt_turn_once"
    && intent.input.reconcileOnly !== true
    && input.store.countGptProviderDispatches(input.request.jobId) >= input.request.lease.max_provider_turns) {
    throw executionFailure("failed", "PROVIDER_TURN_BUDGET_EXHAUSTED");
  }
  return input.executeChild(intent, context);
};

const assertFinalCheckpoint = (input: FlowInput, result: ProviderTurnResult): void => {
  const checkpoint = input.store.readGptTurnCheckpoint(input.request.jobId, input.request.stepId, input.inputHash);
  if (!checkpoint?.result || JSON.stringify(checkpoint.result) !== JSON.stringify(result)) {
    throw executionFailure("review_required", "GPT_TURN_FINAL_CHECKPOINT_MISSING");
  }
};

export const executeProductionGptTurnFlow = async (input: FlowInput): Promise<ProviderTurnResult> => {
  const dispatchState = { used: input.checkpoint?.provider_dispatch_used ?? false };
  const execution = await input.gpt.executeTurn({
    executionId: input.state.executionId,
    inputHash: input.inputHash,
    pluginStepId: input.request.stepId,
    mode: input.continuation ? "continuation" : "fresh",
    hasAttachments: input.state.files.length > 0,
    outputKind: input.request.outputKind,
    resume: resumePoint(input.checkpoint),
    context: input.context,
    inputFor: (step, reconcileOnly) => gptChildInput(
      step.childCapabilityId, input.state, input.continuation, input.timeoutMs, reconcileOnly,
    ),
    dispatch: (intent, context) => dispatchTurnChild(input, intent, context),
    checkpoint: ({ step, stepIndex, reconcileOnly, result }) => checkpointTurnStep({
      flow: input, stepIndex, childCapabilityId: step.childCapabilityId,
      reconcileOnly, result, dispatchState,
    }),
  });
  if (execution.failure) input.failChild(execution.failure);
  const result = buildGptTurnResult(input.state);
  assertFinalCheckpoint(input, result);
  return result;
};

export const closeSettledGptBrowser = async (
  browser: BrowserTargetLease | null,
  primaryError: unknown,
): Promise<void> => {
  const safeToClose = browser && browser.pendingMutationCount() === 0
    && (primaryError === null || typedExecutionFailure(primaryError)?.mutationOutcome === "no");
  if (!safeToClose) return;
  try {
    await browser.close({ reason: "gpt-turn-settled" });
  } catch (closeError) {
    if (primaryError === null) throw closeError;
  }
};

export const gptTurnTimeoutMs = (expiresAtMonotonic: number): number =>
  Math.min(3_600_000, Math.max(60_000, Math.floor(expiresAtMonotonic - performance.now())));
