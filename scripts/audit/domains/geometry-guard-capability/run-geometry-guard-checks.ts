import { createAuditProject } from "../_shared/ast-helpers.js";

import { geometryGuardInspectionUtils as support } from "./inspection-utils.js";
import { loadGeometryPresenceState } from "./presence-state.js";
import { buildGeometryFindings, createGeometryPhaseState } from "./run-geometry-findings.js";
import { getGeometryForbiddenState } from "./run-geometry-forbidden-checks.js";
import { runJointResultContractCheck } from "./run-joint-result-contract-check.js";
import { runLawOwnershipChecks } from "./run-law-ownership-checks.js";
import {
  createGeometrySourceState,
  getGeometryChildImplementationViolations,
  getGeometryRequiredShapeState,
} from "./run-geometry-required-shape-checks.js";

export async function runGeometryGuardChecks() {
  const project = createAuditProject();
  const lawOwnership = runLawOwnershipChecks(project);
  const jointResultContract = await runJointResultContractCheck();
  const geometryFiles = support.collectGeometryFiles(project);
  const presenceState = await loadGeometryPresenceState(project);
  const sourceState = createGeometrySourceState(project);
  const childImplementationViolations = getGeometryChildImplementationViolations(project);
  const requiredShapeState = getGeometryRequiredShapeState(sourceState, presenceState.requiredPresence, childImplementationViolations);
  const forbiddenState = getGeometryForbiddenState({
    project,
    geometryFiles,
    geometryFilePaths: presenceState.geometryFilePaths,
    state: sourceState,
    childImplementationViolations,
    forbiddenPresence: presenceState.forbiddenPresence,
  });

  return {
    findings: [
      ...buildGeometryFindings({ requiredPresence: presenceState.requiredPresence, forbiddenPresence: presenceState.forbiddenPresence, requiredShapeState, forbiddenState, childImplementationViolations }),
      ...lawOwnership.findings,
      ...jointResultContract.findings,
    ],
    phases: [
      ...createGeometryPhaseState(requiredShapeState.requiredShapePassed, forbiddenState),
      lawOwnership.phase,
      jointResultContract.phase,
    ],
  };
}