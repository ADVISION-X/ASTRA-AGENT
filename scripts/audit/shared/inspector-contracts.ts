import type { Project } from "ts-morph";

export type InspectorFinding = {
  checkId: string;
  evidenceMode: string;
  lawId: string;
  clauseId: string;
  message: string;
  severity: "fatal";
  line?: number | undefined;
  hint?: string | undefined;
  filePath?: string | undefined;
  evidence?: string | undefined;
};
export type StaticCheckReceipt = { check: string; lawId: string; passed: boolean };
export type InspectorAssertion = { clauses: string[]; evidenceMode: string; passed: boolean; refs: string[] };
export type InspectorLawResult = { lawId: string; assertions: InspectorAssertion[]; findings: InspectorFinding[] };
export type InspectorEvaluation = {
  capabilityDomain: string;
  reportedLawIds: string[];
  findings: InspectorFinding[];
  inspectedFiles: string[];
  staticCheckReceipts: StaticCheckReceipt[];
};
export type InspectorLawRequirement = {
  lawId: string;
  forbiddenCount: number;
  requiredStaticModes: string[];
  targetPaths: string[];
  targetSet: { queryRef: string; count: number };
};
export type InspectorOutput = {
  capabilityDomain: string;
  reportedLawIds: string[];
  lawResults: InspectorLawResult[];
  inspectedFiles: string[];
};
export type SessionInspectorOutput = InspectorOutput;
type AuditPlanEntry = {
  capabilityDomain: string;
  manifestPath: string;
  ownerInspectorPath: string;
  executionGroup: "foundation" | "domain" | "meta";
  lawIds: string[];
};
export type InspectorContext = {
  project: Project;
  selectedLawId: string;
  sealedRoot: string;
  targetSet: Readonly<{ queryRef: string; count: number }>;
  targetPaths: readonly string[];
  lawRequirements: readonly InspectorLawRequirement[];
  planEntry: AuditPlanEntry;
  generatedPlan: readonly AuditPlanEntry[];
};
