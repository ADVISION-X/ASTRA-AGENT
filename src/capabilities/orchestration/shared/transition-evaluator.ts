import type { AiResponseEnvelope, ResultEnvelope } from "../../nerve-bus/index.js";
import type { BranchResult } from "./branch-result.js";
import type { OperationalMap, OperationalMapStep, TransitionCondition } from "./map-types.js";

type TransitionEnvelope = ResultEnvelope | AiResponseEnvelope;

function readConditionValue(envelope: TransitionEnvelope, condition: TransitionCondition): unknown {
  if (condition.source === "status") {
    return envelope.status;
  }

  if (condition.source === "decision") {
    return "decision" in envelope ? envelope.decision : envelope.payload[condition.field];
  }

  return envelope.payload[condition.field];
}

function matchesCondition(envelope: TransitionEnvelope, condition: TransitionCondition): boolean {
  return readConditionValue(envelope, condition) === condition.equals;
}

export function evaluateStepTransition(
  map: OperationalMap,
  step: OperationalMapStep,
  envelope: TransitionEnvelope,
): BranchResult {
  const branchTaken = envelope.status === "review_required"
    ? "review"
    : envelope.status === "failed"
      ? "failure"
      : "success";
  const candidates = map.transitions.filter((transition) => transition.fromStepId === step.stepId && transition.outcome === branchTaken);
  const matched = candidates.find((transition) => matchesCondition(envelope, transition.condition)) ?? null;
  const fallbackNextStepId = branchTaken === "success"
    ? step.successNextStepId
    : branchTaken === "failure"
      ? step.failureNextStepId
      : step.reviewNextStepId;

  return {
    branchTaken,
    conditionEvaluated: matched
      ? `${matched.condition.source}.${matched.condition.field} == ${String(matched.condition.equals)}`
      : `${branchTaken}:fallback`,
    nextStepId: matched?.toStepId ?? fallbackNextStepId,
    status: matched?.finalStatus ?? (fallbackNextStepId ? "running" : branchTaken === "review" ? "review_required" : branchTaken === "failure" ? "failed" : "completed"),
    failureReason: envelope.failureReason,
  };
}