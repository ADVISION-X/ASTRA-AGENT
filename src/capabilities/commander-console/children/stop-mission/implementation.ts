import type { CommanderConsoleChildAbility } from "../../contract.js";

export const STOP_MISSION_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "stop-mission",
  parentAbilityGroupId: "commander-console",
  displayName: "Stop Mission",
  purpose: "Issue a governed stop-mission human command.",
  currentStrength: "runnable",
};