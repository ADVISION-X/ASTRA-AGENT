import type { AiPromptContract, AiTaskType } from "../contract.js";
import type {
  PromptContractConfidencePolicy,
  PromptContractDebugPolicy,
  PromptContractFailurePolicy,
  PromptContractReviewPolicy,
} from "../prompt-contracts/policy-schema.js";

export type ResolvedAiPromptContract = AiPromptContract & {
  promptContractId: string;
  promptCatalogVersion: string;
  outputSchemaRef: string;
  requiredInputRefs: string[];
  allowedBranchFields: string[];
  prohibitedActions: string[];
  restrictedDataAccess: string[];
  confidencePolicy: PromptContractConfidencePolicy;
  reviewPolicy: PromptContractReviewPolicy;
  failurePolicy: PromptContractFailurePolicy;
  debugPolicy: PromptContractDebugPolicy;
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
