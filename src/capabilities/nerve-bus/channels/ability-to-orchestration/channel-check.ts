import { ABILITY_TO_ORCHESTRATION_CHANNEL_ID } from "./implementation.js";

export function verifyAbilityToOrchestrationChannel(): void {
  if (ABILITY_TO_ORCHESTRATION_CHANNEL_ID !== "ability-to-orchestration") {
    throw new Error("ability-to-orchestration channel metadata drift detected");
  }
}