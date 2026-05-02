import type { NerveBusIdempotencyPort, NerveBusStoredTransportResult } from "../ports/nerve-bus-idempotency-port.js";

export function createInMemoryNerveBusIdempotencyPort(): NerveBusIdempotencyPort {
  const inFlight = new Set<string>();
  const results = new Map<string, NerveBusStoredTransportResult>();

  return {
    async get(key) {
      return results.get(key) ?? null;
    },
    async reserve(key) {
      if (results.has(key)) {
        return "duplicate_cached";
      }
      if (inFlight.has(key)) {
        return "duplicate_in_flight";
      }
      inFlight.add(key);
      return "reserved";
    },
    async commit(key, result) {
      inFlight.delete(key);
      results.set(key, result);
    },
    async release(key) {
      inFlight.delete(key);
    },
  };
}