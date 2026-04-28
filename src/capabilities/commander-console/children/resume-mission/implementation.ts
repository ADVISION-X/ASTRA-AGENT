import type { CommanderConsoleChildAbility } from "../../contract.js";

export const RESUME_MISSION_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "resume-mission",
  parentAbilityGroupId: "commander-console",
  displayName: "Resume Mission",
  purpose: "Issue a governed resume-mission human command.",
  currentStrength: "runnable",
};