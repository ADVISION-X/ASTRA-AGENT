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

export interface LawRecord {
  lawId: string;
  status: string;
  tier: string;
  capabilityDomain: string;
  enforcementMode: string;
  evidenceMode: string;
  summary: string;
  relativeFilePath: string;
  line: number;
}

export interface AuditConflict {
  kind:
    | "LAW_PARSE"
    | "LAW_REGISTRY"
    | "MANIFEST"
    | "PLAN"
    | "PHASE_GATE"
    | "GENERATED";
  message: string;
  file?: string;
  capabilityDomain?: string;
  lawId?: string;
  detail?: string;
}

export interface DomainManifest {
  inspectorId: string;
  capabilityDomain: string;
  owner: boolean;
  entry: string;
  engine: string;
  supportsEvidenceModes: string[];
  allowedLawIds: string[];
  readsLawFiles: string[];
  readsBlueprintFiles?: string[];
}

export interface ResolvedDomainManifest extends DomainManifest {
  manifestPath: string;
  domainFolder: string;
}

export interface GeneratedLawRegistry {
  generatedAt: string;
  laws: LawRecord[];
}

export interface EnforcementMatrixOwner {
  inspectorId: string;
  capabilityDomain: string;
  manifestPath: string;
  entry: string;
  engine: string;
  supportsEvidenceModes: string[];
  lawIds: string[];
  readsLawFiles: string[];
  readsBlueprintFiles: string[];
}

export interface EnforcementMatrix {
  generatedAt: string;
  owners: EnforcementMatrixOwner[];
}

export interface AuditPlanOwner {
  capabilityDomain: string;
  inspectorId: string;
  entry: string;
  lawIds: string[];
}

export interface AuditPlan {
  generatedAt: string;
  phase: string;
  phaseGateFile: string;
  owners: AuditPlanOwner[];
}

export interface AuditConflictsSnapshot {
  generatedAt: string;
  conflicts: AuditConflict[];
}

export interface PhaseGate {
  phase: string;
  activeCapabilityDomains: string[];
}

export interface GeneratedArtifacts {
  lawRegistry: GeneratedLawRegistry;
  enforcementMatrix: EnforcementMatrix;
  auditPlan: AuditPlan;
  auditConflicts: AuditConflictsSnapshot;
  phaseGate: PhaseGate;
}

export interface InspectorContext extends GeneratedArtifacts {
  repoRoot: string;
  manifestsByDomain: Map<string, ResolvedDomainManifest>;
  matrixOwnersByDomain: Map<string, EnforcementMatrixOwner>;
  planOwnersByDomain: Map<string, AuditPlanOwner>;
}

export type DomainInspector = (context: InspectorContext) => Promise<InspectorResult>;

export interface RunnerSummary {
  generatedAt: string;
  phase: string;
  totals: {
    inspectors: number;
    passed: number;
    failed: number;
    blocking: number;
  };
  results: InspectorResult[];
}