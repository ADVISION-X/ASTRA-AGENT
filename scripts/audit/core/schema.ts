import type { AuditPlanOwner, GeneratedArtifacts } from "./schema-generated-artifacts.js";
import type { EnforcementMatrixOwner, ResolvedDomainManifest } from "./schema-manifests.js";

export const INSPECTION_CLASSIFICATIONS = [
  "PASS",
  "LAW GAP",
  "ENFORCEMENT GAP",
  "ENFORCEMENT MISS",
  "SCRIPT OVERREACH",
  "LAW-SCRIPT DRIFT",
  "CODE VIOLATION",
  "FAKE ENFORCEMENT",
] as const;

export type InspectionClassification = (typeof INSPECTION_CLASSIFICATIONS)[number];
export type FindingSeverity = "error" | "fatal";

export interface Finding {
  lawId: string;
  file: string;
  line: number;
  severity: FindingSeverity;
  message: string;
  detail?: string;
  hint?: string;
}

export interface InspectorPhase {
  name: string;
  classification: InspectionClassification;
  passed: boolean;
  summary: string;
}

export interface InspectorResult {
  inspector: string;
  inspectorId: string;
  capabilityDomain: string;
  passed: boolean;
  classification: InspectionClassification;
  violationCount: number;
  findings: Finding[];
  phases: InspectorPhase[];
  summary: string;
}

export interface InspectorContext extends GeneratedArtifacts {
  repoRoot: string;
  manifestsByDomain: Map<string, ResolvedDomainManifest>;
  matrixOwnersByDomain: Map<string, EnforcementMatrixOwner>;
  planOwnersByDomain: Map<string, AuditPlanOwner>;
}

export type DomainInspector = (context: InspectorContext) => Promise<InspectorResult>;