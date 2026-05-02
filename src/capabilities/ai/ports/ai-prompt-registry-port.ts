import type { AiPromptContract, AiTaskType } from "../contract.js";

export type ResolvedAiPromptContract = AiPromptContract & {
  promptContractId: string;
  promptCatalogVersion: string;
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

export type AiPromptRegistryFailureReason =
  | "unknown_prompt_contract"
  | "prompt_task_mismatch"
  | "prompt_catalog_integrity_failed";

export type AiPromptRegistryResolution =
  | { ok: true; contract: ResolvedAiPromptContract }
  | { ok: false; failureReason: AiPromptRegistryFailureReason; message: string };

export interface AiPromptRegistryPort {
  resolvePromptContract(input: { promptContractId: string; taskType: AiTaskType }): AiPromptRegistryResolution;
  listPromptContracts(): ResolvedAiPromptContract[];
}
