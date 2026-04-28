import type { CommanderConsoleChildAbility } from "../../contract.js";

export const REJECT_CANDIDATE_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "reject-candidate",
  parentAbilityGroupId: "commander-console",
  displayName: "Reject Candidate",
  purpose: "Issue a governed candidate rejection command.",
  currentStrength: "runnable",
};