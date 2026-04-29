import type { NerveBusDispatchFailure } from "../shared/nerve-bus-failure.js";

export function createFailedTransportDispatch(reason: string, dataQualityFlags: string[] = []): NerveBusDispatchFailure {
  return {
    status: "failed",
    failureReason: reason,
    reviewRequiredReason: null,
    dataQualityFlags,
  };
}

export function createReviewRequiredTransportDispatch(reason: string, dataQualityFlags: string[] = []): NerveBusDispatchFailure {
  return {
    status: "review_required",
    failureReason: null,
    reviewRequiredReason: reason,
    dataQualityFlags,
  };
}

export function describeUnhandledTransportError(error: unknown): NerveBusDispatchFailure {
  return createFailedTransportDispatch(
    error instanceof Error ? error.message : "unknown nerve-bus transport failure",
    ["transport_unhandled_error"],
  );
}
