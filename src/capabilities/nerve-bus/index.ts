/**
 * Nerve Bus — public entry point.
 * Export only the factory function, public types, and constants.
 */

export { createNerveBusAbilityGroup } from "./ability-group.js";
export { NERVE_BUS_ABILITY_GROUP_ID, NERVE_BUS_CHILD_IDS } from "./schema.js";
export type {
  NerveBusAbilityGroup,
  NerveBusHandlerPort,
  NerveBusHandledResult,
  CreateNerveBusAbilityGroupInput,
  AbilityCommandDispatchInput,
  AbilityDispatchResult,
  AiRequestDispatchInput,
  AiRequestDispatchResult,
  HumanCommandDispatchInput,
  HumanCommandDispatchResult,
  AbilityCommandEnvelope,
  AbilityResultEnvelope,
  AiRequestEnvelope,
  AiResponseEnvelope,
  HumanCommandEnvelope,
  HumanCommandResultEnvelope,
  NerveBusPayloadDocument,
} from "./contract.js";
