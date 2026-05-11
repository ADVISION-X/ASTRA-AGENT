/**
 * index.ts — Public API for the Open Ability Group.
 *
 * Only exports what callers need. No runtime internals exposed.
 */

export { createOpenAbilityGroup } from "./ability-group.js";
export type { OpenAbilityGroup, OpenAbilityGroupPorts } from "./ability-group.js";
export type { BrowserOpenPort, WorkbenchOpenPort } from "./browser-open-port.js";
export { resolveOpenTargetDefaultsForPlatform } from "./url-policy.js";
export {
  OPEN_ABILITY_GROUP_ID,
  OpenChildCapabilityIdSchema,
  OpenInputSchema,
  OpenResultSchema,
  type OpenChildCapabilityId,
  type OpenInput,
  type OpenResult,
  type OpenStatus,
  type OpenTargetUrlSource,
  type RawOpenObservation,
} from "./schema.js";
