import type { AiPromptContract, AiTaskType } from "../contract.js";

export type ResolvedAiPromptContract = AiPromptContract & {
  promptContractId: string;
  outputSchemaRef: string;
  requiredInputRefs: string[];
  allowedBranchFields: string[];
  prohibitedActions: string[];
  restrictedDataAccess: string[];
  confidencePolicy: string;
  reviewPolicy: string;
  failurePolicy: string;
  debugPolicy: string;
  promptHash: string;
};

export interface AiPromptRegistryPort {
  resolvePromptContract(input: { promptContractId: string; taskType: AiTaskType }): ResolvedAiPromptContract;
  listPromptContracts(): ResolvedAiPromptContract[];
}
