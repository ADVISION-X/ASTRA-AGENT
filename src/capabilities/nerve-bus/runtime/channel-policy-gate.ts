import type { NerveBusChannelRegistryEntry } from "../shared/nerve-bus-policy.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";

export function enforceChannelPolicyGate<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope>(input: {
  envelope: TEnvelope;
  registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.registryEntry.allowedFrom.includes(input.envelope.from)) {
    return { ok: false, reason: `Forbidden source ${input.envelope.from} for ${input.registryEntry.channelId}.` };
  }

  if (!input.registryEntry.allowedTo.includes(input.envelope.to)) {
    return { ok: false, reason: `Forbidden target ${input.envelope.to} for ${input.registryEntry.channelId}.` };
  }

  return { ok: true };
}
