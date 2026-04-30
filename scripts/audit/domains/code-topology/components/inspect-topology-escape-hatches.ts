import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorPhase } from "../../../core/schema.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import { getNodeLine, toRelativeSourcePath } from "../../../core/ts-morph.js";

import { codeTopologyShared } from "./topology-shared.js";

const { LAW_ID_001, createDetail, isForbiddenTargetPath, resolveImportTarget } = codeTopologyShared;

export function inspectTopologyEscapeHatches(project: Project): { findings: Finding[]; phases: InspectorPhase[] } {
  const typeBoundaryFindings = collectTypeBoundaryFindings(project);
  const historicalOwnerFindings = collectHistoricalOwnerFindings(project);
  const antiEscapeFindings = collectAntiEscapeFindings(project);

  return {
    findings: [...typeBoundaryFindings, ...historicalOwnerFindings, ...antiEscapeFindings],
    phases: [
      createPhase(
        "type-boundary",
        typeBoundaryFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        typeBoundaryFindings.length === 0,
        typeBoundaryFindings.length === 0
          ? "Workbench stays free of retired platform-adapter topology and concrete TikTok runtime owners."
          : "Workbench still exposes a retired platform-adapter topology or concrete TikTok runtime owner.",
      ),
      createPhase(
        "historical-owner-removal",
        historicalOwnerFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        historicalOwnerFindings.length === 0,
        historicalOwnerFindings.length === 0
          ? "Deleted historical owner paths are absent from active import and export graphs."
          : "Active source files still import or re-export deleted historical owner paths.",
      ),
      createPhase(
        "anti-escape",
        antiEscapeFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        antiEscapeFindings.length === 0,
        antiEscapeFindings.length === 0
          ? "Topology-sensitive files avoid dynamic import, require(), and re-export laundering."
          : "Topology-sensitive files contain import or export escape hatches.",
      ),
    ],
  };
}

function collectTypeBoundaryFindings(project: Project): Finding[] {
  const workbenchSource = project.getSourceFile(pathFromRepoRoot("src/lib/local-runtime/workbench.ts"));
  if (!workbenchSource) {
    return [];
  }

  const workbenchClass = workbenchSource.getClass("GrassEyeWorkbench");
  const platformAdapterProperty = workbenchClass?.getProperty("platformAdapter");
  const legacyPlatformImport = workbenchSource.getImportDeclarations().find((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    return specifier.includes("/tiktok-platform/") || specifier.includes("platform-runtime-contract");
  });
  return platformAdapterProperty || legacyPlatformImport
    ? [createFinding({ lawId: LAW_ID_001, file: toRelativeSourcePath(workbenchSource), line: getNodeLine(legacyPlatformImport ?? platformAdapterProperty ?? workbenchClass ?? workbenchSource), severity: "error", message: "Workbench must not retain a legacy platform-adapter boundary or import the retired TikTok runtime chain." })]
    : [];
}

function collectHistoricalOwnerFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    findings.push(...collectHistoricalOwnerImportFindings(sourceFile));
    findings.push(...collectHistoricalOwnerExportFindings(sourceFile));
  }
  return findings;
}

function collectHistoricalOwnerImportFindings(sourceFile: SourceFile): Finding[] {
  const findings: Finding[] = [];
  const relativePath = toRelativeSourcePath(sourceFile);
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const specifier = importDeclaration.getModuleSpecifierValue() ?? "";
    const targetPath = resolveImportTarget(importDeclaration.getModuleSpecifierSourceFile());
    if (!(specifier.includes("operator-control") || isForbiddenTargetPath(targetPath, ["src/features/operator-control/"]))) {
      continue;
    }
    findings.push(createFinding({ lawId: LAW_ID_001, file: relativePath, line: getNodeLine(importDeclaration), severity: "fatal", message: "Deleted historical owner operator-control must not be imported from active source files.", ...createDetail(targetPath) }));
  }
  return findings;
}

function collectHistoricalOwnerExportFindings(sourceFile: SourceFile): Finding[] {
  const findings: Finding[] = [];
  const relativePath = toRelativeSourcePath(sourceFile);
  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    const specifier = exportDeclaration.getModuleSpecifierValue() ?? "";
    const targetPath = resolveImportTarget(exportDeclaration.getModuleSpecifierSourceFile());
    if (!(specifier.includes("operator-control") || isForbiddenTargetPath(targetPath, ["src/features/operator-control/"]))) {
      continue;
    }
    findings.push(createFinding({ lawId: LAW_ID_001, file: relativePath, line: getNodeLine(exportDeclaration), severity: "fatal", message: "Deleted historical owner operator-control must not be re-exported from active source files.", ...createDetail(targetPath) }));
  }
  return findings;
}

