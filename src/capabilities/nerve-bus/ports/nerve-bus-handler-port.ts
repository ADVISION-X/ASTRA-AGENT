import type { AbilityCommandEnvelope, AbilityResultEnvelope, AiRequestEnvelope, AiResponseEnvelope, HumanCommandEnvelope, HumanCommandResultEnvelope } from "../shared/nerve-bus-envelope.js";
import type { NerveBusPayloadDocument } from "./nerve-bus-transport-port.js";

export type NerveBusHandledResult<TEnvelope> = {
  envelope: TEnvelope;
  outputPayload: NerveBusPayloadDocument | null;
};

export interface NerveBusHandlerPort {
  dispatchAbilityCommand(input: { envelope: AbilityCommandEnvelope; inputPayload: NerveBusPayloadDocument; signal: AbortSignal }): Promise<NerveBusHandledResult<AbilityResultEnvelope> | null>;
  requestAi(input: { envelope: AiRequestEnvelope; inputPayload: NerveBusPayloadDocument; signal: AbortSignal }): Promise<NerveBusHandledResult<AiResponseEnvelope> | null>;
  dispatchHumanCommand(input: { envelope: HumanCommandEnvelope; inputPayload: NerveBusPayloadDocument; signal: AbortSignal }): Promise<NerveBusHandledResult<HumanCommandResultEnvelope> | null>;
}
