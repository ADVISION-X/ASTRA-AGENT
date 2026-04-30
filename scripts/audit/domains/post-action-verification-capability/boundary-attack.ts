import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createAuditProject } from "../_shared/ast-helpers.js";
import { getOwnedSources, hasForbiddenCapabilityImport, leaksPrivatePostActionPath, ROOT } from "./ast-utils.js";

export async function runBoundaryAttack(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];

  for (const sourceFile of getOwnedSources(project)) {
    if (hasForbiddenCapabilityImport(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V1", file: sourceFile.getFilePath(), line: 1, severity: "fatal", message: "Post Action Verification must not import execution owners or foreign internals." }));
      break;
    }
  }

  const fullProject = createAuditProject();
  for (const sourceFile of fullProject.getSourceFiles()) {
    if (leaksPrivatePostActionPath(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file: sourceFile.getFilePath(), line: 1, severity: "fatal", message: "External code must not import post-action-verification runtime/* or children/* paths." }));
      break;
    }
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("boundary-attack", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Post Action Verification owner boundary is isolated." : "Post Action Verification owner boundary still leaks private or forbidden paths."),
  };
}