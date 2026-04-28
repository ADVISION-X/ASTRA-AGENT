import type { CommanderConsoleChildAbility } from "../../contract.js";

export const SHOW_BROWSE_LEDGER_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "show-browse-ledger",
  parentAbilityGroupId: "commander-console",
  displayName: "Show Browse Ledger",
  purpose: "List governed browse ledger summaries.",
  currentStrength: "runnable",
};