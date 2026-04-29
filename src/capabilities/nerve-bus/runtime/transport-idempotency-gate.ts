import type { NerveBusIdempotencyPort, NerveBusStoredTransportResult } from "../ports/nerve-bus-idempotency-port.js";

export async function enforceTransportIdempotencyGate(input: {
  idempotency: NerveBusIdempotencyPort;
  idempotencyKey: string;
}): Promise<
  | { ok: true; idempotencyDecision: "executed" }
  | { ok: false; idempotencyDecision: "duplicate_skipped"; cachedResult: NerveBusStoredTransportResult | null }
> {
  const existing = await input.idempotency.get(input.idempotencyKey);
  if (existing) {
    return { ok: false, idempotencyDecision: "duplicate_skipped", cachedResult: existing };
  }

  const reserved = await input.idempotency.reserve(input.idempotencyKey);
  if (reserved === "duplicate") {
    return { ok: false, idempotencyDecision: "duplicate_skipped", cachedResult: await input.idempotency.get(input.idempotencyKey) };
  }

  return { ok: true, idempotencyDecision: "executed" };
}
