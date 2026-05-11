import { recordMissionRuntimeEvent } from "./orchestration-step-trace-recorder.js";
import {
  buildCapabilityEventType,
  buildStepDispatchFailureEvent,
  collectLastResultRefs,
  getTerminalEventType,
} from "./orchestration-loop-iteration-event-shared.js";
import type {
  ActionLogRecord,
  LoopIterationEventInput,
  LoopTerminalOutcome,
  StepResultRecord,
} from "./orchestration-loop-iteration-event-shared.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
import { isPostActionVerificationStep } from "./orchestration-post-action-verification.js";
import { buildFailureSnapshot } from "./orchestration-failure-snapshot.js";

const buildMissionFailureSnapshot = (state: LoopIterationEventInput["state"], step: OperationalStep, failureReason?: string | null) =>
  buildFailureSnapshot({ state, step, failureReason: failureReason ?? null });

export async function recordStepSelected(input: LoopIterationEventInput, step: OperationalStep, currentStepId: string): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "RUNTIME_STEP_SELECTED",
    status: "success",
    reason: `Orchestration selected governed step "${currentStepId}" from the active runtime plan.`,
    actionableMessage: "Evaluate governed dispatch gates before sending the step through Nerve Bus.",
    ownerResponsible: "Orchestration",
    capabilityCallId: input.stepDispatchCallId,
    refs: [currentStepId, step.stepKind, step.targetAbilityGroupId ?? "no-target"],
  });
}

export async function recordPreconditionCheck(
  input: LoopIterationEventInput,
  step: OperationalStep,
  details: {
    status: "success" | "failed";
    reason: string;
    failureReason?: string;
  },
): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "STEP_PRECONDITION_CHECKED",
    status: details.status,
    reason: details.reason,
    failureReason: details.failureReason ?? null,
    actionableMessage: details.status === "success"
      ? "Dispatch the governed step through Nerve Bus."
      : "Repair the blocking step gate before retrying this mission step.",
    ownerResponsible: "Orchestration",
    capabilityCallId: input.stepDispatchCallId,
    failureSnapshot: details.status === "failed"
      ? buildMissionFailureSnapshot(input.state, step, details.failureReason ?? null)
      : null,
  });
}

function buildStepResultEventDetails(lastResult: StepResultRecord, input: LoopIterationEventInput, step: OperationalStep, actionLog: ActionLogRecord) {
  return {
    actionableMessage: lastResult.status === "success"
      ? "Evaluate the declared transition for this step result."
      : "Inspect the blocking step result and runtime proof before retrying.",
    actionLogRefs: actionLog ? [actionLog.actionLogId] : [],
    actionRef: actionLog?.actionRef ?? null,
    capabilityCallId: input.stepDispatchCallId,
    outputRefs: [...collectLastResultRefs(lastResult), ...(lastResult.envelopeId ? [`resultEnvelopeRef=${lastResult.envelopeId}`] : [])],
    proofSummary: lastResult.branchFieldValues,
    ownerResponsible: `Orchestration / ${step.targetAbilityGroupId ?? "orchestration"}`,
  };
}

async function recordCapabilityCallStarted(input: LoopIterationEventInput, step: OperationalStep): Promise<void> {
  if (!step.targetAbilityGroupId) {
    return;
  }

  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "CAPABILITY_CALL_STARTED",
    status: "started",
    reason: `Governed ability step "${step.stepId}" entered "${step.targetAbilityGroupId}" execution.`,
    actionableMessage: "Wait for the governed capability result before evaluating transitions.",
    ownerResponsible: `Orchestration / ${step.targetAbilityGroupId}`,
    capabilityCallId: input.stepDispatchCallId,
  });
}

async function recordPostActionVerificationStarted(input: LoopIterationEventInput, step: OperationalStep): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "POST_ACTION_VERIFICATION_STARTED",
    status: "started",
    reason: `Governed post-action verification step "${step.stepId}" entered verification execution.`,
    actionableMessage: "Wait for the governed post-action verification result before evaluating transitions.",
    ownerResponsible: "Orchestration / post-action-verification",
    capabilityCallId: input.stepDispatchCallId,
  });
}

export async function recordDispatchStarted(input: LoopIterationEventInput, step: OperationalStep): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "STEP_DISPATCH_STARTED",
    status: "started",
    reason: `Dispatching step "${step.stepId}" to ability group "${step.targetAbilityGroupId ?? "orchestration"}".`,
    actionableMessage: "Wait for the governed step result before evaluating transitions.",
    ownerResponsible: "Orchestration / Nerve Bus",
    capabilityCallId: input.stepDispatchCallId,
  });
  if (isPostActionVerificationStep(step)) {
    await recordPostActionVerificationStarted(input, step);
    return;
  }

  await recordCapabilityCallStarted(input, step);
}

