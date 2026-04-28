import type { CommanderConsoleChildAbility } from "../../contract.js";

export const SHOW_OPERATIONAL_MAP_PROGRESS_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "show-operational-map-progress",
  parentAbilityGroupId: "commander-console",
  displayName: "Show Operational Map Progress",
  purpose: "Expose current mission progress as a read-only commander view.",
  currentStrength: "runnable",
};