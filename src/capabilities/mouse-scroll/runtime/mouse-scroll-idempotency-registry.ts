import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";
import type {
  MouseScrollIdempotencyRegistry,
  MouseScrollIdempotencyReserveFailure,
  MouseScrollIdempotencyReserveInput,
  MouseScrollIdempotencyReserveResult,
} from "./mouse-scroll-idempotency-types.js";

type ScrollReservation = {
  scrollExecutionRef: string;
  scopeKey: string;
  expiresAtMs: number;
};

type MouseScrollIdempotencyState = {
  maxReservations: number;
  maxScopeEntries: number;
  reservations: Map<string, ScrollReservation>;
  lastExecutionByScope: Map<string, number[]>;
};

const SCOPE_WINDOW_MS = 60_000;

function trimScopeExecutions(state: MouseScrollIdempotencyState, nowMs: number, timestamps: number[]): number[] {
  return timestamps
    .filter((timestamp) => nowMs - timestamp <= SCOPE_WINDOW_MS)
    .slice(-state.maxScopeEntries);
}

function cleanupExpiredReservations(state: MouseScrollIdempotencyState, nowMs: number): void {
  for (const [key, reservation] of state.reservations.entries()) {
    if (reservation.expiresAtMs <= nowMs) {
      state.reservations.delete(key);
    }
  }
}

function cleanupExpiredScopeExecutions(state: MouseScrollIdempotencyState, nowMs: number): void {
  for (const [scopeKey, timestamps] of state.lastExecutionByScope.entries()) {
    const nextTimestamps = trimScopeExecutions(state, nowMs, timestamps);
    if (nextTimestamps.length === 0) {
      state.lastExecutionByScope.delete(scopeKey);
      continue;
    }
    state.lastExecutionByScope.set(scopeKey, nextTimestamps);
  }
}

function enforceReservationLimit(state: MouseScrollIdempotencyState): void {
  while (state.reservations.size > state.maxReservations) {
    const oldestKey = state.reservations.keys().next().value;
    if (!oldestKey) {
      return;
    }
    state.reservations.delete(oldestKey);
  }
}

function cleanupExpired(state: MouseScrollIdempotencyState, nowMs: number): void {
  cleanupExpiredReservations(state, nowMs);
  cleanupExpiredScopeExecutions(state, nowMs);
  enforceReservationLimit(state);
}

function buildIdempotencyKey(input: MouseScrollIdempotencyReserveInput): string {
  return buildStableMouseScrollRef("mouse-scroll-idempotency", [
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
}

function buildScopeKey(input: MouseScrollIdempotencyReserveInput): string {
  return `${input.sessionId}:${input.roundId ?? "no-round"}:${input.videoVisitId ?? "no-video"}`;
}

function buildDuplicateFailure(idempotencyKey: string, scrollExecutionRef: string): MouseScrollIdempotencyReserveFailure {
  return {
    ok: false,
    idempotencyKey,
    scrollExecutionRef,
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

function buildCooldownFailure(idempotencyKey: string, scrollExecutionRef: string): MouseScrollIdempotencyReserveFailure {
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

function reserveScrollExecution(state: MouseScrollIdempotencyState, input: MouseScrollIdempotencyReserveInput): MouseScrollIdempotencyReserveResult {
  cleanupExpired(state, input.nowMs);

  const idempotencyKey = buildIdempotencyKey(input);
  const scrollExecutionRef = buildStableMouseScrollRef("mouse-scroll-action", [idempotencyKey]);
  const existing = state.reservations.get(idempotencyKey);
  if (existing && !input.allowReplay) {
    return buildDuplicateFailure(idempotencyKey, existing.scrollExecutionRef);
  }

  const scopeKey = buildScopeKey(input);
  const scopeExecutions = state.lastExecutionByScope.get(scopeKey) ?? [];
  const lastExecutionAt = scopeExecutions.at(-1);
  if (lastExecutionAt !== undefined && input.nowMs - lastExecutionAt < input.cooldownMs) {
    return buildCooldownFailure(idempotencyKey, scrollExecutionRef);
  }

  state.reservations.set(idempotencyKey, {
    scrollExecutionRef,
    scopeKey,
    expiresAtMs: input.nowMs + input.ttlMs,
  });
  state.lastExecutionByScope.set(scopeKey, [...scopeExecutions, input.nowMs].slice(-state.maxScopeEntries));
  cleanupExpired(state, input.nowMs);
  return { ok: true, idempotencyKey, scrollExecutionRef, idempotencyDecision: "reserved" };
}

export function createMouseScrollIdempotencyRegistry(input?: { maxReservations?: number; maxScopeEntries?: number }): MouseScrollIdempotencyRegistry {
  const state: MouseScrollIdempotencyState = {
    maxReservations: input?.maxReservations ?? 512,
    maxScopeEntries: input?.maxScopeEntries ?? 64,
    reservations: new Map<string, ScrollReservation>(),
    lastExecutionByScope: new Map<string, number[]>(),
  };

  return {
    cleanupExpired: (nowMs) => cleanupExpired(state, nowMs),
    reserve: (reservationInput) => reserveScrollExecution(state, reservationInput),
  };
}