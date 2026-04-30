import type { OpenChildCapabilityId } from "../contract.js";

export type OpenIdempotencyDecision =
  | "reserved"
  | "duplicate_review_required"
  | "already_on_target"
  | "scope_capacity_exceeded";

export type OpenIdempotencyReservation = {
  ok: boolean;
  decision: OpenIdempotencyDecision;
  idempotencyKey: string;
  reason: string | null;
  reservationExpiresAt: string | null;
  duplicateOpenReviewRequired: boolean;
  alreadyOnTargetDecision: "not_applicable" | "freshness_required";
};

export interface OpenIdempotencyPort {
  reserve(input: {
    sessionId: string;
    childCapabilityId: OpenChildCapabilityId;
    targetUrl: string;
    roundId: string | null;
    videoVisitId: string | null;
    currentUrl: string;
    allowReplay: boolean;
    nowIsoTimestamp: string;
    nowMonotonicMs: number;
    ttlMs: number;
    maxReservations: number;
  }): OpenIdempotencyReservation;
  commitSuccess(input: { idempotencyKey: string }): void;
  releaseOnFailure(input: { idempotencyKey: string }): void;
  cleanupExpired(input: { nowMonotonicMs: number }): void;
}