import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { LAW_IDS } from "./config.js";
import { hasForbiddenCapabilityImport } from "./import-rules.js";
import { createPostActionAuditProject, getOwnedSources, getRepoPath } from "./project-access.js";
import { leaksPrivatePostActionPath } from "./escape-rules.js";

export async function runBoundaryAttack(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];

  for (const sourceFile of getOwnedSources(project)) {
    if (hasForbiddenCapabilityImport(sourceFile)) {
      findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: getRepoPath(sourceFile), line: 1, severity: "fatal", message: "Post Action Verification must not import execution owners or foreign internals." }));
      break;
    }
  }

  const fullProject = createPostActionAuditProject();
  for (const sourceFile of fullProject.getSourceFiles()) {
    if (leaksPrivatePostActionPath(sourceFile)) {
      findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: getRepoPath(sourceFile), line: 1, severity: "fatal", message: "External code must not import post-action-verification runtime/* or children/* paths." }));
      break;
    }
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("boundary-attack", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Post Action Verification owner boundary is isolated." : "Post Action Verification owner boundary still leaks private or forbidden paths."),
  };
}