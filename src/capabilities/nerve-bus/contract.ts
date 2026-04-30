import type { z } from "zod";

import {
  NERVE_BUS_ABILITY_GROUP_ID,
} from "./schema.js";
import type {
  AbilityCommandDispatchInputSchema,
  AbilityTargetIdSchema,
  AiRequestDispatchInputSchema,
  CommanderTargetIdSchema,
  GovernedAbilityGroupIdSchema,
  HumanCommandDispatchInputSchema,
  NerveBusChannelIdSchema,
  RoutableExecutionTargetIdSchema,
} from "./schema.js";
import type { AbilityTransportResult, AiTransportResult, HumanCommandTransportResult } from "./shared/nerve-bus-result.js";
import type { NerveBusHandlerPort } from "./ports/nerve-bus-handler-port.js";

export { NERVE_BUS_ABILITY_GROUP_ID };

export type NerveBusAbilityGroupId = typeof NERVE_BUS_ABILITY_GROUP_ID;
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
};

export interface NerveBusAbilityGroup {
  listChannelIds(): NerveBusChannelId[];
  dispatchHumanCommand(input: HumanCommandDispatchInput): Promise<HumanCommandTransportResult>;
  dispatchAbilityCommand(input: AbilityCommandDispatchInput): Promise<AbilityTransportResult>;
  requestAi(input: AiRequestDispatchInput): Promise<AiTransportResult>;
}
