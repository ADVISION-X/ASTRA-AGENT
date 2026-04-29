import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";

type IdempotencyReservation = {
  actionExecutionRef: string;
  reservedAtMs: number;
};

export interface MouseClickIdempotencyRegistry {
  reserve(input: {
    sessionId: string;
    roundId: string | null;
    geometryGuardRef: string | null;
    purpose: string;
    coordinate: { x: number; y: number };
    button: "left" | "right";
    clickCount: 1 | 2;
    nowMs: number;
    allowReplay: boolean;
    cooldownMs: number;
  }):
    | { ok: true; idempotencyKey: string; actionExecutionRef: string }
    | {
        ok: false;
        idempotencyKey: string;
        actionExecutionRef: string;
        status: "failed" | "review_required";
        failureReason: "idempotency_replay_blocked" | "cooldown_active";
        reviewRequiredReason: string | null;
        statusMessage: string;
        policyDecision: "duplicate_skipped" | "block";
        dataQualityFlags: string[];
      };
}

export function createMouseClickIdempotencyRegistry(): MouseClickIdempotencyRegistry {
  const reservations = new Map<string, IdempotencyReservation>();
  const lastExecutionByScope = new Map<string, number>();

  return {
    reserve(input) {
      const idempotencyKey = buildStableMouseClickRef("mouse-click-idempotency", [
        input.sessionId,
        input.roundId,
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
          actionExecutionRef: existing.actionExecutionRef,
          status: "review_required",
          failureReason: "idempotency_replay_blocked",
          reviewRequiredReason: "Mouse Click blocked duplicate replay for the same idempotency key.",
          statusMessage: "Mouse Click replay blocked by idempotency guard.",
          policyDecision: "duplicate_skipped",
          dataQualityFlags: ["idempotency_replay_blocked"],
        };
      }

      const scopeKey = `${input.sessionId}:${input.roundId ?? "no-round"}`;
      const lastExecutionAt = lastExecutionByScope.get(scopeKey);
      if (lastExecutionAt !== undefined && input.nowMs - lastExecutionAt < input.cooldownMs) {
        return {
          ok: false,
          idempotencyKey,
          actionExecutionRef,
          status: "failed",
          failureReason: "cooldown_active",
          reviewRequiredReason: null,
          statusMessage: "Mouse Click cooldown window is still active.",
          policyDecision: "block",
          dataQualityFlags: ["cooldown_active"],
        };
      }

      reservations.set(idempotencyKey, { actionExecutionRef, reservedAtMs: input.nowMs });
      lastExecutionByScope.set(scopeKey, input.nowMs);
      return { ok: true, idempotencyKey, actionExecutionRef };
    },
  };
}