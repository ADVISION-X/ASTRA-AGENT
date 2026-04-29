import type { ZodType } from "zod";

import type {
  NerveBusChannelRegistryEntry,
} from "./nerve-bus-policy.js";
import type {
  AbilityCommandEnvelope,
  AiRequestEnvelope,
  HumanCommandEnvelope,
} from "./nerve-bus-envelope.js";
import type {
  AbilityResultEnvelope,
  AiResponseEnvelope,
  HumanCommandResultEnvelope,
} from "./nerve-bus-envelope.js";
import type { NerveBusPayloadDocument } from "../ports/nerve-bus-transport-port.js";
import type { NerveBusRuntimeContext, NerveBusRunnerOutcome } from "../runtime/transport-runner.js";

export type SupportedEnvelope = AbilityCommandEnvelope | AiRequestEnvelope | HumanCommandEnvelope;
export type SupportedTransportEnvelope = SupportedEnvelope | AbilityResultEnvelope | AiResponseEnvelope | HumanCommandResultEnvelope;
export type SupportedResultEnvelope = AbilityResultEnvelope | AiResponseEnvelope | HumanCommandResultEnvelope;

export type NerveBusChildDefinition<TEnvelope extends SupportedTransportEnvelope, TResult extends SupportedResultEnvelope> = {
  childCapabilityId: NerveBusChannelRegistryEntry<TEnvelope, TResult>["childCapabilityId"];
  channelId: NerveBusChannelRegistryEntry<TEnvelope, TResult>["channelId"];
  inputSchema: ZodType<unknown>;
  outputSchema: ZodType<unknown>;
  execute(input: {
    envelope: TEnvelope;
    inputPayload: NerveBusPayloadDocument;
    registryEntry: NerveBusChannelRegistryEntry<TEnvelope, TResult>;
    context: NerveBusRuntimeContext;
  }): Promise<NerveBusRunnerOutcome<TResult>>;
};
