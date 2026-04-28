import { ORCHESTRATION_TO_ABILITY_CHANNEL_ID } from "./implementation.js";

export function verifyOrchestrationToAbilityChannel(): void {
  if (ORCHESTRATION_TO_ABILITY_CHANNEL_ID !== "orchestration-to-ability") {
    throw new Error("orchestration-to-ability channel metadata drift detected");
  }
}