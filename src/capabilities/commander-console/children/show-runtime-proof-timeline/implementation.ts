import type { CommanderConsoleChildAbility } from "../../contract.js";

export const SHOW_RUNTIME_PROOF_TIMELINE_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "show-runtime-proof-timeline",
  parentAbilityGroupId: "commander-console",
  displayName: "Show Runtime Proof Timeline",
  purpose: "Read runtime proof entries for operator inspection.",
  currentStrength: "runnable",
};