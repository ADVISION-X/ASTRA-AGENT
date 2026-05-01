import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";
import type { MouseClickIdempotencyRegistry } from "./mouse-click-idempotency-port.js";
import { buildCooldownFailure, buildDuplicateReplayFailure, buildIdempotencyKey, cleanupReservations } from "./mouse-click-idempotency-support.js";

type IdempotencyReservation = {
  actionExecutionRef: string;
  scopeKey: string;
  expiresAtMs: number;
};

export function createMouseClickIdempotencyRegistry(input?: { maxReservations?: number; maxScopeEntries?: number }): MouseClickIdempotencyRegistry {
  const maxReservations = input?.maxReservations ?? 512;
  const maxScopeEntries = input?.maxScopeEntries ?? 64;
  const reservations = new Map<string, IdempotencyReservation>();
  const lastExecutionByScope = new Map<string, Array<number>>();

  const cleanupExpired = (nowMs: number) => cleanupReservations({ nowMs, maxReservations, maxScopeEntries, reservations, lastExecutionByScope });

  return {
    cleanupExpired,
    reserve(input) {
      cleanupExpired(input.nowMs);
      const idempotencyKey = buildIdempotencyKey(input);
      const actionExecutionRef = buildStableMouseClickRef("mouse-click-action", [idempotencyKey]);
      const existing = reservations.get(idempotencyKey);
      if (existing && !input.allowReplay) {
        return buildDuplicateReplayFailure(idempotencyKey);
      }

      const scopeKey = `${input.sessionId}:${input.roundId ?? "no-round"}:${input.videoVisitId ?? "no-visit"}`;
      const scopeExecutions = lastExecutionByScope.get(scopeKey) ?? [];
      const lastExecutionAt = scopeExecutions.at(-1);
      if (lastExecutionAt !== undefined && input.nowMs - lastExecutionAt < input.cooldownMs) {
        return buildCooldownFailure(idempotencyKey);
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