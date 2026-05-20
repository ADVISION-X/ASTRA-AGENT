import type { DomAutomationAuditProject } from "./components/dom-automation-project-types.js";
import type { LawEnforcementBinaryResult } from "./dom-automation-law-enforcement-types.js";

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
