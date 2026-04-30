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
