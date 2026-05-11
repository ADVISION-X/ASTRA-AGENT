/**
 * Commander Console — Public API
 *
 * Exports:
 *   - createCommanderConsoleAbilityGroup (factory)
 *   - Types: CommanderConsoleAbilityGroup, CreateCommanderConsoleInput, CommanderMissionStatusView, CommanderConsoleResult
 *   - Schemas: CommanderEnvelopeSchema, CommanderProofSchema, CommanderMissionStatusViewSchema
 *   - Constants: COMMANDER_CONSOLE_ABILITY_GROUP_ID, COMMANDER_CHILD_CAPABILITY_IDS
 */

export { createCommanderConsoleAbilityGroup } from "./ability-group.js";
export { listCommanderChildren } from "./registry.js";

export type {
  CommanderConsoleAbilityGroup,
  CreateCommanderConsoleInput,
  CommanderConsoleResult,
  CommanderMissionStatusView,
  CommandTransportPort,
} from "./contract.js";

export {
  COMMANDER_CONSOLE_ABILITY_GROUP_ID,
  COMMANDER_CHILD_CAPABILITY_IDS,
  CommanderEnvelopeSchema,
  CommanderProofSchema,
  CommanderMissionStatusViewSchema,
  CommanderConsoleResultSchema,
  type CommanderEnvelope,
  type CommanderProof,
  type CommanderChildCapabilityId,
} from "./schema.js";
