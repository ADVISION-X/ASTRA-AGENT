import { stableJsonHash } from "../../lib/storage/hash.js";

export const buildDeepResearchTextHash = (value: string): string =>
  stableJsonHash(value);

export const buildDeepResearchPromptHash = (input: {
  promptId: string;
  promptVersion: string;
  phase: string;
  outputContractId: string;
  text: string;
}): string =>
  stableJsonHash({
    promptId: input.promptId,
    promptVersion: input.promptVersion,
    phase: input.phase,
    outputContractId: input.outputContractId,
    text: input.text,
  });
