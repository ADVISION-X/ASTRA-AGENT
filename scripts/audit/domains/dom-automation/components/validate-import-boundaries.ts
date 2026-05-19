import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  buildValidationResult,
  isRepoPathWithin,
  resolveImportedDeclarationPaths,
  resolveModuleTargetPath,
  type DomAutomationAuditProject,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";

const DOM_FACADE_PATH = "src/capabilities/dom-automation/index.ts";
const BROWSER_CONTROLLER_PATH = "src/lib/browser/browser-controller.ts";
const FORBIDDEN_PLUGIN_TARGETS = [
  "src/capabilities/dom-automation/runtime",
  "src/lib/browser/current-chrome-browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller-primitives.ts",
] as const;

const importFinding = (
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
): Finding => createFinding({
  lawId,
  file,
  line,
  severity: "fatal",
  message,
  hint,
});

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

const validatePluginImports = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  for (const sourceFile of auditProject.sourceFiles.plugin) {
    const repoPath = sourceFile.getFilePath().replace(`${auditProject.project.getDirectoryOrThrow(".").getPath()}/`, "");
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const specifier = importDeclaration.getModuleSpecifierValue();
      if (!specifier.startsWith(".")) {
        if (specifier === "zod") {
          continue;
        }
        findings.push(importFinding(
          "GRASSEYE-DOM-008-V1",
          repoPath,
          importDeclaration.getStartLineNumber(),
          `plugin imports unsupported external module: ${specifier}`,
          "Amazon plugin may only import DOM facade, BrowserController type, its own files, and zod.",
        ));
        continue;
      }
      const moduleTargetPath = resolveModuleTargetPath(importDeclaration);
      if (!moduleTargetPath) {
        continue;
      }
      if (isRepoPathWithin(moduleTargetPath, "src/plugins/amazon-invoice-upload")) {
        continue;
      }
      if (moduleTargetPath === DOM_FACADE_PATH) {
        continue;
      }
      if (moduleTargetPath === BROWSER_CONTROLLER_PATH) {
        if (importDeclaration.getImportClause()?.isTypeOnly() !== true) {
          findings.push(importFinding(
            "GRASSEYE-DOM-008-V1",
            repoPath,
            importDeclaration.getStartLineNumber(),
            "plugin imports BrowserController as runtime code instead of type-only contract",
            "Keep BrowserController imported as a type-only boundary.",
          ));
        }
        continue;
      }
      if (FORBIDDEN_PLUGIN_TARGETS.some((target) => isRepoPathWithin(moduleTargetPath, target))) {
        findings.push(importFinding(
          "GRASSEYE-DOM-008-V1",
          repoPath,
          importDeclaration.getStartLineNumber(),
          `plugin imports forbidden private DOM or browser implementation: ${moduleTargetPath}`,
          "Amazon plugin must call DOM facade only, never runtime or browser primitives.",
        ));
        continue;
      }
      findings.push(importFinding(
        "GRASSEYE-DOM-008-V1",
        repoPath,
        importDeclaration.getStartLineNumber(),
        `plugin imports forbidden module outside its allowed boundary: ${moduleTargetPath}`,
        "Keep Amazon plugin scoped to its own files, DOM facade, BrowserController type, and zod.",
      ));
    }
  }
  return findings;
};

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
      if (isRepoPathWithin(moduleTargetPath, "src/plugins/amazon-invoice-upload")) {
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

export const validateImportBoundaries = (
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