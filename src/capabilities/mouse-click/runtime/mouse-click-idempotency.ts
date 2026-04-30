import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";

type IdempotencyReservation = {
  actionExecutionRef: string;
  scopeKey: string;
  expiresAtMs: number;
};

export interface MouseClickIdempotencyRegistry {
  cleanupExpired(nowMs: number): void;
  reserve(input: {
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
  }):
    | { ok: true; idempotencyKey: string; actionExecutionRef: string; idempotencyDecision: "reserved" }
    | {
        ok: false;
        idempotencyKey: string;
        status: "failed" | "review_required";
        failureReason: "duplicate_click_review_required" | "cooldown_blocked";
        reviewRequiredReason: string | null;
        statusMessage: string;
        policyDecision: "duplicate_review_required" | "block";
        rejectionRef: string;
        idempotencyDecision: "duplicate_review_required" | "cooldown_blocked";
        dataQualityFlags: string[];
      };
}

export function createMouseClickIdempotencyRegistry(input?: { maxReservations?: number; maxScopeEntries?: number }): MouseClickIdempotencyRegistry {
  const maxReservations = input?.maxReservations ?? 512;
  const maxScopeEntries = input?.maxScopeEntries ?? 64;
  const reservations = new Map<string, IdempotencyReservation>();
  const lastExecutionByScope = new Map<string, Array<number>>();

  const cleanupExpired = (nowMs: number) => {
    for (const [key, reservation] of reservations.entries()) {
      if (reservation.expiresAtMs <= nowMs) {
        reservations.delete(key);
      }
    }

    for (const [scopeKey, timestamps] of lastExecutionByScope.entries()) {
      const nextTimestamps = timestamps.filter((timestamp) => nowMs - timestamp <= 60_000);
      if (nextTimestamps.length === 0) {
        lastExecutionByScope.delete(scopeKey);
        continue;
      }
      lastExecutionByScope.set(scopeKey, nextTimestamps.slice(-maxScopeEntries));
    }

    while (reservations.size > maxReservations) {
      const oldestKey = reservations.keys().next().value;
      if (!oldestKey) {
        break;
      }
      reservations.delete(oldestKey);
    }
  };

  return {
    cleanupExpired,
    reserve(input) {
      cleanupExpired(input.nowMs);
      const idempotencyKey = buildStableMouseClickRef("mouse-click-idempotency", [
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
      const actionExecutionRef = buildStableMouseClickRef("mouse-click-action", [idempotencyKey]);
      const existing = reservations.get(idempotencyKey);
      if (existing && !input.allowReplay) {
        return {
          ok: false,
          idempotencyKey,
          status: "review_required",
          failureReason: "duplicate_click_review_required",
          reviewRequiredReason: "Mouse Click blocked duplicate replay for the same idempotency key.",
          statusMessage: "Mouse Click replay blocked by idempotency guard.",
          policyDecision: "duplicate_review_required",
          rejectionRef: buildStableMouseClickRef("mouse-click-rejection", [idempotencyKey, "duplicate"]),
          idempotencyDecision: "duplicate_review_required",
          dataQualityFlags: ["duplicate_click_review_required"],
        };
      }

      const scopeKey = `${input.sessionId}:${input.roundId ?? "no-round"}:${input.videoVisitId ?? "no-visit"}`;
      const scopeExecutions = lastExecutionByScope.get(scopeKey) ?? [];
      const lastExecutionAt = scopeExecutions.at(-1);
      if (lastExecutionAt !== undefined && input.nowMs - lastExecutionAt < input.cooldownMs) {
        return {
          ok: false,
          idempotencyKey,
          status: "failed",
          failureReason: "cooldown_blocked",
          reviewRequiredReason: null,
          statusMessage: "Mouse Click cooldown window is still active.",
          policyDecision: "block",
          rejectionRef: buildStableMouseClickRef("mouse-click-rejection", [idempotencyKey, "cooldown"]),
          idempotencyDecision: "cooldown_blocked",
          dataQualityFlags: ["cooldown_blocked"],
        };
      }

      reservations.set(idempotencyKey, {
        actionExecutionRef,
        scopeKey,
        expiresAtMs: input.nowMs + input.ttlMs,
      });
      lastExecutionByScope.set(scopeKey, [...scopeExecutions, input.nowMs].slice(-maxScopeEntries));
      cleanupExpired(input.nowMs);
      return { ok: true, idempotencyKey, actionExecutionRef, idempotencyDecision: "reserved" };
    },
  };
}