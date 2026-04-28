import type { CommanderConsoleChildAbility } from "../../contract.js";

export const SHOW_FAILED_RECORDS_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "show-failed-records",
  parentAbilityGroupId: "commander-console",
  displayName: "Show Failed Records",
  purpose: "List governed failed and review-required record summaries.",
  currentStrength: "runnable",
};