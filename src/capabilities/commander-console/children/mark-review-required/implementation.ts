import type { CommanderConsoleChildAbility } from "../../contract.js";

export const MARK_REVIEW_REQUIRED_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "mark-review-required",
  parentAbilityGroupId: "commander-console",
  displayName: "Mark Review Required",
  purpose: "Issue a governed hold or review-required command for a candidate.",
  currentStrength: "runnable",
};