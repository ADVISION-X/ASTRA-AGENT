import type { MissionState } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import { recordMissionRuntimeEvent } from "./orchestration-step-trace-recorder.js";
import type { OperationalStep } from "./step-dispatch-shared.js";

type StepResultRecord = {
  status: "success" | "failed" | "review_required";
  envelopeId?: string | null;
  resultRef?: string | null;
  outputRef?: string | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  payloadRefs: MissionState["payloadRefs"];
};

type ActionLogRecord = {
  actionLogId: string;
  actionRef: string;
  postActionVerificationRef: string;
} | null;

type RuntimeProofLike = {
  proofId: string;
};

type LoopIterationEventInput = {
  context: OrchestrationRuntimeContext;
  state: MissionState;
  mapRecord: ActiveOperationalMapRecord | null;
  stepDispatchCallId: string;
};

type LoopTerminalOutcome = {
  state: MissionState;
  lastResult: StepResultRecord | null;
  lastProof: RuntimeProofLike | null;
};

function getTerminalEventType(status: MissionState["status"]): "MISSION_FAILED" | "MISSION_FINALIZED" | "MISSION_REVIEW_REQUIRED" | "MISSION_STOPPED" | null {
  if (status === "failed") {
    return "MISSION_FAILED";
  }
  if (status === "review_required") {
    return "MISSION_REVIEW_REQUIRED";
  }
  if (status === "stopped") {
    return "MISSION_STOPPED";
  }
  return status === "completed" ? "MISSION_FINALIZED" : null;
}

function collectLastResultRefs(lastResult: StepResultRecord): string[] {
  return [
    ...(lastResult.resultRef ? [lastResult.resultRef] : []),
    ...(lastResult.outputRef ? [lastResult.outputRef] : []),
  ];
}

function resolvePayloadRefValue(payloadRefs: MissionState["payloadRefs"], key: string): string | null {
  const payloadKey = key as keyof MissionState["payloadRefs"];
  const value = payloadRefs[payloadKey];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function resolveActionRef(state: MissionState): string | null {
  return (
    resolvePayloadRefValue(state.payloadRefs, "actionResultRef")
    ?? resolvePayloadRefValue(state.payloadRefs, "textInputResultRef")
    ?? resolvePayloadRefValue(state.payloadRefs, "scrollResultRef")
    ?? resolvePayloadRefValue(state.payloadRefs, "abilityResultRef")
    ?? state.lastResultRef
    ?? null
  );
}

export async function recordStepSelected(input: LoopIterationEventInput, step: OperationalStep, currentStepId: string): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "MAP_STEP_SELECTED",
    status: "success",
    reason: `Orchestration selected governed step "${currentStepId}" from the frozen operational map.`,
    actionableMessage: "Evaluate governed dispatch gates before sending the step through Nerve Bus.",
    ownerResponsible: "Orchestration",
    capabilityCallId: input.stepDispatchCallId,
    refs: [currentStepId, step.stepKind, step.targetAbilityGroupId ?? "no-target"],
  });
}

export async function recordPreconditionCheck(
  input: LoopIterationEventInput,
  step: OperationalStep,
  status: "success" | "failed",
  reason: string,
  failureReason?: string,
): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "STEP_PRECONDITION_CHECKED",
    status,
    reason,
    failureReason: failureReason ?? null,
    actionableMessage: status === "success"
      ? "Dispatch the governed step through Nerve Bus."
      : "Repair the blocking step gate before retrying this mission step.",
    ownerResponsible: "Orchestration",
    capabilityCallId: input.stepDispatchCallId,
  });
}

async function recordPostActionVerificationStarted(input: LoopIterationEventInput, step: OperationalStep): Promise<void> {
  if (step.targetAbilityGroupId !== "post-action-verification") {
    return;
  }

  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: "POST_ACTION_VERIFICATION_STARTED",
    status: "started",
    reason: `Dispatching post-action verification step "${step.stepId}" through governed transport.`,
    actionableMessage: "Wait for the governed verification result before evaluating the next transition.",
    ownerResponsible: "Orchestration / Post-action Verification",
    capabilityCallId: input.stepDispatchCallId,
    actionRef: resolveActionRef(input.state),
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
  await recordPostActionVerificationStarted(input, step);
}

