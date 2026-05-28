import { Node, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const registryPath = "src/app/app-shell/skill-registry.ts";
const sidebarPath = "src/app/app-shell/sidebar.ts";

const sourcePath = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const getStringProperty = (objectLiteral: ObjectLiteralExpression, propertyName: string): string | null => {
  const property = objectLiteral.getProperty(propertyName);
  if (!Node.isPropertyAssignment(property)) return null;
  const initializer = property.getInitializer();
  return Node.isStringLiteral(initializer) ? initializer.getLiteralText() : null;
};

const registryObjects = (sourceFile: SourceFile): ObjectLiteralExpression[] => {
  const declaration = sourceFile.getVariableDeclaration("skillRegistry");
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
  return initializer?.getElements().filter(Node.isObjectLiteralExpression) ?? [];
};

export const inspectSkillRegistry = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const registryFile = sourcePath(context, registryPath);
  const sidebarFile = sourcePath(context, sidebarPath);
  if (registryFile) inspectedFiles.add(getRepoSourcePath(registryFile));
  if (sidebarFile) inspectedFiles.add(getRepoSourcePath(sidebarFile));
  if (!registryFile) {
    findings.push(createFinding({ checkId: "app-shell-ui/skill-registry-file", lawId, filePath: registryPath, message: "Skill Registry source file is missing." }));
    return;
  }
  const objects = registryObjects(registryFile);
  const ids = new Set(objects.map((objectLiteral) => getStringProperty(objectLiteral, "id")).filter((id): id is string => Boolean(id)));
  for (const requiredId of ["amazon-product-mining", "facebook-video-mining", "tiktok-product-mining", "deep-research-analysis", "video-downloader"]) {
    if (ids.has(requiredId)) continue;
    findings.push(createFinding({
      checkId: "app-shell-ui/skill-registry-required-id",
      lawId,
      filePath: registryPath,
      message: `Skill Registry must register ${requiredId}.`,
    }));
  }
  for (const objectLiteral of objects) {
    const id = getStringProperty(objectLiteral, "id") ?? "unknown";
    for (const propertyName of ["label", "category", "description", "route", "status", "primarySurface", "historySurface", "detailSurface"]) {
      if (getStringProperty(objectLiteral, propertyName)) continue;
      findings.push(createFinding({
        checkId: "app-shell-ui/skill-registry-required-field",
        lawId,
        filePath: registryPath,
        message: `Skill ${id} must define ${propertyName}.`,
      }));
    }
    for (const propertyName of ["allowedActions", "forbiddenActions"]) {
      const property = objectLiteral.getProperty(propertyName);
      if (Node.isPropertyAssignment(property) && property.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)) continue;
      findings.push(createFinding({
        checkId: "app-shell-ui/skill-registry-action-field",
        lawId,
        filePath: registryPath,
        message: `Skill ${id} must define ${propertyName}.`,
      }));
    }
  }
  const sidebarImportsRegistry = sidebarFile?.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().endsWith("./skill-registry.js")
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === "skillRegistry"),
  );
  if (!sidebarImportsRegistry) {
    findings.push(createFinding({
      checkId: "app-shell-ui/sidebar-from-registry",
      lawId,
      filePath: sidebarPath,
      message: "Sidebar must render from Skill Registry.",
    }));
  }
};
