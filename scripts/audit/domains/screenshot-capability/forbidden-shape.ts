import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpressionWithStringLiteralArgument } from "../_shared/ast-module-path-queries.js";
import { hasCallExpressionPath, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { LAW_IDS, PATHS } from "./config.js";
import { getRepoPath, getScreenshotSources, getSource } from "./project-access.js";
import { contractLeaksInternalTypes, hasPublicIndexLeak, usesForbiddenCapabilityImport } from "./source-rules.js";

function collectOwnerShapeFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const screenshotSources = getScreenshotSources(project);
  const exportStarFile = screenshotSources.find((sourceFile) => sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport()));
  if (exportStarFile) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: getRepoPath(exportStarFile), line: 1, severity: "fatal", message: "Screenshot owner must not use export-star barrel escapes." }));
  }
  const capabilityCheckFile = screenshotSources.find((sourceFile) => getRepoPath(sourceFile).endsWith("capability-check.ts"));
  return capabilityCheckFile
    ? findings.concat(createFinding({ lawId: LAW_IDS.SHAPE, file: getRepoPath(capabilityCheckFile), line: 1, severity: "fatal", message: "Screenshot capability-check.ts files must not exist; enforcement must close through the owner inspector." }))
    : findings;
}

function collectBoundaryLeakFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const forbiddenCapabilityImport = getScreenshotSources(project).find((sourceFile) => usesForbiddenCapabilityImport(sourceFile));
  if (forbiddenCapabilityImport) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: getRepoPath(forbiddenCapabilityImport), line: 1, severity: "fatal", message: "Screenshot boundary must not import AI, mouse, geometry, forensics, or open internals." }));
  }
  const publicBoundaryLeak = [getSource(project, PATHS.ABILITY_GROUP), getSource(project, PATHS.CONTRACT)].find((sourceFile) => hasImportModuleSpecifier(sourceFile, "browser-controller"));
  return publicBoundaryLeak
    ? findings.concat(createFinding({ lawId: LAW_IDS.PUBLIC, file: getRepoPath(publicBoundaryLeak), line: 1, severity: "fatal", message: "Screenshot public surface must depend on governed ports, not BrowserController internals." }))
    : findings;
}

function collectContractAndIndexFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  if (contractLeaksInternalTypes(getSource(project, PATHS.CONTRACT))) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Screenshot public contract must not expose runtime context, child contracts, or execution plans." }));
  }
  return hasPublicIndexLeak(getSource(project, PATHS.INDEX))
    ? findings.concat(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.INDEX, line: 1, severity: "fatal", message: "Screenshot public index must not leak adapters, ports, runtime, or child internals." }))
    : findings;
}

function collectDirectPrimitiveFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const screenshotSources = getScreenshotSources(project);
  const childImplementationFiles = screenshotSources.filter((sourceFile) => getRepoPath(sourceFile).includes("/children/") && getRepoPath(sourceFile).endsWith("/implementation.ts"));
  const directBrowserCapture = childImplementationFiles.find((sourceFile) => hasCallExpressionPath(sourceFile, ["browserController", "screenshotRegion"]));
  if (directBrowserCapture) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: getRepoPath(directBrowserCapture), line: 1, severity: "fatal", message: "Screenshot children must not call browserController.screenshotRegion directly." }));
  }
  const directScreenCapture = screenshotSources
    .filter((sourceFile) => getRepoPath(sourceFile).includes("/children/") || getRepoPath(sourceFile).includes("/shared/"))
    .find((sourceFile) => hasCallExpressionWithStringLiteralArgument(sourceFile, ["execFile"], "screencapture"));
  return directScreenCapture
    ? findings.concat(createFinding({ lawId: LAW_IDS.BOUNDARY, file: getRepoPath(directScreenCapture), line: 1, severity: "fatal", message: "Screenshot children and shared files must not invoke screencapture directly." }))
    : findings;
}

export function runForbiddenShape(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectOwnerShapeFindings(project),
    ...collectBoundaryLeakFindings(project),
    ...collectContractAndIndexFindings(project),
    ...collectDirectPrimitiveFindings(project),
  ];

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