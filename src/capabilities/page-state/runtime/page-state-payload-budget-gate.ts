import type { PageStateAbilityInput } from "../schema.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

const MAX_OBSERVATIONS = 50;
const MAX_EVIDENCE_REFS = 50;
const MAX_TAGS = 20;
const MAX_DETAIL_LENGTH = 1000;
const MAX_SUMMARY_LENGTH = 1000;
const MAX_SUPPORTING_REASONS = 20;

function createBudgetFailure(stateSummary: string): { ok: false; payloadBudgetDecision: "fail"; failure: PageStateGateFailure } {
  return {
    ok: false,
    payloadBudgetDecision: "fail",
    failure: {
      status: "failed",
      decision: "fail",
      failureReason: "payload_budget_exceeded",
      stateSummary,
      reviewRequiredReason: null,
      pageStateType: "unknown_page",
      confidence: 0,
      dataQualityFlags: ["payload_budget_exceeded"],
    },
  };
}

function resolveObservationPayloadBudgetFailure(observation: PageStateAbilityInput["observations"][number]): string | null {
  if ("tags" in observation.payload && observation.payload.tags.length > MAX_TAGS) {
    return `Observation ${observation.observationId} exceeded the platform-capture tag budget.`;
  }

  if ("detail" in observation.payload && typeof observation.payload.detail === "string" && observation.payload.detail.length > MAX_DETAIL_LENGTH) {
    return `Observation ${observation.observationId} exceeded the detail budget.`;
  }

  if ("summary" in observation.payload && observation.payload.summary.length > MAX_SUMMARY_LENGTH) {
    return `Observation ${observation.observationId} exceeded the summary budget.`;
  }

  return null;
}

function resolvePageStatePayloadBudgetFailure(request: PageStateAbilityInput): string | null {
  if (request.observations.length > MAX_OBSERVATIONS || request.sourceEvidenceRefs.length > MAX_EVIDENCE_REFS) {
    return "Page State payload exceeded the governed observation or evidence budget.";
  }

  for (const observation of request.observations) {
    const observationFailure = resolveObservationPayloadBudgetFailure(observation);
    if (observationFailure) {
      return observationFailure;
    }
  }

  return null;
}

export function gatePageStatePayloadBudget(request: PageStateAbilityInput):
  | { ok: true; payloadBudgetDecision: "allow" }
  | { ok: false; payloadBudgetDecision: "fail"; failure: PageStateGateFailure } {
  const failureReason = resolvePageStatePayloadBudgetFailure(request);
  if (failureReason) {
    return createBudgetFailure(failureReason);
  }

  return { ok: true, payloadBudgetDecision: "allow" };
}