import { SyntaxKind, type Project, type TypeChecker } from "ts-morph";

import { fileExists, pathFromRepoRoot } from "./inspection-core.js";
import { flattenPropertyAccess, getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, extractImportResolutionDetail, toLine, toRootRelative, type AttackOutcome } from "./inspection-helpers.js";

const isInternalVisualTargetImport = (specifier: string): boolean => {
  return specifier.includes("capabilities/visual-target/")
    && !config.ALLOWED_EXTERNAL_IMPORT_SUFFIXES.some((suffix) => specifier.endsWith(suffix));
};

const collectSourceExternalImportFindings = (sourceFile: import("ts-morph").SourceFile, typeChecker: TypeChecker) => {
  const relativePath = toRootRelative(sourceFile);
  if (relativePath.startsWith(`${config.ROOT}/`)) {
    return [];
  }

  return sourceFile.getImportDeclarations().flatMap((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    if (!isInternalVisualTargetImport(specifier)) {
      return [];
    }
    return [createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1", file: relativePath, line: toLine(declaration), severity: "fatal", message: `External code must not import Visual Target internal surface ${specifier}.`, detail: extractImportResolutionDetail(typeChecker, declaration), hint: "Consume Visual Target only through contract.ts or index.ts." })];
  });
};

const collectExternalImportFindings = (project: Project, typeChecker: TypeChecker) => {
  return project.getSourceFiles().flatMap((sourceFile) => collectSourceExternalImportFindings(sourceFile, typeChecker));
};

const collectDuplicateSchemaFindings = (project: Project) => {
  const findings = [];
  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRootRelative(sourceFile);
    if (relativePath === config.CONTRACT_PATH || relativePath === config.SCHEMA_PATH) {
      continue;
    }
    const duplicateNodes = [sourceFile.getVariableDeclaration("VisualTargetAbilityInputSchema"), sourceFile.getVariableDeclaration("VisualTargetBaseResultSchema"), sourceFile.getVariableDeclaration("VisualTargetRuntimeProofSchema"), sourceFile.getInterface("VisualTargetAbilityGroup")].flatMap((node) => node ? [node] : []);
    if (duplicateNodes.length > 0) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1", file: relativePath, line: toLine(duplicateNodes[0]), severity: "fatal", message: "Visual Target canonical contract/schema symbols must not be redeclared outside contract.ts or schema.ts." }));
    }
  }
  return findings;
};

const collectWorkbenchAndLegacyFindings = async (project: Project) => {
  const findings = [];
  const workbenchSource = getSourceFileOrThrow(project, config.WORKBENCH_PATH);
  const legacyPlatformAdapterExists = await fileExists(pathFromRepoRoot(config.PLATFORM_ADAPTER_PATH));
  const workbenchImport = workbenchSource.getImportDeclarations().find((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("capabilities/visual-target/index.js"));
  const workbenchCreatesAbilityGroup = workbenchSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const path = flattenPropertyAccess(callExpression.getExpression());
    return path.length === 1 && path[0] === "createVisualTargetAbilityGroup";
  });
  if (!workbenchImport || !workbenchCreatesAbilityGroup) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1", file: config.WORKBENCH_PATH, message: "Workbench must wire Visual Target through createVisualTargetAbilityGroup() from the public index surface." }));
  }
  if (legacyPlatformAdapterExists) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1", file: config.PLATFORM_ADAPTER_PATH, message: "Retired TikTok visual-target adapter chain must be physically removed instead of kept as a second consumer path." }));
  }
  return findings;
};

const collectLocalAiBoundaryFindings = (project: Project) => {
  const findings = [];
  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRootRelative(sourceFile);
    if (!relativePath.startsWith("src/lib/local-ai/")) {
      continue;
    }
    const declaration = sourceFile.getImportDeclarations().find((candidate) => (candidate.getModuleSpecifierValue() ?? "").includes("capabilities/visual-target"));
    if (declaration) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1", file: relativePath, line: toLine(declaration), severity: "fatal", message: "Local AI runtime must not import Visual Target as final target-truth owner." }));
    }
  }
  return findings;
};

export async function runBoundaryAttack(project: Project, typeChecker: TypeChecker): Promise<AttackOutcome> {
  const findings = [];
  findings.push(...collectExternalImportFindings(project, typeChecker));
  findings.push(...collectDuplicateSchemaFindings(project));
  findings.push(...await collectWorkbenchAndLegacyFindings(project));
  findings.push(...collectLocalAiBoundaryFindings(project));

  return { findings, phase: createAttackPhase("boundary-attack", findings, "Visual Target ownership boundary holds: consumers stay on contract/index, workbench owns creation, and no duplicate owner surfaces exist.", "Visual Target ownership boundary is leaking through internal imports, duplicate contracts, or non-public creation/consumption paths.") };
}