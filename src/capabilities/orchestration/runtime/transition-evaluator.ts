import type { z } from "zod";

import type { RuntimePlan } from "../contract.js";
import { MissionStepResultSchema } from "../schema.js";
import { getEffectiveOperationalTransitions } from "./route-plan-resolver.js";

export type TransitionEvaluationDecision =
  | "matched"
  | "no_valid_transition"
  | "ambiguous_transition"
  | "invalid_decision";

export type TransitionEvaluationResult =
  | { decision: "matched"; transition: RuntimePlan["transitions"][number] }
  | { decision: Exclude<TransitionEvaluationDecision, "matched">; failureReason: string };

type MissionStepResultRecord = z.output<typeof MissionStepResultSchema>;

const TIKTOK_URL_DRIFT_RECOVERY_REASON = "tiktok_url_drift_reopen_entry";
const TIKTOK_URL_DRIFT_RECOVERY_STEPS = new Set([
  "capture-startup-video-viewport",
  "capture-current-video-viewport",
]);

const normalizeDecisionToken = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/gu, "");

const readDecisionToken = (result: MissionStepResultRecord): string | null => {
  const taskDecision = result.branchFieldValues.taskDecision;
  if (typeof taskDecision === "string" && taskDecision.length > 0) {
    return taskDecision;
  }

  const pageStateDecision = result.branchFieldValues.pageStateDecision;
  if (typeof pageStateDecision === "string" && pageStateDecision.length > 0) {
    return pageStateDecision;
  }

  const decision = result.branchFieldValues.decision;
  return typeof decision === "string" && decision.length > 0 ? decision : null;
};

const transitionMatchesDecisionToken = (
  transition: RuntimePlan["transitions"][number],
  decisionToken: string,
): boolean => {
  const routeToken = transition.transitionId.split(":").pop() ?? transition.transitionId;
  return normalizeDecisionToken(decisionToken) === normalizeDecisionToken(routeToken);
};

const findMatchingStatusTransitions = (input: {
  map: RuntimePlan;
  currentStepId: string;
  result: MissionStepResultRecord;
}): RuntimePlan["transitions"] =>
  getEffectiveOperationalTransitions(input.map).filter((candidate) =>
    candidate.fromStepId === input.currentStepId
    && candidate.onStatus === input.result.status,
  );

const filterByDecisionToken = (input: {
  candidates: RuntimePlan["transitions"];
  result: MissionStepResultRecord;
}): TransitionEvaluationResult | { decision: "candidates"; candidates: RuntimePlan["transitions"] } => {
  if (input.candidates.length <= 1) {
    return { decision: "candidates", candidates: input.candidates };
  }

  const decisionToken = readDecisionToken(input.result);
  if (!decisionToken) {
    return {
      decision: "invalid_decision",
      failureReason: `Step "${input.result.stepId}" matched multiple transitions but did not provide branchFieldValues.taskDecision, branchFieldValues.pageStateDecision, or branchFieldValues.decision.`,
    };
  }

  const routeMatches = input.candidates.filter((candidate) =>
    transitionMatchesDecisionToken(candidate, decisionToken),
  );
  if (routeMatches.length === 0) {
    return {
      decision: "invalid_decision",
      failureReason: `Step "${input.result.stepId}" returned decision token "${decisionToken}" but no transition suffix matched it.`,
    };
  }

  return { decision: "candidates", candidates: routeMatches };
};

const buildNoValidTransitionFailure = (mapId: string, currentStepId: string, status: string): string =>
  `Map "${mapId}" has no matching transition from step "${currentStepId}" for status "${status}".`;

const buildAmbiguousTransitionFailure = (mapId: string, currentStepId: string, transitions: RuntimePlan["transitions"]): string => {
  const ids = transitions.map((t) => t.transitionId).join(", ");
  return `Map "${mapId}" step "${currentStepId}" matched ${transitions.length} transitions: [${ids}]. Exactly one must match.`;
};

function resolveSyntheticTikTokUrlDriftRecovery(input: {
  map: RuntimePlan;
  currentStepId: string;
  result: MissionStepResultRecord;
}): TransitionEvaluationResult | null {
  if (input.result.status !== "review_required") {
    return null;
  }

  if (input.result.failureReason !== TIKTOK_URL_DRIFT_RECOVERY_REASON && input.result.reviewRequiredReason !== TIKTOK_URL_DRIFT_RECOVERY_REASON) {
    return null;
  }

  if (input.result.targetAbilityGroupId !== "screenshot") {
    return null;
  }

  if (!input.map.mapId.includes("tiktok") || !TIKTOK_URL_DRIFT_RECOVERY_STEPS.has(input.currentStepId)) {
    return null;
  }

  return {
    decision: "matched",
    transition: {
      transitionId: `${input.currentStepId}:tiktok-url-drift-recovery`,
      fromStepId: input.currentStepId,
      onStatus: "review_required",
      toStepId: input.map.initialStepId,
      finalStatus: null,
    },
  };
}

const selectSingleTransition = (input: {
  map: RuntimePlan;
  currentStepId: string;
  candidates: RuntimePlan["transitions"];
  status: string;
}): TransitionEvaluationResult => {
  if (input.candidates.length === 0) {
    return {
      decision: "no_valid_transition",
      failureReason: buildNoValidTransitionFailure(input.map.mapId, input.currentStepId, input.status),
    };
  }

  if (input.candidates.length > 1) {
    return {
      decision: "ambiguous_transition",
      failureReason: buildAmbiguousTransitionFailure(input.map.mapId, input.currentStepId, input.candidates),
    };
  }

  return { decision: "matched", transition: input.candidates[0]! };
};

export function evaluateStepTransition(input: {
  map: RuntimePlan;
  currentStepId: string;
  result: MissionStepResultRecord;
}): TransitionEvaluationResult {
  const syntheticRecovery = resolveSyntheticTikTokUrlDriftRecovery(input);
  if (syntheticRecovery) {
    return syntheticRecovery;
  }

  const routeFiltered = filterByDecisionToken({
    candidates: findMatchingStatusTransitions(input),
    result: input.result,
  });
  if (routeFiltered.decision !== "candidates") {
    return routeFiltered;
  }
  return selectSingleTransition({
    map: input.map,
    currentStepId: input.currentStepId,
    candidates: routeFiltered.candidates,
    status: input.result.status,
  });
}
