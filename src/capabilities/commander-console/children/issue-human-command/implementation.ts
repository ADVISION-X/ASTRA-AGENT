import type { CommanderConsoleChildAbility } from "../../contract.js";

export const ISSUE_HUMAN_COMMAND_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "issue-human-command",
  parentAbilityGroupId: "commander-console",
  displayName: "Issue Human Command",
  purpose: "Accept governed operator commands and emit human command envelopes.",
  currentStrength: "runnable",
};