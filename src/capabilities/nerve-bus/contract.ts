import type { z } from "zod";

import type {
  AbilityCommandDispatchInputSchema,
  AbilityTargetIdSchema,
  AiRequestDispatchInputSchema,
  CommanderTargetIdSchema,
  GovernedAbilityGroupIdSchema,
  HumanCommandDispatchInputSchema,
  NerveBusAbilityGroupIdSchema,
  NerveBusChannelIdSchema,
  RoutableExecutionTargetIdSchema,
} from "./schema.js";
import type { AbilityTransportResult, AiTransportResult, HumanCommandTransportResult } from "./shared/nerve-bus-result.js";
import type { NerveBusHandlerPort } from "./ports/nerve-bus-handler-port.js";
import type { NerveBusClockPort } from "./ports/nerve-bus-clock-port.js";
import type { NerveBusTransportPort } from "./ports/nerve-bus-transport-port.js";
import type { NerveBusIdempotencyPort } from "./ports/nerve-bus-idempotency-port.js";
import type { NerveBusQueuePort } from "./ports/nerve-bus-queue-port.js";

export type NerveBusAbilityGroupId = z.infer<typeof NerveBusAbilityGroupIdSchema>;
export type NerveBusChannelId = z.infer<typeof NerveBusChannelIdSchema>;
export type GovernedAbilityGroupId = z.infer<typeof GovernedAbilityGroupIdSchema>;
export type AbilityTargetId = z.infer<typeof AbilityTargetIdSchema>;
export type CommanderTargetId = z.infer<typeof CommanderTargetIdSchema>;
export type RoutableExecutionTargetId = z.infer<typeof RoutableExecutionTargetIdSchema>;
export type AbilityCommandDispatchInput = z.infer<typeof AbilityCommandDispatchInputSchema>;
export type AiRequestDispatchInput = z.infer<typeof AiRequestDispatchInputSchema>;
export type HumanCommandDispatchInput = z.infer<typeof HumanCommandDispatchInputSchema>;

export type CreateNerveBusAbilityGroupInput = {
  handlerPort: NerveBusHandlerPort;
  clock?: NerveBusClockPort;
  transport?: NerveBusTransportPort;
  idempotency?: NerveBusIdempotencyPort;
  queue?: NerveBusQueuePort;
};

export interface NerveBusAbilityGroup {
  listChannelIds(): NerveBusChannelId[];
  dispatchHumanCommand(input: HumanCommandDispatchInput): Promise<HumanCommandTransportResult>;
  dispatchAbilityCommand(input: AbilityCommandDispatchInput): Promise<AbilityTransportResult>;
  requestAi(input: AiRequestDispatchInput): Promise<AiTransportResult>;
}
