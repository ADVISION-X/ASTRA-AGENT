import {
  GPT_TURN_FLOW_VERSION,
  GPT_CHILD_CAPABILITY_CONTRACTS,
  GptTurnExecutor,
  type GptAbilityGroup,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
  type GptExecutionContext,
  type GptProviderContinuation,
  type GptTurnResumePoint,
} from "../../../capabilities/gpt/index.js";
import { createHash } from "node:crypto";
import type { BrowserTargetLease } from "../../browser/browser-authority-api.js";
import { executionFailure } from "../../typed-failure.js";
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

const turnExecutor = new GptTurnExecutor();

const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const recoveredMutationResult = (input: Readonly<{
  flow: FlowInput;
  childCapabilityId: GptChildCapabilityIntent["childCapabilityId"];
  stepIndex: number;
  state: "confirmed" | "rejected";
  authorityRef: string;
  authorityHash: `sha256:${string}`;
}>): GptChildCapabilityResult => {
  const timestamp = new Date().toISOString();
  const result: GptChildCapabilityResult = Object.freeze({
    status: input.state === "confirmed" ? "success" : "failed",
    value: Object.freeze({ recoveredFromBrowserWal: input.state }),
    proof: Object.freeze({
      schemaVersion: "gpt-child-capability-proof.v2",
      childCapabilityId: input.childCapabilityId,
      executionId: `${input.flow.state.executionId}:${input.stepIndex}:${input.childCapabilityId}`,
      flowVersion: GPT_TURN_FLOW_VERSION,
      stepIndex: input.stepIndex,
      inputHash: input.flow.inputHash,
      pluginStepId: input.flow.request.stepId,
      actionOrdinal: input.stepIndex + 1,
      targetRefHash: hashText(input.flow.browser.target.targetRef),
      beforeDocumentRefHash: hashText(input.flow.browser.document.documentRef),
      afterDocumentRefHash: hashText(input.flow.browser.document.documentRef),
      candidateCount: 1,
      observedSemantics: Object.freeze(["durable-browser-wal-recovery", input.state]),
      committedMutation: "confirmed",
      postconditionResult: input.state === "confirmed" ? "passed" : "failed",
      startedAt: timestamp,
      endedAt: timestamp,
      evidenceRef: input.authorityRef,
      evidenceHash: input.authorityHash,
    }),
    failureCode: input.state === "confirmed" ? null : "BROWSER_POSTCONDITION_FAILED",
  });
  persistedEvidenceRefs.set(result, input.authorityRef);
  return result;
};

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
  if (!evidenceRef) throw executionFailure("failed", "EVIDENCE_REF_MISSING");
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
    throw executionFailure("failed", "GPT_TURN_FINAL_CHECKPOINT_MISSING");
  }
};

export const executeProductionGptTurnFlow = async (input: FlowInput): Promise<ProviderTurnResult> => {
  const dispatchState = { used: input.checkpoint?.provider_dispatch_used ?? false };
  const execution = await turnExecutor.execute({
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
    recoverMutation: async (step, stepIndex) => {
      const contract = GPT_CHILD_CAPABILITY_CONTRACTS[step.childCapabilityId];
      if (contract.replayPolicy === "observation-only") return null;
      const recovery = input.browser.readAtomicStepRecovery({
        pluginStepId: input.request.stepId,
        childCapabilityId: step.childCapabilityId,
        flowVersion: GPT_TURN_FLOW_VERSION,
        stepIndex,
        inputHash: input.inputHash,
        actionOrdinal: stepIndex + 1,
        replayPolicy: contract.replayPolicy,
      });
      if (!recovery) return null;
      if (step.childCapabilityId === "submit_exact_gpt_turn_once" && !dispatchState.used) {
        dispatchState.used = true;
        input.request.lease.provider_turns_used += 1;
      }
      return {
        state: recovery.state,
        result: recovery.state === "dispatched"
          ? recoveredMutationResult({
            flow: input, childCapabilityId: step.childCapabilityId, stepIndex,
            state: "confirmed", authorityRef: recovery.authorityRef, authorityHash: recovery.authorityHash,
          })
          : recoveredMutationResult({
            flow: input, childCapabilityId: step.childCapabilityId, stepIndex,
            state: recovery.state, authorityRef: recovery.authorityRef, authorityHash: recovery.authorityHash,
          }),
      };
    },
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
  if (!browser) return;
  const shouldPark = primaryError !== null
    && (browser.pendingMutationCount() > 0 || browser.requiresTurnRecovery());
  try {
    if (shouldPark) await browser.park({ reason: "gpt-turn-recovery-required" });
    else await browser.close({ reason: "gpt-turn-settled" });
  } catch (closeError) {
    if (primaryError === null) throw closeError;
    throw new AggregateError([primaryError, closeError], "GPT_BROWSER_LIFECYCLE_FAILED");
  }
};

export const gptTurnTimeoutMs = (expiresAtMonotonic: number): number =>
  Math.min(3_600_000, Math.max(60_000, Math.floor(expiresAtMonotonic - performance.now())));
