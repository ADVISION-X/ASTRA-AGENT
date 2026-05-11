import { Node, type ImportDeclaration, type SourceFile, type VariableDeclaration } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";
import { getAuditProject, toRelativeSourcePath } from "../../core/ts-morph.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";

const { ACTIVE_ABILITY_GROUPS, CONTRACT_SUFFIX, GOVERNED_SURFACES, INDEX_SUFFIX } = capabilityGroupGovernanceConstants;

function isRetiredSpecifier(specifier: string): boolean {
  return specifier.includes("features/local-data")
    || specifier.includes("features/platform-action")
    || specifier.includes("/local-data/")
    || specifier.includes("/platform-action/");
}

function isCapabilitySourcePath(relativePath: string): boolean {
  return relativePath.startsWith("src/capabilities/");
}

function getCapabilityRoot(relativePath: string): string | null {
  if (!isCapabilitySourcePath(relativePath)) {
    return null;
  }

  const [, , capabilityName] = relativePath.split("/");
  return capabilityName ? `src/capabilities/${capabilityName}` : null;
}

function isPublicCapabilityEntry(relativePath: string): boolean {
  return isCapabilitySourcePath(relativePath) && (relativePath.endsWith(CONTRACT_SUFFIX) || relativePath.endsWith(INDEX_SUFFIX));
}

function isAllowedLocalRuntimeWorkbenchImport(importerPath: string, targetPath: string): boolean {
  return (importerPath === "src/lib/local-runtime/workbench-screenshot-ability-group.ts"
      && targetPath === "src/capabilities/screenshot/workbench-screenshot-ability-group.ts");
}

function createDefaultPublicEntries(capabilityRoot: string): Set<string> {
  return new Set<string>([`${capabilityRoot}/contract.ts`, `${capabilityRoot}/index.ts`]);
}

function collectIndexReExports(project: ReturnType<typeof getAuditProject>, capabilityRoot: string): string[] {
  const indexSourceFile = project.getSourceFile(pathFromRepoRoot(`${capabilityRoot}/index.ts`));
  if (!indexSourceFile) {
    return [];
  }

  return indexSourceFile.getExportDeclarations().flatMap((exportDeclaration) => {
    const targetSourceFile = exportDeclaration.getModuleSpecifierSourceFile();
    return targetSourceFile ? [toRelativeSourcePath(targetSourceFile)] : [];
  });
}

function collectDeclaredPublicEntries(project: ReturnType<typeof getAuditProject>): Map<string, Set<string>> {
  const publicEntries = new Map<string, Set<string>>();

  for (const abilityGroupId of ACTIVE_ABILITY_GROUPS) {
    const capabilityRoot = `src/capabilities/${abilityGroupId}`;
    const entrySet = createDefaultPublicEntries(capabilityRoot);
    for (const targetPath of collectIndexReExports(project, capabilityRoot)) {
      entrySet.add(targetPath);
    }

    publicEntries.set(capabilityRoot, entrySet);
  }

  return publicEntries;
}

function isGovernedSurface(relativePath: string): boolean {
  return GOVERNED_SURFACES.some((prefix) => relativePath.startsWith(prefix));
}

function getStringLiteralValue(node: Node | undefined): string | null {
  if (!node) {
    return null;
  }
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) {
    return getStringLiteralValue(node.getExpression());
  }
  return null;
}

function isCrossBoundaryImport(importerPath: string, targetPath: string): boolean {
  const importerRoot = getCapabilityRoot(importerPath);
  const targetRoot = getCapabilityRoot(targetPath);
  if (!targetRoot) {
    return false;
  }
  return importerRoot ? importerRoot !== targetRoot : true;
}

function resolveImportTargetPath(importDeclaration: ImportDeclaration): string | null {
  const sourceFile = importDeclaration.getModuleSpecifierSourceFile();
  return sourceFile ? toRelativeSourcePath(sourceFile) : null;
}

function resolveExportedAbilityGroupConstant(sourceFile: SourceFile, expectedAbilityGroupId: string): VariableDeclaration | undefined {
  for (const [exportName, declarations] of sourceFile.getExportedDeclarations()) {
    if (!exportName.endsWith("_ABILITY_GROUP_ID")) {
      continue;
    }

    const declaration = declarations.find((candidate): candidate is VariableDeclaration => Node.isVariableDeclaration(candidate));
    if (declaration && getStringLiteralValue(declaration.getInitializer()) === expectedAbilityGroupId) {
      return declaration;
    }
  }

  return undefined;
}

export const capabilityGroupGovernanceUtils = {
  isRetiredSpecifier,
  isCapabilitySourcePath,
  getCapabilityRoot,
  isPublicCapabilityEntry,
  isAllowedLocalRuntimeWorkbenchImport,
  collectDeclaredPublicEntries,
  isGovernedSurface,
  getStringLiteralValue,
  isCrossBoundaryImport,
  resolveImportTargetPath,
  resolveExportedAbilityGroupConstant,
} as const;