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
import type { NerveBusRunnerOutcome } from "../runtime/transport-runner.js";
import type { NerveBusRuntimeContext } from "../runtime/transport-context.js";

export type ForwardTransportEnvelope = AbilityCommandEnvelope | AiRequestEnvelope | HumanCommandEnvelope;
export type MirroredTransportEnvelope = AbilityResultEnvelope | AiResponseEnvelope | HumanCommandResultEnvelope;
export type SupportedEnvelope = ForwardTransportEnvelope | MirroredTransportEnvelope;
export type SupportedTransportEnvelope = SupportedEnvelope;
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
    signal?: AbortSignal | undefined;
  }): Promise<NerveBusRunnerOutcome<TResult>>;
};
