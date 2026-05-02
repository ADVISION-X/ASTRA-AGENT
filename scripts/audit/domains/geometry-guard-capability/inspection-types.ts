import type { SourceFile } from "ts-morph";

export type PresenceEntry = {
  filePath: string;
  exists: boolean;
};

export type GeometryPresenceState = {
  requiredPresence: PresenceEntry[];
  forbiddenPresence: PresenceEntry[];
  geometryFilePaths: string[];
};

export type GeometrySourceState = {
  contractSource: SourceFile | null;
  schemaSource: SourceFile | null;
  schemaFoundationSource: SourceFile | null;
  schemaInputSource: SourceFile | null;
  schemaResultSource: SourceFile | null;
  schemaRuntimeProofSource: SourceFile | null;
  abilityGroupSource: SourceFile | null;
  registrySource: SourceFile | null;
  indexSource: SourceFile | null;
  typesSource: SourceFile | null;
  childFactorySource: SourceFile | null;
  executorSource: SourceFile | null;
  executionPlanSource: SourceFile | null;
  inputStagesSource: SourceFile | null;
  transformStageSource: SourceFile | null;
  resultBuilderSource: SourceFile | null;
  proofBuilderSource: SourceFile | null;
  coordinateGateSource: SourceFile | null;
  dispatchFailureSource: SourceFile | null;
  clockSource: SourceFile | null;
  inputFields: Set<string>;
  safetyPolicyFields: Set<string>;
  resultFields: Set<string>;
  runtimeProofFields: Set<string>;
  schemaStrings: Set<string>;
  typeStrings: Set<string>;
  registryStrings: Set<string>;
};

export type GeometryRequiredShapeState = {
  schemaSurfacePassed: boolean;
  contractSurfacePassed: boolean;
  abilityGroupPassed: boolean;
  registryPassed: boolean;
  indexPassed: boolean;
  childFactoryPassed: boolean;
  resultProofWiringPassed: boolean;
  executorWiringPassed: boolean;
  coordinateGatePassed: boolean;
  dispatchFailurePassed: boolean;
  requiredShapePassed: boolean;
};

export type GeometryForbiddenState = {
  forbiddenImportViolations: string[];
  forbiddenIdentifierViolations: string[];
  businessLiteralViolations: Array<{ relativePath: string; literals: readonly string[] }>;
  capabilityCheckViolations: string[];
  externalChildImports: string[];
  legacyContractOwners: string[];
  verifyViolations: Array<{ file: string; violates: boolean }>;
  clampViolations: Array<{ file: string; violates: boolean }>;
  throwViolations: Array<{ file: string; violates: boolean }>;
  dateViolations: Array<{ file: string; violates: boolean }>;
  clockPassed: boolean;
  typeEscapeViolations: Array<{ file: string; violates: boolean }>;
  driftPathViolations: string[];
  forbiddenShapePassed: boolean;
  boundaryAttackPassed: boolean;
  antiEscapePassed: boolean;
};