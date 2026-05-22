import { createHash } from "node:crypto";

export const buildDeepResearchTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

export const buildDeepResearchPromptHash = (input: {
  promptId: string;
  promptVersion: string;
  phase: string;
  promptText: string;
  outputContractId: string;
}): string =>
  buildDeepResearchTextHash(JSON.stringify({
    outputContractId: input.outputContractId,
    phase: input.phase,
    promptId: input.promptId,
    promptText: input.promptText,
    promptVersion: input.promptVersion,
  }));
