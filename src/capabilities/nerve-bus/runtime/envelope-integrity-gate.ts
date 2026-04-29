import type { NerveBusClockPort } from "../ports/nerve-bus-clock-port.js";
import type { NerveBusChannelRegistryEntry } from "../shared/nerve-bus-policy.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";

export function enforceEnvelopeIntegrityGate<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
  clock: NerveBusClockPort;
}): { ok: true } | { ok: false; integrityDecision: "stale" | "expired" | "payload_ref_policy_failed"; reason: string } {
  const nowMs = new Date(input.clock.now().iso).getTime();
  const createdAtMs = new Date(input.envelope.createdAt).getTime();
  const expiresAtMs = new Date(input.envelope.expiresAt).getTime();

  if (Number.isNaN(createdAtMs) || Number.isNaN(expiresAtMs)) {
    return { ok: false, integrityDecision: "payload_ref_policy_failed", reason: "Envelope timestamps must be valid ISO datetimes." };
  }

  if ((nowMs - createdAtMs) > input.registryEntry.maxEnvelopeAgeMs) {
    return { ok: false, integrityDecision: "stale", reason: "Envelope exceeded the maximum transport age." };
  }

  if (input.registryEntry.requiresExpiry && nowMs > expiresAtMs) {
    return { ok: false, integrityDecision: "expired", reason: "Envelope expiry has passed." };
  }

  if (input.registryEntry.requiresPayloadRef && input.envelope.payloadRef.length === 0) {
    return { ok: false, integrityDecision: "payload_ref_policy_failed", reason: "Envelope must carry payloadRef-first transport references." };
  }

  return { ok: true };
}
