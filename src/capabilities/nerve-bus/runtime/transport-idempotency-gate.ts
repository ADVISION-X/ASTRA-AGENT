import type { NerveBusIdempotencyPort, NerveBusStoredTransportResult } from "../ports/nerve-bus-idempotency-port.js";

export async function enforceTransportIdempotencyGate(input: {
  idempotency: NerveBusIdempotencyPort;
  idempotencyKey: string;
}): Promise<
  | { ok: true; idempotencyDecision: "executed" }
  | { ok: false; idempotencyDecision: "duplicate_skipped"; cachedResult: NerveBusStoredTransportResult }
  | { ok: false; idempotencyDecision: "replay_rejected"; cachedResult: null; failureReason: string }
> {
  const existing = await input.idempotency.get(input.idempotencyKey);
  if (existing) {
    return { ok: false, idempotencyDecision: "duplicate_skipped", cachedResult: existing };
  }

  const reserved = await input.idempotency.reserve(input.idempotencyKey);
  if (reserved === "duplicate_cached") {
    const cachedResult = await input.idempotency.get(input.idempotencyKey);
    if (cachedResult) {
      return { ok: false, idempotencyDecision: "duplicate_skipped", cachedResult };
    }

    return {
      ok: false,
      idempotencyDecision: "replay_rejected",
      cachedResult: null,
      failureReason: "Idempotency store reported a cached duplicate without a governed stored result.",
    };
  }

  if (reserved === "duplicate_in_flight") {
    return {
      ok: false,
      idempotencyDecision: "replay_rejected",
      cachedResult: null,
      failureReason: "Transport idempotency key is already in flight.",
    };
  }

  return { ok: true, idempotencyDecision: "executed" };
}
