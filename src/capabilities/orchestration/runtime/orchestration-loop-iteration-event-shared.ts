import type { MissionState } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import type { OperationalStep } from "./step-dispatch-shared.js";

type StepResultRecord = {
  status: "success" | "failed" | "review_required";
  envelopeId?: string | null;
  resultRef?: string | null;
  outputRef?: string | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  branchFieldValues: Record<string, string | number | boolean | null>;
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
  const diagnosticRefs = [
    "implementationStatus",
    "runtimeCallId",
    "rawOutputRef",
    "rawOutputHash",
    "diagnosticPayloadRef",
    "schemaIssueCount",
    "qualityDecision",
    "outputBoundaryDecision",
  ]
    .map((key) => {
      const value = lastResult.branchFieldValues[key];
      return value !== null && value !== undefined && String(value).length > 0 ? `${key}=${String(value)}` : null;
    })
    .filter((value): value is string => Boolean(value));

  return [
    ...(lastResult.resultRef ? [lastResult.resultRef] : []),
    ...(lastResult.outputRef ? [lastResult.outputRef] : []),
    ...diagnosticRefs,
  ];
}

function resolvePayloadRefValue(payloadRefs: MissionState["payloadRefs"], key: string): string | null {
  const payloadKey = key as keyof MissionState["payloadRefs"];
  const value = payloadRefs[payloadKey];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function resolveActionRef(state: MissionState): string | null {
  return resolvePayloadRefValue(state.payloadRefs, "actionResultRef")
    ?? resolvePayloadRefValue(state.payloadRefs, "textInputResultRef")
    ?? resolvePayloadRefValue(state.payloadRefs, "scrollResultRef")
    ?? resolvePayloadRefValue(state.payloadRefs, "abilityResultRef")
    ?? state.lastResultRef
    ?? null;
}

function buildStepDispatchFailureEvent(step: OperationalStep) {
  if (step.targetAbilityGroupId === "post-action-verification") {
    return {
      eventType: "POST_ACTION_VERIFICATION_FAILED" as const,
      ownerResponsible: "Orchestration / Post-action Verification",
      reason: `Post-action verification step "${step.stepId}" failed before a governed result was returned.`,
    };
  }

  return {
    eventType: "CAPABILITY_CALL_FAILED" as const,
    ownerResponsible: `Orchestration / ${step.targetAbilityGroupId ?? "orchestration"}`,
    reason: `Governed ability call for step "${step.stepId}" failed before transition evaluation.`,
  };
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

export {
  buildCapabilityEventType,
  buildStepDispatchFailureEvent,
  collectLastResultRefs,
  getTerminalEventType,
  resolveActionRef,
};

export type {
  ActionLogRecord,
  LoopIterationEventInput,
  LoopTerminalOutcome,
  StepResultRecord,
};