function buildStepDispatchFailureEvent(step: OperationalStep): {
  eventType: "CAPABILITY_CALL_FAILED" | "POST_ACTION_VERIFICATION_FAILED";
  ownerResponsible: string;
  reason: string;
} {
  if (step.targetAbilityGroupId === "post-action-verification") {
    return {
      eventType: "POST_ACTION_VERIFICATION_FAILED",
      ownerResponsible: "Orchestration / Post-action Verification",
      reason: `Post-action verification step "${step.stepId}" failed before a governed result was returned.`,
    };
  }

  return {
    eventType: "CAPABILITY_CALL_FAILED",
    ownerResponsible: `Orchestration / ${step.targetAbilityGroupId ?? "orchestration"}`,
    reason: `Governed ability call for step "${step.stepId}" failed before transition evaluation.`,
  };
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
  });
}

function buildCapabilityEventType(step: OperationalStep, status: StepResultRecord["status"]) {
  if (step.targetAbilityGroupId === "post-action-verification") {
    if (status === "review_required") {
      return "POST_ACTION_VERIFICATION_REVIEW_REQUIRED" as const;
    }
    return status === "success" ? "POST_ACTION_VERIFICATION_PASSED" : "POST_ACTION_VERIFICATION_FAILED";
  }

  if (status === "review_required") {
    return "CAPABILITY_CALL_REVIEW_REQUIRED" as const;
  }
  return status === "success" ? "CAPABILITY_CALL_COMPLETED" : "CAPABILITY_CALL_FAILED";
}

export async function recordStepResult(
  input: LoopIterationEventInput,
  step: OperationalStep,
  lastResult: StepResultRecord,
  durationMs: number,
  actionLog: ActionLogRecord,
): Promise<void> {
  await recordMissionRuntimeEvent({
    context: input.context,
    state: input.state,
    mapRecord: input.mapRecord,
    step,
    eventType: buildCapabilityEventType(step, lastResult.status),
    status: lastResult.status,
    reason: `Governed step "${step.stepId}" returned status "${lastResult.status}".`,
    failureReason: lastResult.failureReason ?? null,
    reviewRequiredReason: lastResult.reviewRequiredReason ?? null,
    actionableMessage: lastResult.status === "success"
      ? "Evaluate the declared transition for this step result."
      : "Inspect the blocking step result and runtime proof before retrying.",
    ownerResponsible: step.targetAbilityGroupId === "post-action-verification"
      ? "Orchestration / Post-action Verification"
      : `Orchestration / ${step.targetAbilityGroupId ?? "orchestration"}`,
    durationMs,
    capabilityCallId: lastResult.envelopeId ?? input.stepDispatchCallId,
    outputRefs: collectLastResultRefs(lastResult),
    actionLogRefs: actionLog ? [actionLog.actionLogId] : [],
    actionRef: actionLog?.actionRef ?? null,
    postActionVerificationRef: actionLog?.postActionVerificationRef ?? null,
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
    eventType: "STEP_TRANSITION_SKIPPED",
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
  });
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
    status: outcome.state.status === "review_required"
      ? "review_required"
      : outcome.state.status === "failed"
        ? "failed"
        : "success",
    reason: `Mission reached terminal status "${outcome.state.status}" after step "${step.stepId}".`,
    failureReason: outcome.state.failureReason ?? null,
    reviewRequiredReason: outcome.state.reviewRequiredReason ?? null,
    actionableMessage: outcome.state.status === "failed"
      ? "Inspect the mission runtime proof and blocking step outcome before retrying."
      : outcome.state.status === "review_required"
        ? "Open Commander review flow and resolve the governed review requirement."
        : "Read the mission proof timeline and persisted records for the completed mission.",
    ownerResponsible: "Orchestration",
    capabilityCallId: outcome.lastResult?.envelopeId ?? input.stepDispatchCallId,
    proofRefs: [outcome.lastProof.proofId],
  });
}