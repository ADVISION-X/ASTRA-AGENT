export type SourceType = "law" | "blueprint";
export type RequirementTier = "P0" | "P1" | "P2" | "P3" | "UNKNOWN";
export type CoverageStatus = "covered" | "partial" | "missing" | "weak";

export type EnforcementStrength =
  | "LEVEL_5_AST_SYMBOL_IMPORT_GRAPH_NEGATIVE_PROOF"
  | "LEVEL_4_STRUCTURAL_NEGATIVE_PROOF"
  | "LEVEL_3_SCHEMA_JSON_NEGATIVE_PROOF"
  | "LEVEL_2_EXACT_TEXT_GENERATED_NEGATIVE_PROOF"
  | "LEVEL_1_TEXT_INCLUDES_PATH_EXISTS"
  | "LEVEL_0_MANUAL_ONLY_OR_MISSING";

export type CoverageRequirement = {
  requirementId: string;
  sourceType: SourceType;
  owner: string;
  sourceFile: string;
  sourceLawId: string;
  sourceSection: string;
  sourceText: string;
  tier: RequirementTier;
  requiredEvidence: string[];
  staticCoverage: StaticCoverageEvidence[];
  negativeProofCoverage: NegativeProofCoverageEvidence[];
  enforcementStrength: EnforcementStrength;
  coverageStatus: CoverageStatus;
  blockingReason: string[];
};

export type StaticCoverageEvidence = {
  inspectorId: string;
  domain: string;
  manifestPath: string;
  entry: string;
  evidenceMode: string;
  strength: EnforcementStrength;
};

export type NegativeProofCoverageEvidence = {
  negativeProofId: string;
  domain: string;
  harnessPath: string;
  mutation: string;
  expected: "FAIL";
  actual: "FAIL" | "MISSING" | "UNKNOWN";
  rollback: "PASS" | "MISSING" | "UNKNOWN";
};

export type CoverageSummary = {
  generatedAt: string;
  coverageMode: "inventory-only" | "blocking";
  pilotOwners: string[];
  totalRequirements: number;
  lawRequirements: number;
  blueprintRequirements: number;
  p0p1Requirements: number;
  staticCovered: number;
  negativeProofCovered: number;
  weakCoverage: number;
  missingCoverage: number;
  manualOnly: number;
  warningOnlyP0: number;
  detachedInspectors: number;
  inspectorNotInRunner: number;
  generatedFakePass: number;
  finalVerdict: "PASS" | "BLOCKED";
  blockers: string[];
};
