import { createFinding } from "../../../core/result.js";
import type { ImportDeclaration } from "ts-morph";
import type { Finding } from "../../../core/schema.js";
import { isRepoPathWithin, resolveImportedDeclarationPaths, resolveModuleTargetPath } from "./dom-automation-module-resolution.js";
import type { DomAutomationAuditProject, DomAutomationValidationResult } from "./dom-automation-project-types.js";
import { buildValidationResult } from "./dom-automation-validation-result.js";

const DOM_FACADE_PATH = "src/capabilities/dom-automation/index.ts";
const BROWSER_CONTROLLER_PATH = "src/lib/browser/browser-controller.ts";
const FORBIDDEN_PLUGIN_TARGETS = [
  "src/capabilities/dom-automation/runtime",
  "src/lib/browser/current-chrome-browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller-primitives.ts",
] as const;
const APPROVED_STORAGE_EXTERNAL_MODULES = new Set(["node:fs", "node:path"]);
const PLUGIN_ROOTS = [
  "src/plugins/amazon-invoice-upload",
  "src/plugins/product-video-dom-runtime",
] as const;

const importFinding = (...input: readonly [
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
]): Finding => {
  const [lawId, file, line, message, hint] = input;
  return createFinding({ lawId, file, line, severity: "fatal", message, hint });
};

const validateVisualMissionBoundary = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  for (const sourceFile of auditProject.sourceFiles.visualMission) {
    const filePath = sourceFile.getFilePath();
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const targetPaths = resolveImportedDeclarationPaths(importDeclaration);
      if (targetPaths.some((targetPath) => isRepoPathWithin(targetPath, "src/capabilities/dom-automation"))) {
        findings.push(importFinding(
          "GRASSEYE-DOM-001-V1",
          sourceFile.getFilePath().replace(`${auditProject.project.getDirectoryOrThrow(".").getPath()}/`, ""),
          importDeclaration.getStartLineNumber(),
          "visual-mission imports DOM automation code through direct or barrel resolution",
          "Keep visual mission decoupled from the DOM owner boundary.",
        ));
      }
    }
  }
  return findings;
};

const isApprovedPluginExternalImport = (repoPath: string, specifier: string): boolean =>
  specifier === "zod"
  || (repoPath.endsWith("-storage.ts") && APPROVED_STORAGE_EXTERNAL_MODULES.has(specifier));

const pluginExternalImportFinding = (
  repoPath: string,
  importDeclaration: ImportDeclaration,
): Finding | null => {
  const specifier = importDeclaration.getModuleSpecifierValue();
  return isApprovedPluginExternalImport(repoPath, specifier)
    ? null
    : importFinding("GRASSEYE-DOM-008-V1", repoPath, importDeclaration.getStartLineNumber(), `plugin imports unsupported external module: ${specifier}`, "Amazon plugin may only import DOM facade, BrowserController type, its own files, and zod.");
};

const pluginBrowserImportFinding = (
  repoPath: string,
  importDeclaration: ImportDeclaration,
): Finding | null => importDeclaration.getImportClause()?.isTypeOnly() === true
  ? null
  : importFinding("GRASSEYE-DOM-008-V1", repoPath, importDeclaration.getStartLineNumber(), "plugin imports BrowserController as runtime code instead of type-only contract", "Keep BrowserController imported as a type-only boundary.");

const pluginForbiddenRelativeImportFinding = (
  repoPath: string,
  importDeclaration: ImportDeclaration,
  moduleTargetPath: string,
): Finding => {
  const targetsPrivateImplementation = FORBIDDEN_PLUGIN_TARGETS.some((target) => isRepoPathWithin(moduleTargetPath, target));
  return importFinding("GRASSEYE-DOM-008-V1", repoPath, importDeclaration.getStartLineNumber(), targetsPrivateImplementation ? `plugin imports forbidden private DOM or browser implementation: ${moduleTargetPath}` : `plugin imports forbidden module outside its allowed boundary: ${moduleTargetPath}`, targetsPrivateImplementation ? "Amazon plugin must call DOM facade only, never runtime or browser primitives." : "Keep Amazon plugin scoped to its own files, DOM facade, BrowserController type, and zod.");
};

