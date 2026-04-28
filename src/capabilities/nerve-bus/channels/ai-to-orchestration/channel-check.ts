import { AI_TO_ORCHESTRATION_CHANNEL_ID } from "./implementation.js";

export function verifyAiToOrchestrationChannel(): void {
  if (AI_TO_ORCHESTRATION_CHANNEL_ID !== "ai-to-orchestration") {
    throw new Error("ai-to-orchestration channel metadata drift detected");
  }
}