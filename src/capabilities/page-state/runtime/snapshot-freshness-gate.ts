import type { PageStateAbilityInput } from "../schema.js";
import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

export function gateSnapshotFreshness(input: {
  request: PageStateAbilityInput;
  clock: PageStateClockPort;
}):
  | { ok: true; freshnessDecision: "fresh" }
  | { ok: false; freshnessDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  const now = input.clock.now();
  const snapshotReading = input.clock.fromIsoString(input.request.snapshot.capturedAt);
  if (!snapshotReading) {
    return {
      ok: false,
      freshnessDecision: "fail",
      failure: {
        status: "failed",
        decision: "fail",
        failureReason: "invalid_snapshot",
        stateSummary: "Page State snapshot timestamp is invalid.",
        reviewRequiredReason: null,
        pageStateType: "unknown_page",
        confidence: 0,
        dataQualityFlags: ["stale_snapshot"],
      },
    };
  }

  if (input.clock.durationMs(snapshotReading, now) > input.request.freshnessPolicy.maxSnapshotAgeMs) {
    return {
      ok: false,
      freshnessDecision: "review_required",
      failure: {
        status: "review_required",
        decision: "review_required",
        failureReason: "snapshot_stale",
        stateSummary: "Page State snapshot is stale and cannot support continued execution.",
        reviewRequiredReason: "Review required because the latest snapshot is older than the freshness policy allows.",
        pageStateType: "unknown_page",
        confidence: 0,
        dataQualityFlags: ["stale_snapshot"],
      },
    };
  }

  const staleObservation = input.request.observations.find((observation) => {
    const observationReading = input.clock.fromIsoString(observation.capturedAt);
    if (!observationReading) {
      return true;
    }

    const observationAgeMs = input.clock.durationMs(observationReading, now);
    const skewMs = Math.abs(observationReading.epochMs - snapshotReading.epochMs);
    return observationAgeMs > input.request.freshnessPolicy.maxObservationAgeMs
      || skewMs > input.request.freshnessPolicy.maxObservationSkewMs;
  });

  if (staleObservation) {
    return {
      ok: false,
      freshnessDecision: "review_required",
      failure: {
        status: "review_required",
        decision: "review_required",
        failureReason: "observation_stale",
        stateSummary: `Observation ${staleObservation.observationId} is stale relative to the current snapshot.`,
        reviewRequiredReason: "Review required because governed observations are outside the freshness window.",
        pageStateType: "unknown_page",
        confidence: 0,
        dataQualityFlags: ["stale_observation"],
      },
    };
  }

  return { ok: true, freshnessDecision: "fresh" };
}