const pluginRelativeImportFinding = (
  repoPath: string,
  importDeclaration: ImportDeclaration,
): Finding | null => {
  const moduleTargetPath = resolveModuleTargetPath(importDeclaration);
  if (!moduleTargetPath || PLUGIN_ROOTS.some((root) => isRepoPathWithin(moduleTargetPath, root)) || moduleTargetPath === DOM_FACADE_PATH) return null;
  return moduleTargetPath === BROWSER_CONTROLLER_PATH
    ? pluginBrowserImportFinding(repoPath, importDeclaration)
    : pluginForbiddenRelativeImportFinding(repoPath, importDeclaration, moduleTargetPath);
};

const pluginImportFinding = (
  repoPath: string,
  importDeclaration: ImportDeclaration,
): Finding | null => importDeclaration.getModuleSpecifierValue().startsWith(".")
  ? pluginRelativeImportFinding(repoPath, importDeclaration)
  : pluginExternalImportFinding(repoPath, importDeclaration);

const validatePluginImports = (
  auditProject: DomAutomationAuditProject,
): Finding[] => auditProject.sourceFiles.plugin.flatMap((sourceFile) => {
  const repoPath = sourceFile.getFilePath().replace(`${auditProject.project.getDirectoryOrThrow(".").getPath()}/`, "");
  return sourceFile.getImportDeclarations().flatMap((importDeclaration) => {
    const finding = pluginImportFinding(repoPath, importDeclaration);
    return finding ? [finding] : [];
  });
});

const validateDomCoreAgainstPlugin = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  for (const sourceFile of auditProject.sourceFiles.dom) {
    const repoPath = sourceFile.getFilePath().replace(`${auditProject.project.getDirectoryOrThrow(".").getPath()}/`, "");
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const moduleTargetPath = resolveModuleTargetPath(importDeclaration);
      if (!moduleTargetPath) {
        continue;
      }
      if (PLUGIN_ROOTS.some((root) => isRepoPathWithin(moduleTargetPath, root))) {
        findings.push(importFinding(
          "GRASSEYE-DOM-008-V1",
          repoPath,
          importDeclaration.getStartLineNumber(),
          "DOM capability imports Amazon plugin code",
          "Keep platform-specific orchestration out of the DOM owner boundary.",
        ));
      }
      if (isRepoPathWithin(repoPath, "src/capabilities/dom-automation/runtime")
        && isRepoPathWithin(moduleTargetPath, "src/lib/browser")
        && moduleTargetPath !== BROWSER_CONTROLLER_PATH) {
        findings.push(importFinding(
          "GRASSEYE-DOM-001-V1",
          repoPath,
          importDeclaration.getStartLineNumber(),
          `DOM runtime imports private browser implementation instead of BrowserController contract: ${moduleTargetPath}`,
          "Use BrowserController contract only inside DOM runtime.",
        ));
      }
    }
  }
  return findings;
};

const validateImportBoundaries = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const findings = [
    ...validateVisualMissionBoundary(auditProject),
    ...validatePluginImports(auditProject),
    ...validateDomCoreAgainstPlugin(auditProject),
  ];
  return buildValidationResult({
    name: "import-boundaries",
    findings,
    coveredClauseIds: [
      "GRASSEYE-DOM-001-V1",
      "GRASSEYE-DOM-008-V1",
      "BLUEPRINT-01",
      "BLUEPRINT-03",
      "BLUEPRINT-05",
      "BLUEPRINT-11",
    ],
    passSummary: "visual mission, plugin, DOM core, and browser boundaries stay inside governed import seams.",
    failSummary: "DOM import graph crosses forbidden owner boundaries.",
  });
};
