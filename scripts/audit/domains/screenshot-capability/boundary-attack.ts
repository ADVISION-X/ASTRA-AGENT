import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS } from "./config.js";
import { getRepoPath, getScreenshotSources } from "./project-access.js";
import { leaksPrivateScreenshotPath, usesForbiddenCapabilityImport } from "./source-rules.js";

export function runBoundaryAttack(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    if (leaksPrivateScreenshotPath(sourceFile)) {
      findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: getRepoPath(sourceFile), line: 1, severity: "fatal", message: "External code must not import screenshot runtime, child, port, or adapter internals except the composition root adapter entry." }));
    }
  }

  for (const sourceFile of getScreenshotSources(project)) {
    if (usesForbiddenCapabilityImport(sourceFile)) {
      findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: getRepoPath(sourceFile), line: 1, severity: "fatal", message: "Screenshot owner must not cross the boundary into AI, mouse, geometry, forensics, or open internals." }));
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "boundary-attack",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Screenshot owner boundary is isolated to the public execute surface and composition-root adapters."
        : "Screenshot owner boundary still leaks private internals or forbidden cross-owner imports.",
    ),
  };
}