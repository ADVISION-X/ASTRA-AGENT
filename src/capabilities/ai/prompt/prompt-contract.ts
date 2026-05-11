import type { AiPromptContractCatalogEntry } from "../contract.js";

const VISUAL_MISSION_JUDGE_PROMPT_CONTRACT: AiPromptContractCatalogEntry = {
  promptContractId: "visual-mission-judge-v1",
  promptContractVersion: "v1",
  promptCatalogVersion: "ai.prompt-catalog.v1",
  taskType: "visual_mission_judgment",
  outputSchemaRef: "ai.visual_mission_judgment.v1",
  requiredInputRefs: [
    "userRequirementRef",
    "originalScreenshotRef",
    "coordinateGridScreenshotRef",
    "gridSpecRef",
    "platformContextRef",
    "systemManualRef",
    "outputSchemaRef",
  ],
  timeoutMs: 60_000,
};

export { VISUAL_MISSION_JUDGE_PROMPT_CONTRACT };