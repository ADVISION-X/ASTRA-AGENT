import type { OpenChildCapabilityId } from "../contract.js";

export type OpenIdempotencyReservation = {
  ok: boolean;
  status: "reserved" | "duplicate_skipped" | "already_on_target";
  idempotencyKey: string;
  reason: string | null;
};

export interface OpenIdempotencyPort {
  reserve(input: {
    sessionId: string;
    childCapabilityId: OpenChildCapabilityId;
    targetUrl: string;
    roundId: string | null;
    currentUrl: string;
    allowReplay: boolean;
  }): OpenIdempotencyReservation;
}