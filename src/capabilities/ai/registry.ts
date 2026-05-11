import type { AiPromptContractCatalogEntry } from "./contract.js";
import { VISUAL_MISSION_JUDGE_PROMPT_CONTRACT } from "./prompt/prompt-contract.js";

const AI_CAPABILITY_ID = "ai" as const;
const AI_CHILD_CAPABILITY_ID = "visual-mission-judge-once" as const;
const PROMPT_CONTRACT_CATALOG_VERSION = VISUAL_MISSION_JUDGE_PROMPT_CONTRACT.promptCatalogVersion;

const AI_PROMPT_CONTRACTS: readonly AiPromptContractCatalogEntry[] = [VISUAL_MISSION_JUDGE_PROMPT_CONTRACT];

const listPromptContractCatalogEntries = () => [...AI_PROMPT_CONTRACTS];

const findAiPromptContractCatalogEntry = (promptContractId: string) =>
  AI_PROMPT_CONTRACTS.find((entry) => entry.promptContractId === promptContractId) ?? null;

const getPromptContractCatalogIntegrity = () => {
  const ids = new Set<string>();

  for (const entry of AI_PROMPT_CONTRACTS) {
    if (ids.has(entry.promptContractId)) {
      return {
        ok: false as const,
        message: `Duplicate prompt contract id: ${entry.promptContractId}`,
      };
    }
    ids.add(entry.promptContractId);
  }

  return {
    ok: AI_PROMPT_CONTRACTS.length === 1,
    message: AI_PROMPT_CONTRACTS.length === 1
      ? "single governed prompt contract active"
      : "AI prompt catalog must contain exactly one active contract.",
  };
};

const resolveAiDispatchTimeoutMs = (taskType: string) =>
  taskType === VISUAL_MISSION_JUDGE_PROMPT_CONTRACT.taskType
    ? VISUAL_MISSION_JUDGE_PROMPT_CONTRACT.timeoutMs
    : 60_000;

export {
  AI_CAPABILITY_ID,
  AI_CHILD_CAPABILITY_ID,
  PROMPT_CONTRACT_CATALOG_VERSION,
  findAiPromptContractCatalogEntry,
  getPromptContractCatalogIntegrity,
  listPromptContractCatalogEntries,
  resolveAiDispatchTimeoutMs,
};