import { createHash } from "node:crypto";

import type { OpenIdempotencyPort, OpenIdempotencyReservation } from "../ports/open-idempotency-port.js";
import { normalizeOpenUrl } from "../shared/open-url.js";

type ReservationRecord = {
  expiresAtMonotonicMs: number;
  targetUrl: string;
};

type OpenIdempotencyReserveInput = {
  sessionId: string;
  childCapabilityId: string;
  targetUrl: string;
  roundId: string | null;
  videoVisitId: string | null;
  currentUrl: string;
  allowReplay: boolean;
  nowMonotonicMs: number;
  ttlMs: number;
  maxReservations: number;
};

function normalizeKeyPart(input: string | null): string {
  return (input ?? "null").trim().toLowerCase();
}

function normalizeUrlForKey(url: string): string {
  try {
    return normalizeOpenUrl(url).toString();
  } catch {
    return url.trim();
  }
}

export function buildOpenIdempotencyKey(input: {
  sessionId: string;
  childCapabilityId: string;
  targetUrl: string;
  roundId: string | null;
  videoVisitId: string | null;
}): string {
  const seed = [
    normalizeKeyPart(input.sessionId),
    normalizeKeyPart(input.childCapabilityId),
    normalizeKeyPart(input.targetUrl),
    normalizeKeyPart(input.roundId),
    normalizeKeyPart(input.videoVisitId),
  ].join("|");

  return `open-idempotency:${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
}

function createReservation(input: {
  ok: boolean;
  decision: OpenIdempotencyReservation["decision"];
  idempotencyKey: string;
  reason: string | null;
  reservationExpiresAt: string | null;
  duplicateOpenReviewRequired: boolean;
  alreadyOnTargetDecision: OpenIdempotencyReservation["alreadyOnTargetDecision"];
}): OpenIdempotencyReservation {
  return input;
}

function buildAlreadyOnTargetReservation(idempotencyKey: string): OpenIdempotencyReservation {
  return createReservation({
    ok: true,
    decision: "already_on_target",
    idempotencyKey,
    reason: "browser session is already on the governed target url",
    reservationExpiresAt: null,
    duplicateOpenReviewRequired: false,
    alreadyOnTargetDecision: "freshness_required",
  });
}

function buildDuplicateReviewRequiredReservation(idempotencyKey: string): OpenIdempotencyReservation {
  return createReservation({
    ok: false,
    decision: "duplicate_review_required",
    idempotencyKey,
    reason: "duplicate open request blocked by governed idempotency policy",
    reservationExpiresAt: null,
    duplicateOpenReviewRequired: true,
    alreadyOnTargetDecision: "not_applicable",
  });
}

function buildScopeCapacityExceededReservation(idempotencyKey: string): OpenIdempotencyReservation {
  return createReservation({
    ok: false,
    decision: "scope_capacity_exceeded",
    idempotencyKey,
    reason: "open idempotency reservation capacity exceeded",
    reservationExpiresAt: null,
    duplicateOpenReviewRequired: true,
    alreadyOnTargetDecision: "not_applicable",
  });
}

function buildReservedReservation(idempotencyKey: string): OpenIdempotencyReservation {
  return createReservation({
    ok: true,
    decision: "reserved",
    idempotencyKey,
    reason: null,
    reservationExpiresAt: null,
    duplicateOpenReviewRequired: false,
    alreadyOnTargetDecision: "not_applicable",
  });
}

function reserveOpenIdempotency(input: {
  reservations: Map<string, ReservationRecord>;
  request: OpenIdempotencyReserveInput;
}): OpenIdempotencyReservation {
  const normalizedTargetUrl = normalizeUrlForKey(input.request.targetUrl);
  const normalizedCurrentUrl = normalizeUrlForKey(input.request.currentUrl);
  const idempotencyKey = buildOpenIdempotencyKey({
    sessionId: input.request.sessionId,
    childCapabilityId: input.request.childCapabilityId,
    targetUrl: normalizedTargetUrl,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
  });

  if (normalizedCurrentUrl === normalizedTargetUrl) {
    return buildAlreadyOnTargetReservation(idempotencyKey);
  }

  if (input.reservations.has(idempotencyKey) && !input.request.allowReplay) {
    return buildDuplicateReviewRequiredReservation(idempotencyKey);
  }

  if (input.reservations.size >= input.request.maxReservations) {
    return buildScopeCapacityExceededReservation(idempotencyKey);
  }

  input.reservations.set(idempotencyKey, {
    expiresAtMonotonicMs: input.request.nowMonotonicMs + input.request.ttlMs,
    targetUrl: normalizedTargetUrl,
  });

  return buildReservedReservation(idempotencyKey);
}

export function createInMemoryOpenIdempotencyPort(): OpenIdempotencyPort {
  const reservations = new Map<string, ReservationRecord>();

  return {
    reserve(input) {
      this.cleanupExpired({ nowMonotonicMs: input.nowMonotonicMs });
      return reserveOpenIdempotency({ reservations, request: input });
    },
    commitSuccess(_input) {},
    releaseOnFailure(input) {
      reservations.delete(input.idempotencyKey);
    },
    cleanupExpired(input) {
      for (const [key, reservation] of reservations.entries()) {
        if (reservation.expiresAtMonotonicMs <= input.nowMonotonicMs) {
          reservations.delete(key);
        }
      }
    },
  };
}