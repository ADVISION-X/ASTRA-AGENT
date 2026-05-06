import type { OrchestrationLoopProofContext } from "./orchestration-loop-proof-builders.js";
import { dispatchOperationalStep } from "./step-dispatcher.js";

type OrchestrationStepResultRecord = Extract<Awaited<ReturnType<typeof dispatchOperationalStep>>, { dispatched: true }>["stepResult"];

type MatchedTransitionInput = Extract<
  ReturnType<typeof import("./transition-evaluator.js").evaluateStepTransition>,
  { decision: "matched" }
>["transition"];

type MatchedTransitionRecord = {
  transitionId: string;
  finalStatus: "running" | "completed" | "stopped" | "review_required" | "failed";
  toStepId: string | null;
  condition: {
    leftRef: string;
    operator: "equals" | "notEquals" | "exists" | "notExists" | "greaterThan" | "lessThan" | "confidenceAbove" | "confidenceBelow" | "statusIs" | "reviewRequired";
    rightValue: string | number | boolean | null;
  };
};

type HandleDispatchedStepDetails = {
  currentProofContext: OrchestrationLoopProofContext;
  currentStepId: string;
  durationMs: number;
  endedSnapshot: { isoTimestamp: string; monotonicMs: number };
  lastResult: OrchestrationStepResultRecord;
  loopGuardNextHopCount: number;
  startedSnapshot: { isoTimestamp: string; monotonicMs: number };
  stateHashBefore: string | null;
  stateRevisionBefore: number;
  stepDispatchCallId: string;
  stepIdempotencyKey: string;
};

const normalizeMatchedTransition = (transition: MatchedTransitionInput): MatchedTransitionRecord => ({
  transitionId: transition.transitionId,
  finalStatus: transition.finalStatus ?? "running",
  toStepId: transition.toStepId,
  condition: {
    leftRef: transition.condition.leftRef,
    operator: transition.condition.operator,
    rightValue: transition.condition.rightValue,
  },
});

const buildTransitionFailureDetails = (
  details: HandleDispatchedStepDetails,
  transitionResult: Exclude<ReturnType<typeof import("./transition-evaluator.js").evaluateStepTransition>, { decision: "matched" }>,
) => ({
  currentStepId: details.currentStepId,
  stepDispatchCallId: details.stepDispatchCallId,
  lastResult: details.lastResult,
  transitionEvaluationDecision: transitionResult.decision,
  stateRevisionBefore: details.stateRevisionBefore,
  stateHashBefore: details.stateHashBefore,
  proofContext: details.currentProofContext,
  startedAt: details.startedSnapshot.isoTimestamp,
  endedAt: details.endedSnapshot.isoTimestamp,
  failureReason: transitionResult.failureReason,
});

const buildTransitionSuccessDetails = (
  details: HandleDispatchedStepDetails,
  transition: MatchedTransitionInput,
) => ({
  currentStepId: details.currentStepId,
  stepDispatchCallId: details.stepDispatchCallId,
  stepIdempotencyKey: details.stepIdempotencyKey,
  startedAt: details.startedSnapshot.isoTimestamp,
  endedAt: details.endedSnapshot.isoTimestamp,
  lastResult: details.lastResult,
  transition: normalizeMatchedTransition(transition),
  stateRevisionBefore: details.stateRevisionBefore,
  stateHashBefore: details.stateHashBefore,
  nextHopCount: details.loopGuardNextHopCount,
  startedMonotonicMs: details.startedSnapshot.monotonicMs,
  endedMonotonicMs: details.endedSnapshot.monotonicMs,
});

export type {
  HandleDispatchedStepDetails,
  MatchedTransitionRecord,
};

export {
  buildTransitionFailureDetails,
  buildTransitionSuccessDetails,
};