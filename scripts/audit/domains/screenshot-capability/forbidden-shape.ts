import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpressionPath, hasCallExpressionWithStringLiteralArgument, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";
import { contractLeaksInternalTypes, getRepoPath, getScreenshotSources, getSource, hasPublicIndexLeak, usesForbiddenCapabilityImport, ROOT } from "./ast-utils.js";

export function runForbiddenShape(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];
  const screenshotSources = getScreenshotSources(project);

  const exportStarFile = screenshotSources.find((sourceFile) => sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport()));
  if (exportStarFile) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-004-V1",
      file: getRepoPath(exportStarFile),
      line: 1,
      severity: "fatal",
      message: "Screenshot owner must not use export-star barrel escapes.",
    }));
  }

  const capabilityCheckFile = screenshotSources.find((sourceFile) => getRepoPath(sourceFile).endsWith("capability-check.ts"));
  if (capabilityCheckFile) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-004-V1",
      file: getRepoPath(capabilityCheckFile),
      line: 1,
      severity: "fatal",
      message: "Screenshot capability-check.ts files must not exist; enforcement must close through the owner inspector.",
    }));
  }

  const forbiddenCapabilityImport = screenshotSources.find((sourceFile) => usesForbiddenCapabilityImport(sourceFile));
  if (forbiddenCapabilityImport) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-002-V1",
      file: getRepoPath(forbiddenCapabilityImport),
      line: 1,
      severity: "fatal",
      message: "Screenshot boundary must not import AI, mouse, geometry, forensics, or open internals.",
    }));
  }

  const publicBoundaryLeak = [
    getSource(project, `${ROOT}/ability-group.ts`),
    getSource(project, `${ROOT}/contract.ts`),
  ].find((sourceFile) => hasImportModuleSpecifier(sourceFile, "browser-controller"));
  if (publicBoundaryLeak) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1",
      file: getRepoPath(publicBoundaryLeak),
      line: 1,
      severity: "fatal",
      message: "Screenshot public surface must depend on governed ports, not BrowserController internals.",
    }));
  }

  const contractSource = getSource(project, `${ROOT}/contract.ts`);
  if (contractLeaksInternalTypes(contractSource)) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1",
      file: `${ROOT}/contract.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot public contract must not expose runtime context, child contracts, or execution plans.",
    }));
  }

  const indexSource = getSource(project, `${ROOT}/index.ts`);
  if (hasPublicIndexLeak(indexSource)) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1",
      file: `${ROOT}/index.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot public index must not leak adapters, ports, runtime, or child internals.",
    }));
  }

  const childImplementationFiles = screenshotSources.filter((sourceFile) => getRepoPath(sourceFile).includes("/children/") && getRepoPath(sourceFile).endsWith("/implementation.ts"));
  const directBrowserCapture = childImplementationFiles.find((sourceFile) => hasCallExpressionPath(sourceFile, ["browserController", "screenshotRegion"]));
  if (directBrowserCapture) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-002-V1",
      file: getRepoPath(directBrowserCapture),
      line: 1,
      severity: "fatal",
      message: "Screenshot children must not call browserController.screenshotRegion directly.",
    }));
  }

  const directScreenCapture = screenshotSources
    .filter((sourceFile) => getRepoPath(sourceFile).includes("/children/") || getRepoPath(sourceFile).includes("/shared/"))
    .find((sourceFile) => hasCallExpressionWithStringLiteralArgument(sourceFile, ["execFile"], "screencapture"));
  if (directScreenCapture) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-002-V1",
      file: getRepoPath(directScreenCapture),
      line: 1,
      severity: "fatal",
      message: "Screenshot children and shared files must not invoke screencapture directly.",
    }));
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Screenshot forbidden barrels, runtime leaks, and direct primitive escapes are blocked."
        : "Screenshot still exposes one or more forbidden public or primitive shapes.",
    ),
  };
}