import type { CommanderConsoleChildAbility } from "../../contract.js";

export const SHOW_AUDIT_SUMMARY_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "show-audit-summary",
  parentAbilityGroupId: "commander-console",
  displayName: "Show Audit Summary",
  purpose: "Show generated audit summary data for the commander shell.",
  currentStrength: "runnable",
};