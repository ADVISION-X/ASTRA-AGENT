import type { CommanderConsoleChildAbility } from "../../contract.js";

export const EMERGENCY_STOP_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "emergency-stop",
  parentAbilityGroupId: "commander-console",
  displayName: "Emergency Stop",
  purpose: "Issue a governed emergency-stop human command.",
  currentStrength: "runnable",
};