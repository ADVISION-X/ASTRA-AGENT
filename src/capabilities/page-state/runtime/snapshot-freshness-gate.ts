import type { PageStateAbilityInput } from "../schema.js";
import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

type FreshnessFailure = {
  decision: "fail" | "review_required";
  failureReason: string;
  stateSummary: string;
  dataQualityFlag: string;
};

function createFreshnessFailure(decision: "fail" | "review_required", failureReason: string, stateSummary: string, dataQualityFlag: string): { ok: false; freshnessDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  return {
    ok: false,
    freshnessDecision: decision,
    failure: {
      status: decision === "fail" ? "failed" : "review_required",
      decision,
      failureReason,
      stateSummary,
      reviewRequiredReason: decision === "fail" ? null : stateSummary,
      pageStateType: "unknown_page",
      confidence: 0,
      dataQualityFlags: [dataQualityFlag],
    },
  };
}

function resolveSnapshotFreshnessFailure(input: {
  request: PageStateAbilityInput;
  clock: PageStateClockPort;
}): FreshnessFailure | null {
  const now = input.clock.now();
  const snapshotReading = input.clock.fromIsoString(input.request.snapshot.capturedAt);
  if (!snapshotReading) {
    return {
      decision: "fail",
      failureReason: "invalid_snapshot",
      stateSummary: "Page State snapshot timestamp is invalid.",
      dataQualityFlag: "stale_snapshot",
    };
  }

  return null;
}

function resolveObservationFreshnessFailure(input: {
  request: PageStateAbilityInput;
  clock: PageStateClockPort;
  snapshotReadingEpochMs: number;
  now: ReturnType<PageStateClockPort["now"]>;
}): FreshnessFailure | null {
  if (input.clock.durationMs(input.clock.fromIsoString(input.request.snapshot.capturedAt)!, input.now) > input.request.freshnessPolicy.maxSnapshotAgeMs) {
    return {
      decision: "review_required",
      failureReason: "snapshot_stale",
      stateSummary: "Page State snapshot is stale and cannot support continued execution.",
      dataQualityFlag: "stale_snapshot",
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
      decision: "review_required",
      failureReason: "observation_stale",
      stateSummary: `Observation ${staleObservation.observationId} is stale relative to the current snapshot.`,
      dataQualityFlag: "stale_observation",
    };
  }

  return null;
}

function resolveFreshnessFailure(input: {
  request: PageStateAbilityInput;
  clock: PageStateClockPort;
}): FreshnessFailure | null {
  const now = input.clock.now();
  const snapshotReading = input.clock.fromIsoString(input.request.snapshot.capturedAt);
  if (!snapshotReading) {
    return {
      decision: "fail",
      failureReason: "invalid_snapshot",
      stateSummary: "Page State snapshot timestamp is invalid.",
      dataQualityFlag: "stale_snapshot",
    };
  }

  if (input.clock.durationMs(snapshotReading, now) > input.request.freshnessPolicy.maxSnapshotAgeMs) {
    return {
      decision: "review_required",
      failureReason: "snapshot_stale",
      stateSummary: "Page State snapshot is stale and cannot support continued execution.",
      dataQualityFlag: "stale_snapshot",
    };
  }

  const observationFailure = resolveObservationFreshnessFailure({
    request: input.request,
    clock: input.clock,
    snapshotReadingEpochMs: snapshotReading.epochMs,
    now,
  });
  if (observationFailure) {
    return observationFailure;
  }

  return null;
}

export function gateSnapshotFreshness(input: {
  request: PageStateAbilityInput;
  clock: PageStateClockPort;
}):
  | { ok: true; freshnessDecision: "fresh" }
  | { ok: false; freshnessDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  const failure = resolveFreshnessFailure(input);
  if (failure) {
    return createFreshnessFailure(failure.decision, failure.failureReason, failure.stateSummary, failure.dataQualityFlag);
  }

  return { ok: true, freshnessDecision: "fresh" };
}