function collectAntiEscapeFindings(project: Project): Finding[] {
  const topologyFiles = collectTopologySensitiveFiles(project);
  const findings: Finding[] = [];
  const seenFiles = new Set<string>();

  for (const sourceFile of topologyFiles) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (seenFiles.has(relativePath)) {
      continue;
    }
    seenFiles.add(relativePath);
    findings.push(...collectDynamicEscapeFindings(relativePath, sourceFile));
    findings.push(...collectReExportEscapeFindings(relativePath, sourceFile));
  }

  return findings;
}

function collectTopologySensitiveFiles(project: Project): SourceFile[] {
  const restrictedFeaturePrefixes = [
    "src/lib/local-runtime/runtime-executor",
    "src/lib/local-runtime/runtime-bootstrap",
    "src/lib/local-runtime/runtime-state",
    "src/lib/local-runtime/runtime-step-support",
    "src/features/vision/",
    "src/features/comments/",
    "src/features/product-signal/",
    "src/features/" + "local-data/",
  ];
  return [
    ...project.getSourceFiles().filter((sourceFile) => toRelativeSourcePath(sourceFile).startsWith("src/app/")),
    ...project.getSourceFiles().filter((sourceFile) => toRelativeSourcePath(sourceFile).startsWith("src/lib/browser/")),
    ...project.getSourceFiles().filter((sourceFile) => restrictedFeaturePrefixes.some((prefix) => toRelativeSourcePath(sourceFile).startsWith(prefix))),
  ];
}

function collectDynamicEscapeFindings(relativePath: string, sourceFile: SourceFile): Finding[] {
  const findings: Finding[] = [];
  const dynamicImportCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
  if (dynamicImportCall) {
    findings.push(createFinding({ lawId: LAW_ID_001, file: relativePath, line: getNodeLine(dynamicImportCall), severity: "error", message: "Topology enforcement forbids dynamic import as a path-ownership escape hatch." }));
  }
  const requireCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => Node.isIdentifier(callExpression.getExpression()) && callExpression.getExpression().getText() === "require");
  if (requireCall) {
    findings.push(createFinding({ lawId: LAW_ID_001, file: relativePath, line: getNodeLine(requireCall), severity: "error", message: "Topology enforcement forbids require()-based path laundering." }));
  }
  const anyKeyword = sourceFile.getFirstDescendantByKind(SyntaxKind.AnyKeyword);
  if (anyKeyword) {
    findings.push(createFinding({ lawId: LAW_ID_001, file: relativePath, line: getNodeLine(anyKeyword), severity: "error", message: "Topology enforcement forbids any-based path ownership escape hatches." }));
  }
  const invalidAsExpression = sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).find((asExpression) => {
    const targetTypeText = asExpression.getTypeNode()?.getText();
    return targetTypeText === "any" || (Node.isAsExpression(asExpression.getExpression()) && asExpression.getExpression().getTypeNode()?.getText() === "unknown");
  });
  if (invalidAsExpression) {
    findings.push(createFinding({ lawId: LAW_ID_001, file: relativePath, line: getNodeLine(invalidAsExpression), severity: "error", message: "Topology enforcement forbids any or unknown-cast laundering across canonical boundaries." }));
  }
  return findings;
}

function collectReExportEscapeFindings(relativePath: string, sourceFile: SourceFile): Finding[] {
  const findings: Finding[] = [];
  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    const targetPath = resolveImportTarget(exportDeclaration.getModuleSpecifierSourceFile());
    if (!isForbiddenTargetPath(targetPath, ["src/features/" + "platform-action/", "src/features/" + "local-data/", "src/lib/browser/", "src/lib/local-ai/"])) {
      continue;
    }
    findings.push(createFinding({ lawId: LAW_ID_001, file: relativePath, line: getNodeLine(exportDeclaration), severity: "error", message: "Topology enforcement forbids barrel or re-export laundering across canonical boundaries.", ...createDetail(targetPath) }));
  }
  return findings;
}