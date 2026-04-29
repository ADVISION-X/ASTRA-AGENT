import type { NerveBusTransportProof } from "../shared/nerve-bus-proof.js";
import type { AbilityTransportResult, AiTransportResult, HumanCommandTransportResult } from "../shared/nerve-bus-result.js";

export type NerveBusStoredTransportResult =
  | AbilityTransportResult
  | AiTransportResult
  | HumanCommandTransportResult;

export interface NerveBusIdempotencyPort {
  get(key: string): Promise<NerveBusStoredTransportResult | null>;
  reserve(key: string): Promise<"reserved" | "duplicate">;
  commit(key: string, result: NerveBusStoredTransportResult): Promise<void>;
  release(key: string): Promise<void>;
}

export function createInMemoryNerveBusIdempotencyPort(): NerveBusIdempotencyPort {
  const inFlight = new Set<string>();
  const results = new Map<string, NerveBusStoredTransportResult>();

  return {
    async get(key) {
      return results.get(key) ?? null;
    },
    async reserve(key) {
      if (results.has(key) || inFlight.has(key)) {
        return "duplicate";
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
