import type { Project } from "ts-morph";

import { fileExists, pathFromRepoRoot } from "./inspection-core.js";
import { getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, getZodShapePropertyNames, type AttackOutcome, toLine } from "./inspection-helpers.js";

const collectMissingRequiredFiles = async (): Promise<string[]> => {
  const missingFiles: string[] = [];
  for (const filePath of config.REQUIRED_ROOT_FILES) {
    if (!(await fileExists(pathFromRepoRoot(filePath)))) {
      missingFiles.push(filePath);
    }
  }
  for (const childCapabilityId of config.CHILDREN) {
    for (const suffix of ["contract.ts", "schema.ts", "implementation.ts"] as const) {
      const filePath = `${config.ROOT}/children/${childCapabilityId}/${suffix}`;
      if (!(await fileExists(pathFromRepoRoot(filePath)))) {
        missingFiles.push(filePath);
      }
    }
  }
  return missingFiles;
};

const collectSchemaFieldFindings = (schemaSource: import("ts-morph").SourceFile) => {
  const findings = [];
  const inputFields = getZodShapePropertyNames(schemaSource, "VisualTargetAbilityInputSchema");
  const baseResultFields = getZodShapePropertyNames(schemaSource, "VisualTargetBaseResultSchema");
  const runtimeProofFields = getZodShapePropertyNames(schemaSource, "VisualTargetRuntimeProofSchema");
  for (const field of config.REQUIRED_INPUT_FIELDS) {
    if (!inputFields.has(field)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.SCHEMA_PATH, message: `VisualTargetAbilityInputSchema is missing ${field}.` }));
    }
  }
  for (const field of config.REQUIRED_BASE_RESULT_FIELDS) {
    if (!baseResultFields.has(field)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.SCHEMA_PATH, message: `VisualTargetBaseResultSchema is missing ${field}.` }));
    }
  }
  for (const field of config.REQUIRED_RUNTIME_PROOF_FIELDS) {
    if (!runtimeProofFields.has(field)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.SCHEMA_PATH, message: `VisualTargetRuntimeProofSchema is missing ${field}.` }));
    }
  }
  return findings;
};

const collectContractAndRegistryFindings = (input: {
  project: Project;
  contractSource: import("ts-morph").SourceFile;
  abilityGroupSource: import("ts-morph").SourceFile;
  registrySource: import("ts-morph").SourceFile;
  indexSource: import("ts-morph").SourceFile;
}) => {
  const findings = [];
  const contractExports = new Set(input.contractSource.getExportedDeclarations().keys());
  const indexExports = new Set(input.indexSource.getExportedDeclarations().keys());
  const abilityGroupInterface = input.contractSource.getInterface("VisualTargetAbilityGroup");
  const abilityGroupMethods = new Set(abilityGroupInterface?.getMethods().map((method) => method.getName()) ?? []);

  for (const exportName of config.REQUIRED_CONTRACT_EXPORTS) {
    if (!contractExports.has(exportName)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.CONTRACT_PATH, message: `Visual Target contract must export ${exportName}.` }));
    }
  }
  if (!abilityGroupInterface || abilityGroupMethods.size !== 2 || !abilityGroupMethods.has("listChildCapabilityIds") || !abilityGroupMethods.has("execute")) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.CONTRACT_PATH, line: toLine(abilityGroupInterface ?? input.contractSource), message: "VisualTargetAbilityGroup must stay execute-only with listChildCapabilityIds() and execute()." }));
  }
  if (!input.abilityGroupSource.getFunction("createVisualTargetAbilityGroup")) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.ABILITY_GROUP_PATH, message: "Visual Target must expose createVisualTargetAbilityGroup()." }));
  }
  if (!input.registrySource.getFunction("createVisualTargetCapabilityRegistry") || !input.registrySource.getFunction("listVisualTargetChildren")) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.REGISTRY_PATH, message: "Visual Target registry must expose createVisualTargetCapabilityRegistry() and listVisualTargetChildren()." }));
  }
  for (const exportName of config.REQUIRED_INDEX_EXPORTS) {
    if (!indexExports.has(exportName)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.INDEX_PATH, message: `Visual Target index must export ${exportName}.` }));
    }
  }

  for (const childCapabilityId of config.CHILDREN) {
    const registryImportsChild = input.registrySource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes(`/children/${childCapabilityId}/implementation.js`));
    if (!registryImportsChild) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.REGISTRY_PATH, message: `Visual Target registry is missing ${childCapabilityId}.` }));
    }

    const implementationPath = `${config.ROOT}/children/${childCapabilityId}/implementation.ts`;
    const implementationSource = getSourceFileOrThrow(input.project, implementationPath);
    const usesExecutor = implementationSource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").endsWith("/runtime/visual-target-executor.js"));
    if (!usesExecutor) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: implementationPath, message: `Child ${childCapabilityId} must route through the governed runtime executor.` }));
    }
  }

  return findings;
};

const collectCoordinateExclusionFindings = (schemaSource: import("ts-morph").SourceFile) => {
  const findings = [];
  for (const schemaName of ["VisualTargetActionSuccessResultSchema", "VisualTargetRegionSuccessResultSchema", "VisualTargetMetricSuccessResultSchema"] as const) {
    if (!require("./inspection-helpers.js").hasCoordinateSpaceExclusion(schemaSource, schemaName, ["contact_sheet"])) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.SCHEMA_PATH, message: `${schemaName} must exclude contact_sheet from success coordinateSpace.` }));
    }
  }
  if (!require("./inspection-helpers.js").hasCoordinateSpaceExclusion(schemaSource, "VisualTargetActionSuccessResultSchema", ["ai_input"])) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.SCHEMA_PATH, message: "VisualTargetActionSuccessResultSchema must exclude ai_input from actionable success coordinateSpace." }));
  }
  return findings;
};

export async function runRequiredShapeAttack(project: Project): Promise<AttackOutcome> {
  const findings = [];
  const missingFiles = await collectMissingRequiredFiles();
  if (missingFiles.length > 0) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: missingFiles[0]!, severity: "fatal", message: "Visual Target required-shape is incomplete.", detail: `Missing files: ${missingFiles.join(", ")}` }));
  }

  const contractSource = getSourceFileOrThrow(project, config.CONTRACT_PATH);
  const schemaSource = getSourceFileOrThrow(project, config.SCHEMA_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, config.ABILITY_GROUP_PATH);
  const registrySource = getSourceFileOrThrow(project, config.REGISTRY_PATH);
  const indexSource = getSourceFileOrThrow(project, config.INDEX_PATH);
  findings.push(...collectSchemaFieldFindings(schemaSource));
  findings.push(...collectContractAndRegistryFindings({ project, contractSource, abilityGroupSource, registrySource, indexSource }));
  findings.push(...collectCoordinateExclusionFindings(schemaSource));

  return { findings, phase: createAttackPhase("required-shape-attack", findings, "Visual Target required-shape is present: standard package files, child triplets, execute-only contract, and governed schemas all exist.", "Visual Target required-shape is incomplete or drifted from the standard package contract.") };
}