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
export type ExecutedCheck = { lawId: string; clauseId: string; checkId: string };
export type InspectorOutput = {
  capabilityDomain: string;
  reportedLawIds: string[];
  executedChecks: ExecutedCheck[];
  findings: InspectorFinding[];
  inspectedFiles: string[];
  reportJson?: unknown;
  reportMarkdown?: string | undefined;
};
export type InspectorCheckBodyResult = {
  findings: readonly InspectorFinding[];
  evidenceRefs: readonly string[];
};
export type InspectorCheckSession = {
  run(checkId: string, body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>): Promise<InspectorCheckBodyResult>;
  runAll(body: () => InspectorCheckBodyResult | Promise<InspectorCheckBodyResult>): Promise<InspectorCheckBodyResult>;
  output(meta?: Readonly<{ reportJson?: unknown; reportMarkdown?: string }>): SessionInspectorOutput;
};
export type SessionInspectorOutput = Omit<
  InspectorOutput,
  "executedChecks" | "findings" | "inspectedFiles" | "reportedLawIds"
> & {
  reportedLawIds: readonly string[];
  checkRuns: readonly unknown[];
  executedChecks: readonly ExecutedCheck[];
  findings: readonly InspectorFinding[];
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
export type CompletedReport = {
  status: "PASS" | "FAIL";
  findingCount: number;
  reportPath: string;
};

export type InspectorContext = {
  project: Project;
  planEntry: AuditPlanEntry;
  generatedPlan: readonly AuditPlanEntry[];
  completedReports: Readonly<Record<string, CompletedReport>>;
  checks: InspectorCheckSession;
};
