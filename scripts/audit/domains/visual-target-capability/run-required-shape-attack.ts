import type { Project } from "ts-morph";

import { fileExists, pathFromRepoRoot } from "./inspection-core.js";
import { getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, type AttackOutcome, toLine } from "./inspection-helpers.js";
import { getZodShapePropertyNames, hasCoordinateSpaceExclusion } from "./inspection-source-helpers.js";

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
  const inputFields = getZodShapePropertyNames(schemaSource, "VisualTargetAbilityInputSchema");
  const baseResultFields = getZodShapePropertyNames(schemaSource, "VisualTargetBaseResultSchema");
  const runtimeProofFields = getZodShapePropertyNames(schemaSource, "VisualTargetRuntimeProofSchema");
  return [
    ...collectMissingSchemaFields("VisualTargetAbilityInputSchema", inputFields, config.REQUIRED_INPUT_FIELDS),
    ...collectMissingSchemaFields("VisualTargetBaseResultSchema", baseResultFields, config.REQUIRED_BASE_RESULT_FIELDS),
    ...collectOutputSchemaFieldFindings(schemaSource, "VisualTargetActionOutputSchema", [...config.REQUIRED_OUTPUT_COMMON_FIELDS, ...config.REQUIRED_ACTION_OUTPUT_FIELDS]),
    ...collectOutputSchemaFieldFindings(schemaSource, "VisualTargetRegionOutputSchema", [...config.REQUIRED_OUTPUT_COMMON_FIELDS, ...config.REQUIRED_REGION_OUTPUT_FIELDS]),
    ...collectOutputSchemaFieldFindings(schemaSource, "VisualTargetMetricOutputSchema", [...config.REQUIRED_OUTPUT_COMMON_FIELDS, ...config.REQUIRED_METRIC_OUTPUT_FIELDS]),
    ...collectMissingSchemaFields("VisualTargetRuntimeProofSchema", runtimeProofFields, config.REQUIRED_RUNTIME_PROOF_FIELDS),
  ];
};

const collectMissingSchemaFields = (
  schemaName: string,
  actualFields: Set<string>,
  requiredFields: readonly string[],
) => {
  return requiredFields.flatMap((field) => {
    return actualFields.has(field)
      ? []
      : [createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.SCHEMA_PATH, message: `${schemaName} is missing ${field}.` })];
  });
};

const collectOutputSchemaFieldFindings = (
  schemaSource: import("ts-morph").SourceFile,
  schemaName: string,
  requiredFields: readonly string[],
) => {
  return collectMissingSchemaFields(schemaName, getZodShapePropertyNames(schemaSource, schemaName), requiredFields);
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

  findings.push(...collectContractSurfaceFindings({ contractExports, abilityGroupInterface, abilityGroupMethods, abilityGroupSource: input.abilityGroupSource, registrySource: input.registrySource, indexExports }));
  findings.push(...collectChildRegistryFindings(input.project, input.registrySource));
  return findings;
};

const collectContractSurfaceFindings = (input: {
  contractExports: Set<string>;
  abilityGroupInterface: import("ts-morph").InterfaceDeclaration | undefined;
  abilityGroupMethods: Set<string>;
  abilityGroupSource: import("ts-morph").SourceFile;
  registrySource: import("ts-morph").SourceFile;
  indexExports: Set<string>;
}) => {
  const findings = [];

  findings.push(...collectMissingExports(config.CONTRACT_PATH, config.REQUIRED_CONTRACT_EXPORTS, input.contractExports, "Visual Target contract must export"));
  findings.push(...collectAbilityGroupSurfaceFindings(input));
  findings.push(...collectRegistrySurfaceFindings(input.registrySource));
  findings.push(...collectMissingExports(config.INDEX_PATH, config.REQUIRED_INDEX_EXPORTS, input.indexExports, "Visual Target index must export"));

  return findings;
};

const collectMissingExports = (file: string, requiredExports: readonly string[], actualExports: Set<string>, messagePrefix: string) => {
  return requiredExports.flatMap((exportName) => {
    return actualExports.has(exportName)
      ? []
      : [createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file, message: `${messagePrefix} ${exportName}.` })];
  });
};

const collectAbilityGroupSurfaceFindings = (input: {
  abilityGroupInterface: import("ts-morph").InterfaceDeclaration | undefined;
  abilityGroupMethods: Set<string>;
  abilityGroupSource: import("ts-morph").SourceFile;
}) => {
  const findings = [];
  const hasValidAbilityGroupShape = input.abilityGroupInterface
    && input.abilityGroupMethods.size === 2
    && input.abilityGroupMethods.has("listChildCapabilityIds")
    && input.abilityGroupMethods.has("execute");
  if (!hasValidAbilityGroupShape) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.CONTRACT_PATH, line: toLine(input.abilityGroupInterface ?? input.abilityGroupSource), message: "VisualTargetAbilityGroup must stay execute-only with listChildCapabilityIds() and execute()." }));
  }
  if (!input.abilityGroupSource.getFunction("createVisualTargetAbilityGroup")) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.ABILITY_GROUP_PATH, message: "Visual Target must expose createVisualTargetAbilityGroup()." }));
  }
  return findings;
};

const collectRegistrySurfaceFindings = (registrySource: import("ts-morph").SourceFile) => {
  const hasFactory = registrySource.getFunction("createVisualTargetCapabilityRegistry");
  const hasChildList = registrySource.getFunction("listVisualTargetChildren");
  return hasFactory && hasChildList
    ? []
    : [createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.REGISTRY_PATH, message: "Visual Target registry must expose createVisualTargetCapabilityRegistry() and listVisualTargetChildren()." })];
};

const collectChildRegistryFindings = (project: Project, registrySource: import("ts-morph").SourceFile) => {
  const findings = [];
  for (const childCapabilityId of config.CHILDREN) {
    const registryImportsChild = registrySource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes(`/children/${childCapabilityId}/implementation.js`));
    if (!registryImportsChild) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.REGISTRY_PATH, message: `Visual Target registry is missing ${childCapabilityId}.` }));
    }

    const implementationPath = `${config.ROOT}/children/${childCapabilityId}/implementation.ts`;
    const implementationSource = getSourceFileOrThrow(project, implementationPath);
    const usesExecutor = implementationSource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").endsWith("/runtime/visual-target-executor.js"));
    if (!usesExecutor) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: implementationPath, message: `Child ${childCapabilityId} must route through the governed runtime executor.` }));
    }
  }

  return findings;
};

const collectCoordinateExclusionFindings = (schemaSource: import("ts-morph").SourceFile) => {
  const findings = [];
  for (const schemaName of ["VisualTargetActionOutputSchema", "VisualTargetRegionOutputSchema", "VisualTargetMetricOutputSchema"] as const) {
    if (!hasCoordinateSpaceExclusion(schemaSource, schemaName, ["contact_sheet"])) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.SCHEMA_PATH, message: `${schemaName} must exclude contact_sheet from success coordinateSpace.` }));
    }
  }
  if (!hasCoordinateSpaceExclusion(schemaSource, "VisualTargetActionOutputSchema", ["ai_input"])) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.SCHEMA_PATH, message: "VisualTargetActionOutputSchema must exclude ai_input from actionable success coordinateSpace." }));
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