import type { CommanderConsoleChildAbility } from "../../contract.js";

export const PAUSE_MISSION_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "pause-mission",
  parentAbilityGroupId: "commander-console",
  displayName: "Pause Mission",
  purpose: "Issue a governed pause-mission human command.",
  currentStrength: "runnable",
};