import type { OrchestrationIdempotencyPort } from "../ports/orchestration-idempotency-port.js";

type IdempotencyEntry = {
  key: string;
  status: "reserved" | "committed";
  reservedAt: number;
  expiresAt: number;
};

const DEFAULT_MAX_RESERVATIONS = 1000;

export function createInMemoryOrchestrationIdempotencyPort(maxReservations = DEFAULT_MAX_RESERVATIONS): OrchestrationIdempotencyPort {
  const entries = new Map<string, IdempotencyEntry>();

  return {
    async reserve(key, ttlMs) {
      const nowMs = Date.now();
      const existing = entries.get(key);
      if (existing) {
        if (existing.expiresAt > nowMs) {
          return { reserved: false, expiresAt: new Date(existing.expiresAt).toISOString() };
        }
        entries.delete(key);
      }
      if (entries.size >= maxReservations) {
        const count = await this.cleanupExpired(nowMs);
        if (count === 0 && entries.size >= maxReservations) {
          return { reserved: false, expiresAt: null };
        }
      }
      const expiresAt = nowMs + ttlMs;
      entries.set(key, { key, status: "reserved", reservedAt: nowMs, expiresAt });
      return { reserved: true, expiresAt: new Date(expiresAt).toISOString() };
    },

    async release(key) {
      entries.delete(key);
    },

    async commit(key) {
      const existing = entries.get(key);
      if (existing) {
        entries.set(key, { ...existing, status: "committed" });
      }
    },

    async cleanupExpired(nowMs) {
      let count = 0;
      for (const [key, entry] of entries) {
        if (entry.expiresAt <= nowMs) {
          entries.delete(key);
          count++;
        }
      }
      return count;
    },
  };
}
