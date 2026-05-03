import type { z } from "zod";

import {
  NERVE_BUS_ABILITY_GROUP_ID,
  AbilityCommandDispatchInputSchema,
  AbilityResultDispatchInputSchema,
  AiRequestDispatchInputSchema,
  AiResponseDispatchInputSchema,
  CommanderMessageDispatchInputSchema,
  HumanCommandDispatchInputSchema,
  NerveBusTransportInputSchema,
} from "./schema.js";
import type {
  AbilityTransportResult,
  AiTransportResult,
  HumanCommandTransportResult,
  NerveBusMirroredTransportResult,
  NerveBusTransportResult,
} from "./shared/nerve-bus-result.js";
import type { NerveBusChannelId } from "./shared/nerve-bus-routing-types.js";
import type { NerveBusHandledResult } from "./ports/nerve-bus-handler-port.js";

type AbilityCommandDispatchInput = z.infer<typeof AbilityCommandDispatchInputSchema>;
type AbilityResultDispatchInput = z.infer<typeof AbilityResultDispatchInputSchema>;
type AiRequestDispatchInput = z.infer<typeof AiRequestDispatchInputSchema>;
type AiResponseDispatchInput = z.infer<typeof AiResponseDispatchInputSchema>;
type CommanderMessageDispatchInput = z.infer<typeof CommanderMessageDispatchInputSchema>;
type HumanCommandDispatchInput = z.infer<typeof HumanCommandDispatchInputSchema>;
type NerveBusTransportInput = z.infer<typeof NerveBusTransportInputSchema>;
type NerveBusClockPort = import("./ports/nerve-bus-clock-port.js").NerveBusClockPort;
type NerveBusHandlerPort = import("./ports/nerve-bus-handler-port.js").NerveBusHandlerPort;
type NerveBusIdempotencyPort = import("./ports/nerve-bus-idempotency-port.js").NerveBusIdempotencyPort;
type NerveBusPayloadDocument = import("./ports/nerve-bus-transport-port.js").NerveBusPayloadDocument;
type NerveBusQueuePort = import("./ports/nerve-bus-queue-port.js").NerveBusQueuePort;
type NerveBusSequencePort = import("./ports/nerve-bus-sequence-port.js").NerveBusSequencePort;
type NerveBusTransportPort = import("./ports/nerve-bus-transport-port.js").NerveBusTransportPort;

type CreateNerveBusAbilityGroupInput = {
  handlerPort: NerveBusHandlerPort;
  clockPort?: NerveBusClockPort;
  transportPort?: NerveBusTransportPort;
  idempotencyPort?: NerveBusIdempotencyPort;
  queuePort?: NerveBusQueuePort;
  sequencePort?: NerveBusSequencePort;
};

interface NerveBusAbilityGroup {
  listChannelIds(): NerveBusChannelId[];
  transportEnvelope(input: NerveBusTransportInput): Promise<NerveBusTransportResult>;
  dispatchHumanCommand(input: HumanCommandDispatchInput): Promise<HumanCommandTransportResult>;
  dispatchAbilityCommand(input: AbilityCommandDispatchInput): Promise<AbilityTransportResult>;
  dispatchAbilityResult(input: AbilityResultDispatchInput): Promise<NerveBusMirroredTransportResult>;
  requestAi(input: AiRequestDispatchInput): Promise<AiTransportResult>;
  dispatchAiResponse(input: AiResponseDispatchInput): Promise<NerveBusMirroredTransportResult>;
  dispatchCommanderMessage(input: CommanderMessageDispatchInput): Promise<NerveBusMirroredTransportResult>;
}

export { NERVE_BUS_ABILITY_GROUP_ID };

export type {
  AbilityCommandDispatchInput,
  AbilityResultDispatchInput,
  AiRequestDispatchInput,
  AiResponseDispatchInput,
  CommanderMessageDispatchInput,
  HumanCommandDispatchInput,
  NerveBusTransportInput,
  CreateNerveBusAbilityGroupInput,
  NerveBusAbilityGroup,
  NerveBusClockPort,
  NerveBusHandledResult,
  NerveBusHandlerPort,
  NerveBusIdempotencyPort,
  NerveBusPayloadDocument,
  NerveBusQueuePort,
  NerveBusSequencePort,
  NerveBusTransportPort,
};
