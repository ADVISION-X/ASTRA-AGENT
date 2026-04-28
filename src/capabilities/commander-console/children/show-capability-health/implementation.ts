import type { CommanderConsoleChildAbility } from "../../contract.js";

export const SHOW_CAPABILITY_HEALTH_CHILD: CommanderConsoleChildAbility = {
  childAbilityId: "show-capability-health",
  parentAbilityGroupId: "commander-console",
  displayName: "Show Capability Health",
  purpose: "Display current health summaries for the governed runtime surfaces.",
  currentStrength: "runnable",
};