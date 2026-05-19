import type { DomAutomationAuditProject } from "./components/collect-dom-automation-project.js";
import type { LawEnforcementBinaryResult } from "./dom-automation-law-enforcement-matrix.js";

export type ClauseCheckOutcome = {
  readonly status: LawEnforcementBinaryResult;
  readonly evidence: string;
  readonly failureReason?: string;
};

export type DomAutomationBinaryCheckContext = {
  readonly auditProject: DomAutomationAuditProject;
  readonly packageJson: { scripts?: Record<string, string> };
  readonly manifest: { allowedLawIds?: string[] };
  readonly memo: Map<string, ClauseCheckOutcome>;
};

