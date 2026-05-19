// Legacy imports removed — schema-generated-artifacts and schema-manifests were part of the
// old multi-domain audit system that has been replaced by the quality-kernel.

export const INSPECTION_CLASSIFICATIONS = [
  "PASS",
  "LAW GAP",
  "ENFORCEMENT GAP",
  "ENFORCEMENT MISS",
  "INVALID ENFORCEMENT",
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
  zombieKind?: string;
  symbolName?: string;
  lawfulCallerCount?: number;
  protectedSeam?: string | null;
  recommendedAction?: string;
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

export interface InspectorContext {
  repoRoot: string;
}

export type DomainInspector = (context: InspectorContext) => Promise<InspectorResult>;

export interface LawRecord {
  lawId: string;
  status: string;
  tier: string;
  capabilityDomain: string;
  enforcementMode: string;
  evidenceMode: string;
  summary: string;
  lawFile: string;
  sourceKind: "markdown" | "apex-law" | "final-law";
}

export interface OwnerManifest {
  inspectorId: string;
  capabilityDomain: string;
  owner: boolean;
  entry: string;
  exportName?: string;
  runner: string;
  runnerArgs?: string[];
  engine?: string;
  runnerPriority?: number;
  allowedLawIds: string[];
  readsLawFiles?: string[];
  readsBlueprintFiles?: string[];
  ownedRoots?: string[];
  requiredPaths?: string[];
  allowedCrossOwnerImports?: string[];
  allowDynamicImport?: boolean;
}

export interface OwnerMatrixDomain {
  capabilityDomain: string;
  lawIds: string[];
  manifestPath: string;
  inspectorId: string;
  inspectorEntry: string;
  runner: string;
  status: "covered" | "missing";
}