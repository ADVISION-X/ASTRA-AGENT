import type { InspectorFinding } from "./inspector-contracts.js";

type FindingInput = {
  checkId: string;
  lawId: string;
  message: string;
  clauseId?: string;
  filePath?: string | undefined;
  evidence?: string | undefined;
};

export const selectLawId = (lawIds: readonly string[], preferredLawId: string): string => {
  const selected = lawIds.find((lawId) => lawId === preferredLawId) ?? lawIds[0];
  if (!selected) {
    throw new Error(`No lawId available for ${preferredLawId}.`);
  }
  return selected;
};

export const createFinding = (input: FindingInput): InspectorFinding => ({
  checkId: input.checkId,
  lawId: input.lawId,
  clauseId: input.clauseId ?? "primary",
  message: input.message,
  filePath: input.filePath,
  evidence: input.evidence,
});