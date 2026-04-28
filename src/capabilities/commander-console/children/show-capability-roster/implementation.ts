import type { CommanderConsoleChildAbility } from "../../contract.js";

export const SHOW_CAPABILITY_ROSTER_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "show-capability-roster",
  parentAbilityGroupId: "commander-console",
  displayName: "Show Capability Roster",
  purpose: "Show active ability-group roster and current strength.",
  currentStrength: "runnable",
};