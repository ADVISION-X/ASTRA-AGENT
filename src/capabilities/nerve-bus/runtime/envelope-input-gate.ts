import type { NerveBusChannelRegistryEntry } from "../shared/nerve-bus-policy.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";

export function enforceEnvelopeInputGate<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
}): { ok: true } | { ok: false; integrityDecision: "missing_payload_ref" | "missing_input_ref"; reason: string } {
  if (input.registryEntry.requiresPayloadRef && input.envelope.payloadRef.length === 0) {
    return { ok: false, integrityDecision: "missing_payload_ref", reason: "payloadRef is required by channel policy." };
  }

  if (!input.envelope.inputRef.trim()) {
    return { ok: false, integrityDecision: "missing_input_ref", reason: "inputRef is required by channel policy." };
  }

  return { ok: true };
}
