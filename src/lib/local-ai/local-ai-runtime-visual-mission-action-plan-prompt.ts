import { buildVisualMissionActionPlanPromptParts } from "../../capabilities/ai/prompt-contracts/visual-mission-action-plan/index.js";

export function buildLocalAiVisualMissionActionPlanPromptParts(
  input: Parameters<typeof buildVisualMissionActionPlanPromptParts>[0],
) {
  return buildVisualMissionActionPlanPromptParts(input);
}