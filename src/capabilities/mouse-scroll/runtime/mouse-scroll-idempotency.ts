import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";

type ScrollReservation = {
  scrollExecutionRef: string;
  reservedAtMs: number;
};

export interface MouseScrollIdempotencyRegistry {
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
  }):
    | { ok: true; idempotencyKey: string; scrollExecutionRef: string }
    | {
        ok: false;
        idempotencyKey: string;
        scrollExecutionRef: string;
        status: "failed" | "review_required";
        failureReason: "idempotency_replay_blocked" | "cooldown_active";
        reviewRequiredReason: string | null;
        statusMessage: string;
        policyDecision: "duplicate_skipped" | "block";
        dataQualityFlags: string[];
      };
}

export function createMouseScrollIdempotencyRegistry(): MouseScrollIdempotencyRegistry {
  const reservations = new Map<string, ScrollReservation>();
  const lastExecutionByScope = new Map<string, number>();

  return {
    reserve(input) {
      const idempotencyKey = buildStableMouseScrollRef("mouse-scroll-idempotency", [
        input.sessionId,
        input.roundId,
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
          failureReason: "idempotency_replay_blocked",
          reviewRequiredReason: "Mouse Scroll blocked duplicate replay for the same idempotency key.",
          statusMessage: "Mouse Scroll replay blocked by idempotency guard.",
          policyDecision: "duplicate_skipped",
          dataQualityFlags: ["idempotency_replay_blocked"],
        };
      }

      const scopeKey = `${input.sessionId}:${input.roundId ?? "no-round"}:${input.videoVisitId ?? "no-video"}`;
      const lastExecutionAt = lastExecutionByScope.get(scopeKey);
      if (lastExecutionAt !== undefined && input.nowMs - lastExecutionAt < input.cooldownMs) {
        return {
          ok: false,
          idempotencyKey,
          scrollExecutionRef,
          status: "failed",
          failureReason: "cooldown_active",
          reviewRequiredReason: null,
          statusMessage: "Mouse Scroll cooldown window is still active.",
          policyDecision: "block",
          dataQualityFlags: ["cooldown_active"],
        };
      }

      reservations.set(idempotencyKey, { scrollExecutionRef, reservedAtMs: input.nowMs });
      lastExecutionByScope.set(scopeKey, input.nowMs);
      return { ok: true, idempotencyKey, scrollExecutionRef };
    },
  };
}