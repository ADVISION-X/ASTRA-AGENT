import type { PageStateAbilityInput } from "../schema.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

const MAX_OBSERVATIONS = 50;
const MAX_EVIDENCE_REFS = 50;
const MAX_TAGS = 20;
const MAX_DETAIL_LENGTH = 1000;
const MAX_SUMMARY_LENGTH = 1000;
const MAX_SUPPORTING_REASONS = 20;

export function gatePageStatePayloadBudget(request: PageStateAbilityInput):
  | { ok: true; payloadBudgetDecision: "allow" }
  | { ok: false; payloadBudgetDecision: "fail"; failure: PageStateGateFailure } {
  if (request.observations.length > MAX_OBSERVATIONS || request.sourceEvidenceRefs.length > MAX_EVIDENCE_REFS) {
    return createBudgetFailure("Page State payload exceeded the governed observation or evidence budget.");
  }

  for (const observation of request.observations) {
    if ("tags" in observation.payload && observation.payload.tags.length > MAX_TAGS) {
      return createBudgetFailure(`Observation ${observation.observationId} exceeded the platform-capture tag budget.`);
    }

    if ("detail" in observation.payload && typeof observation.payload.detail === "string" && observation.payload.detail.length > MAX_DETAIL_LENGTH) {
      return createBudgetFailure(`Observation ${observation.observationId} exceeded the detail budget.`);
    }

    if ("summary" in observation.payload && observation.payload.summary.length > MAX_SUMMARY_LENGTH) {
      return createBudgetFailure(`Observation ${observation.observationId} exceeded the summary budget.`);
    }
  }

  return { ok: true, payloadBudgetDecision: "allow" };
}

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