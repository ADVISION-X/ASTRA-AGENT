import type { AiPromptContract, AiTaskType } from "../contract.js";

export interface AiPromptRegistryPort {
  resolvePromptContract(taskType: AiTaskType): AiPromptContract;
  listPromptContracts(): AiPromptContract[];
}
