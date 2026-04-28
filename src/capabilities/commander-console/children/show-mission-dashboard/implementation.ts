import type { CommanderConsoleChildAbility } from "../../contract.js";

export const SHOW_MISSION_DASHBOARD_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "show-mission-dashboard",
  parentAbilityGroupId: "commander-console",
  displayName: "Show Mission Dashboard",
  purpose: "Render the commander dashboard from governed read models.",
  currentStrength: "runnable",
};