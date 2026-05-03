import type { AbilityTransportResult, AiTransportResult, HumanCommandTransportResult, NerveBusMirroredTransportResult } from "../shared/nerve-bus-result.js";

export type NerveBusStoredTransportResult =
  | AbilityTransportResult
  | AiTransportResult
  | HumanCommandTransportResult
  | NerveBusMirroredTransportResult;

export type NerveBusIdempotencyReservation = "reserved" | "duplicate_cached" | "duplicate_in_flight";

export interface NerveBusIdempotencyPort {
  get(key: string): Promise<NerveBusStoredTransportResult | null>;
  reserve(key: string): Promise<NerveBusIdempotencyReservation>;
  commit(key: string, result: NerveBusStoredTransportResult): Promise<void>;
  release(key: string): Promise<void>;
}
