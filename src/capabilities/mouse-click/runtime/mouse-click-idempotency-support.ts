import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";

export type IdempotencyReservation = {
  actionExecutionRef: string;
  scopeKey: string;
  expiresAtMs: number;
};

export type MouseClickIdempotencyReserveInput = {
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  geometryGuardRef: string | null;
  purpose: string;
  coordinate: { x: number; y: number };
  button: "left" | "right";
  clickCount: 1 | 2;
  nowMs: number;
  allowReplay: boolean;
  cooldownMs: number;
  ttlMs: number;
};

export function buildIdempotencyKey(input: MouseClickIdempotencyReserveInput) {
  return buildStableMouseClickRef("mouse-click-idempotency", [
    input.sessionId,
    input.roundId,
    input.videoVisitId,
    input.geometryGuardRef,
    input.purpose,
    input.coordinate.x,
    input.coordinate.y,
    input.button,
    input.clickCount,
  ]);
}

export function buildDuplicateReplayFailure(idempotencyKey: string) {
  return {
    ok: false as const,
    idempotencyKey,
    status: "review_required" as const,
    failureReason: "duplicate_click_review_required" as const,
    reviewRequiredReason: "Mouse Click blocked duplicate replay for the same idempotency key.",
    statusMessage: "Mouse Click replay blocked by idempotency guard.",
    policyDecision: "duplicate_review_required" as const,
    rejectionRef: buildStableMouseClickRef("mouse-click-rejection", [idempotencyKey, "duplicate"]),
    idempotencyDecision: "duplicate_review_required" as const,
    dataQualityFlags: ["duplicate_click_review_required"],
  };
}

export function buildCooldownFailure(idempotencyKey: string) {
  return {
    ok: false as const,
    idempotencyKey,
    status: "failed" as const,
    failureReason: "cooldown_blocked" as const,
    reviewRequiredReason: null,
    statusMessage: "Mouse Click cooldown window is still active.",
    policyDecision: "block" as const,
    rejectionRef: buildStableMouseClickRef("mouse-click-rejection", [idempotencyKey, "cooldown"]),
    idempotencyDecision: "cooldown_blocked" as const,
    dataQualityFlags: ["cooldown_blocked"],
  };
}

export function cleanupReservations(input: {
  nowMs: number;
  maxReservations: number;
  maxScopeEntries: number;
  reservations: Map<string, IdempotencyReservation>;
  lastExecutionByScope: Map<string, Array<number>>;
}) {
  for (const [key, reservation] of input.reservations.entries()) {
    if (reservation.expiresAtMs <= input.nowMs) {
      input.reservations.delete(key);
    }
  }

  for (const [scopeKey, timestamps] of input.lastExecutionByScope.entries()) {
    const nextTimestamps = timestamps.filter((timestamp) => input.nowMs - timestamp <= 60_000);
    if (nextTimestamps.length === 0) {
      input.lastExecutionByScope.delete(scopeKey);
      continue;
    }
    input.lastExecutionByScope.set(scopeKey, nextTimestamps.slice(-input.maxScopeEntries));
  }

  while (input.reservations.size > input.maxReservations) {
    const oldestKey = input.reservations.keys().next().value;
    if (!oldestKey) {
      break;
    }
    input.reservations.delete(oldestKey);
  }
}