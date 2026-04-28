import type { CommanderConsoleChildAbility } from "../../contract.js";

export const SHOW_REVIEW_QUEUE_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "show-review-queue",
  parentAbilityGroupId: "commander-console",
  displayName: "Show Review Queue",
  purpose: "Expose pending operator review items as read-only queue entries.",
  currentStrength: "runnable",
};