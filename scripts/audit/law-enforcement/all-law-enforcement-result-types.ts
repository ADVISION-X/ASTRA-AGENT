import type { BinaryLawResult, LawEnforcementLevel } from "./all-law-enforcement-types.js";

export type ClauseResult = {
  clauseId: string;
  status: BinaryLawResult;
  enforcementLevel: LawEnforcementLevel;
  inspectorId: string;
  evidence: string;
  failureReason?: string;
};

export type LawResult = {
  lawId: string;
  ownerDomain: string;
  status: BinaryLawResult;
  clauseResults: ClauseResult[];
};

export type LawFileResult = {
  filePath: string;
  status: BinaryLawResult;
  lawResults: LawResult[];
};
