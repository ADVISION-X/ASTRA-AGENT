import type { CommanderConsoleChildAbility } from "../../contract.js";

export const INSPECT_RECORD_DETAIL_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "inspect-record-detail",
  parentAbilityGroupId: "commander-console",
  displayName: "Inspect Record Detail",
  purpose: "Inspect a governed record detail view without mutating runtime truth.",
  currentStrength: "runnable",
};