export async function recordStepDispatchFailure(
  input: LoopIterationEventInput,
  step: OperationalStep,
  failureReason: string,
  proofId: string,
): Promise<void> {
  const failureEvent = buildStepDispatchFailureEvent(step);
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: failureEvent.eventType,
    status: "failed",
    reason: failureEvent.reason,
    failureReason,
    actionableMessage: "Inspect the step dispatch failure and runtime proof before retrying this mission.",
    ownerResponsible: failureEvent.ownerResponsible,
    capabilityCallId: input.stepDispatchCallId,
    proofRefs: [proofId],
    failureSnapshot: buildMissionFailureSnapshot(input.state, step, failureReason),
  });
}

export async function recordStepResult(
  input: LoopIterationEventInput,
  step: OperationalStep,
  details: {
    lastResult: StepResultRecord;
    durationMs: number;
    actionLog: ActionLogRecord;
  },
): Promise<void> {
  const eventDetails = buildStepResultEventDetails(details.lastResult, input, step, details.actionLog);
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: buildCapabilityEventType(step, details.lastResult.status),
    status: details.lastResult.status,
    reason: `Governed step "${step.stepId}" returned status "${details.lastResult.status}".`,
    failureReason: details.lastResult.failureReason ?? null,
    reviewRequiredReason: details.lastResult.reviewRequiredReason ?? null,
    actionableMessage: eventDetails.actionableMessage,
    ownerResponsible: eventDetails.ownerResponsible,
    durationMs: details.durationMs,
    capabilityCallId: eventDetails.capabilityCallId,
    outputRefs: eventDetails.outputRefs,
    producedOutputRefs: collectLastResultRefs(details.lastResult),
    proofSummary: eventDetails.proofSummary,
    actionLogRefs: eventDetails.actionLogRefs,
    actionRef: eventDetails.actionRef,
    stepResult: details.lastResult,
    failureSnapshot: details.lastResult.status === "success"
      ? null
      : buildMissionFailureSnapshot(input.state, step, details.lastResult.failureReason ?? details.lastResult.reviewRequiredReason ?? null),
  });
}

export async function recordTransitionEvaluation(
  input: LoopIterationEventInput,
  step: OperationalStep,
  details: {
    status: "success" | "failed";
    decision: string;
    reason: string;
    failureReason?: string | null;
    proofId: string;
    capabilityCallId: string | null;
  },
): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "STEP_TRANSITION_EVALUATED",
    status: details.status,
    reason: details.reason,
    failureReason: details.failureReason ?? null,
    actionableMessage: details.status === "success"
      ? "Continue the governed mission loop using the matched transition."
      : "Repair the transition failure before retrying this mission.",
    ownerResponsible: "Orchestration",
    decision: details.decision,
    capabilityCallId: details.capabilityCallId,
    proofRefs: [details.proofId],
    failureSnapshot: details.status === "failed"
      ? buildMissionFailureSnapshot(input.state, step, details.failureReason ?? null)
      : null,
  });
}

function resolveTerminalRuntimeStatus(status: LoopTerminalOutcome["state"]["status"]) {
  return status === "review_required"
    ? "review_required" as const
    : status === "failed"
      ? "failed" as const
      : "success" as const;
}

function resolveTerminalActionableMessage(status: LoopTerminalOutcome["state"]["status"]): string {
  if (status === "failed") {
    return "Inspect the mission runtime proof and blocking step outcome before retrying.";
  }
  if (status === "review_required") {
    return "Open Commander review flow and resolve the governed review requirement.";
  }
  return "Read the mission proof timeline and persisted records for the completed mission.";
}

function buildTerminalFailureSnapshot(outcome: LoopTerminalOutcome, step: OperationalStep) {
  return outcome.state.status === "failed" || outcome.state.status === "review_required"
    ? buildMissionFailureSnapshot(outcome.state, step, outcome.state.failureReason ?? outcome.state.reviewRequiredReason ?? null)
    : null;
}

export async function recordTerminalOutcome(
  input: Omit<LoopIterationEventInput, "state">,
  step: OperationalStep,
  outcome: LoopTerminalOutcome,
): Promise<void> {
  const eventType = getTerminalEventType(outcome.state.status);
  if (!eventType || !outcome.lastProof) {
    return;
  }

  await recordMissionRuntimeEvent({
    context: input.context,
    state: outcome.state,
    mapRecord: input.mapRecord,
    step,
    eventType,
    status: resolveTerminalRuntimeStatus(outcome.state.status),
    reason: `Mission reached terminal status "${outcome.state.status}" after step "${step.stepId}".`,
    failureReason: outcome.state.failureReason ?? null,
    reviewRequiredReason: outcome.state.reviewRequiredReason ?? null,
    actionableMessage: resolveTerminalActionableMessage(outcome.state.status),
    ownerResponsible: "Orchestration",
    capabilityCallId: input.stepDispatchCallId,
    proofRefs: [outcome.lastProof.proofId],
    outputRefs: outcome.lastResult?.envelopeId ? [`resultEnvelopeRef=${outcome.lastResult.envelopeId}`] : [],
    stepResult: outcome.lastResult,
    failureSnapshot: buildTerminalFailureSnapshot(outcome, step),
  });
}
