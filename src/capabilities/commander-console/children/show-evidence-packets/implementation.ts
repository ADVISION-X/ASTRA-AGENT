import type { CommanderConsoleChildAbility } from "../../contract.js";

export const SHOW_EVIDENCE_PACKETS_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "show-evidence-packets",
  parentAbilityGroupId: "commander-console",
  displayName: "Show Evidence Packets",
  purpose: "List governed evidence packet summaries.",
  currentStrength: "runnable",
};