import type { Project } from "ts-morph";

export type InspectorFinding = {
  checkId: string;
  lawId: string;
  clauseId: string;
  message: string;
  severity: "fatal";
  line?: number | undefined;
  hint?: string | undefined;
  filePath?: string | undefined;
  evidence?: string | undefined;
};
export type InspectorAssertion = { clauses: string[]; evidenceMode: string; passed: boolean; refs: string[] };
export type InspectorLawResult = { lawId: string; assertions: InspectorAssertion[]; findings: InspectorFinding[] };
export type InspectorEvaluation = {
  capabilityDomain: string;
  reportedLawIds: string[];
  findings: InspectorFinding[];
  inspectedFiles: string[];
};
export type InspectorOutput = {
  capabilityDomain: string;
  reportedLawIds: string[];
  lawResults: InspectorLawResult[];
  inspectedFiles: string[];
};
export type InspectorCheckBodyResult = {
  findings: readonly InspectorFinding[];
  evidenceRefs: readonly string[];
};
export type InspectorCheckSession = {
  run(checkId: string, body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>): Promise<InspectorCheckBodyResult>;
  runAll(body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>): Promise<InspectorCheckBodyResult>;
  output(): SessionInspectorOutput;
};
export type SessionInspectorOutput = Omit<InspectorOutput, "inspectedFiles" | "lawResults" | "reportedLawIds"> & {
  reportedLawIds: readonly string[];
  checkRuns: readonly unknown[];
  lawResults: readonly InspectorLawResult[];
  inspectedFiles: readonly string[];
};
type AuditPlanEntry = {
  capabilityDomain: string;
  manifestPath: string;
  ownerInspectorPath: string;
  executionGroup: "foundation" | "domain" | "meta";
  lawIds: string[];
  bindings: Array<{
    lawId: string;
    clauseId: string;
    checkIds: string[];
    sourceEvidence: Array<{ filePath: string; symbolName: string }>;
    evidenceMode: "static" | "acceptance" | "real-chrome" | "model+acceptance+real-chrome" | "artifact+real-chrome";
    primaryEvidence?: { engine: "ast" | "fs" | "config"; sourceEvidenceIndex: number };
  }>;
  blueprintRefs: Array<{ filePath: string; requiredAnchors: string[] }>;
};
export type InspectorContext = {
  project: Project;
  selectedLawId: string;
  sealedRoot: string;
  targetSet: Readonly<{ queryRef: string; count: number; sha256: string }>;
  targetPaths: readonly string[];
  planEntry: AuditPlanEntry;
  generatedPlan: readonly AuditPlanEntry[];
  checks: InspectorCheckSession;
};
