import type { z } from "zod";

import { NERVE_BUS_ABILITY_GROUP_ID } from "../schema.js";
import type {
  AbilityTargetIdSchema,
  CommanderTargetIdSchema,
  GovernedAbilityGroupIdSchema,
  NerveBusChannelIdSchema,
  RoutableExecutionTargetIdSchema,
} from "../schema.js";

export type NerveBusAbilityGroupId = typeof NERVE_BUS_ABILITY_GROUP_ID;
export type NerveBusChannelId = z.infer<typeof NerveBusChannelIdSchema>;
export type GovernedAbilityGroupId = z.infer<typeof GovernedAbilityGroupIdSchema>;
export type AbilityTargetId = z.infer<typeof AbilityTargetIdSchema>;
export type CommanderTargetId = z.infer<typeof CommanderTargetIdSchema>;
export type RoutableExecutionTargetId = z.infer<typeof RoutableExecutionTargetIdSchema>;