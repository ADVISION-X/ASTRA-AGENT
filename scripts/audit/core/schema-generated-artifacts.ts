import type { EnforcementMatrix } from "./schema-manifests.js";

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

export interface GeneratedLawRegistry {
  generatedAt: string;
  laws: LawRecord[];
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
  activeLawDomains: string[];
}

export interface GeneratedArtifacts {
  lawRegistry: GeneratedLawRegistry;
  enforcementMatrix: EnforcementMatrix;
  auditPlan: AuditPlan;
  auditConflicts: AuditConflictsSnapshot;
  phaseGate: PhaseGate;
}