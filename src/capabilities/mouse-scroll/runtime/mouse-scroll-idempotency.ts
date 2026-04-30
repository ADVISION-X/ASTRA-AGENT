import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";

type ScrollReservation = {
  scrollExecutionRef: string;
  scopeKey: string;
  expiresAtMs: number;
};

export interface MouseScrollIdempotencyRegistry {
  cleanupExpired(nowMs: number): void;
  reserve(input: {
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    geometryGuardRef: string | null;
    purpose: string;
    direction: "up" | "down" | "left" | "right";
    magnitude: "small" | "halfPage" | "onePage" | "twoPages" | "customDelta";
    delta: { deltaX: number; deltaY: number };
    repeat: number;
    nowMs: number;
    allowReplay: boolean;
    cooldownMs: number;
    ttlMs: number;
  }):
    | { ok: true; idempotencyKey: string; scrollExecutionRef: string; idempotencyDecision: "reserved" }
    | {
        ok: false;
        idempotencyKey: string;
        scrollExecutionRef: string;
        status: "failed" | "review_required";
        failureReason: "duplicate_scroll_review_required" | "cooldown_blocked";
        reviewRequiredReason: string | null;
        statusMessage: string;
        policyDecision: "duplicate_review_required" | "block";
        rejectionRef: string;
        idempotencyDecision: "duplicate_review_required" | "cooldown_blocked";
        dataQualityFlags: string[];
      };
}

export function createMouseScrollIdempotencyRegistry(input?: { maxReservations?: number; maxScopeEntries?: number }): MouseScrollIdempotencyRegistry {
  const maxReservations = input?.maxReservations ?? 512;
  const maxScopeEntries = input?.maxScopeEntries ?? 64;
  const reservations = new Map<string, ScrollReservation>();
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
      const idempotencyKey = buildStableMouseScrollRef("mouse-scroll-idempotency", [
        input.sessionId,
        input.roundId,
        input.videoVisitId,
        input.geometryGuardRef,
        input.purpose,
        input.direction,
        input.magnitude,
        input.delta.deltaX,
        input.delta.deltaY,
        input.repeat,
      ]);
      const scrollExecutionRef = buildStableMouseScrollRef("mouse-scroll-action", [idempotencyKey]);
      const existing = reservations.get(idempotencyKey);
      if (existing && !input.allowReplay) {
        return {
          ok: false,
          idempotencyKey,
          scrollExecutionRef: existing.scrollExecutionRef,
          status: "review_required",
          failureReason: "duplicate_scroll_review_required",
          reviewRequiredReason: "Mouse Scroll blocked duplicate replay for the same idempotency key.",
          statusMessage: "Mouse Scroll replay blocked by idempotency guard.",
          policyDecision: "duplicate_review_required",
          rejectionRef: buildStableMouseScrollRef("mouse-scroll-rejection", [idempotencyKey, "duplicate"]),
          idempotencyDecision: "duplicate_review_required",
          dataQualityFlags: ["duplicate_scroll_review_required"],
        };
      }

      const scopeKey = `${input.sessionId}:${input.roundId ?? "no-round"}:${input.videoVisitId ?? "no-video"}`;
      const scopeExecutions = lastExecutionByScope.get(scopeKey) ?? [];
      const lastExecutionAt = scopeExecutions.at(-1);
      if (lastExecutionAt !== undefined && input.nowMs - lastExecutionAt < input.cooldownMs) {
        return {
          ok: false,
          idempotencyKey,
          scrollExecutionRef,
          status: "failed",
          failureReason: "cooldown_blocked",
          reviewRequiredReason: null,
          statusMessage: "Mouse Scroll cooldown window is still active.",
          policyDecision: "block",
          rejectionRef: buildStableMouseScrollRef("mouse-scroll-rejection", [idempotencyKey, "cooldown"]),
          idempotencyDecision: "cooldown_blocked",
          dataQualityFlags: ["cooldown_blocked"],
        };
      }

      reservations.set(idempotencyKey, {
        scrollExecutionRef,
        scopeKey,
        expiresAtMs: input.nowMs + input.ttlMs,
      });
      lastExecutionByScope.set(scopeKey, [...scopeExecutions, input.nowMs].slice(-maxScopeEntries));
      cleanupExpired(input.nowMs);
      return { ok: true, idempotencyKey, scrollExecutionRef, idempotencyDecision: "reserved" };
    },
  };
}