import type { CommanderConsoleChildAbility } from "../../contract.js";

export const APPROVE_CANDIDATE_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "approve-candidate",
  parentAbilityGroupId: "commander-console",
  displayName: "Approve Candidate",
  purpose: "Issue a governed candidate approval command.",
  currentStrength: "runnable",
};