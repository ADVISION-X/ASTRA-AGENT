import { ORCHESTRATION_TO_AI_CHANNEL_ID } from "./implementation.js";

export function verifyOrchestrationToAiChannel(): void {
  if (ORCHESTRATION_TO_AI_CHANNEL_ID !== "orchestration-to-ai") {
    throw new Error("orchestration-to-ai channel metadata drift detected");
  }
}