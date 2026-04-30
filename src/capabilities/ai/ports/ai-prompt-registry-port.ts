import type { AiPromptContract, AiTaskType } from "../contract.js";

export interface AiPromptRegistryPort {
  resolvePromptContract(input: { promptContractId: string; taskType: AiTaskType }): AiPromptContract;
  listPromptContracts(): AiPromptContract[];
}
