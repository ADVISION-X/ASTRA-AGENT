import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { createMapPluginAuditProject } from "./audit-project.js";
import {
  runAuthoringInputPackage,
  runBoundaryAttack,
  runForbiddenShape,
  runMuscleMemoryGovernance,
  runRequiredShape,
  runRoutePlanEntrySpine,
  runStartupPreparationEntrySpine,
  runTaskTemplateRunLimitGovernance,
} from "./direct-phase-runners.js";
import {
  runAntiEscape,
  runIntegrationPhaseBundle,
  runScorecardGate,
} from "./supplemental-phase-runners.js";

const buildFoundationPhase = (foundationFindings: Awaited<ReturnType<typeof runDomainOwnerInspection>>["findings"]) =>
  foundationFindings.length === 0
    ? createPhase(
        "owner-foundation",
        "PASS",
        true,
        "Manifest and generated matrix align for the standalone non-phase-gated map package inspector.",
      )
    : createPhase(
        "owner-foundation",
        "LAW-SCRIPT DRIFT",
        false,
        "Map package manifest or generated owner artifacts drifted away from the governed inspector chain.",
      );

const inspectFoundation = async (context: Parameters<DomainInspector>[0]) => {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "map-plugin-package",
    inspectorId: "map-plugin-package-governance",
    inspectorEntry: "scripts/audit/domains/map-plugin-package/inspector.ts",
  });
  const findings = base.findings.filter((finding) => finding.message !== "Generated audit plan does not contain this owner.");
  return {
    findings,
    phase: buildFoundationPhase(findings),
  };
};

const runDirectGovernancePhases = async (project: ReturnType<typeof createMapPluginAuditProject>) => {
  const required = await runRequiredShape(project);
  const authoringInput = await runAuthoringInputPackage(project);
  const forbidden = await runForbiddenShape(project);
  const taskTemplateRunLimits = await runTaskTemplateRunLimitGovernance(project);
  const boundary = runBoundaryAttack(project);
  const routePlanEntry = await runRoutePlanEntrySpine();
  const startupPreparation = await runStartupPreparationEntrySpine();
  const muscleMemory = await runMuscleMemoryGovernance();

  return {
    required,
    authoringInput,
    forbidden,
    taskTemplateRunLimits,
    boundary,
    routePlanEntry,
    startupPreparation,
    muscleMemory,
  };
};

const runSupplementalGovernancePhases = async (
  project: ReturnType<typeof createMapPluginAuditProject>,
  context: Parameters<DomainInspector>[0],
) => {
  const antiEscape = await runAntiEscape(project, context);
  const scorecard = await runScorecardGate();
  const integrationPhases = await runIntegrationPhaseBundle();

  return { antiEscape, scorecard, integrationPhases };
};

const collectFindings = (input: {
  foundationFindings: Awaited<ReturnType<typeof inspectFoundation>>["findings"];
  directPhases: Awaited<ReturnType<typeof runDirectGovernancePhases>>;
  supplementalPhases: Awaited<ReturnType<typeof runSupplementalGovernancePhases>>;
}) => [
  ...input.foundationFindings,
  ...input.directPhases.required.findings,
  ...input.directPhases.authoringInput.findings,
  ...input.directPhases.forbidden.findings,
  ...input.directPhases.taskTemplateRunLimits.findings,
  ...input.directPhases.boundary.findings,
  ...input.directPhases.routePlanEntry.findings,
  ...input.directPhases.startupPreparation.findings,
  ...input.directPhases.muscleMemory.findings,
  ...input.supplementalPhases.antiEscape.findings,
  ...input.supplementalPhases.scorecard.findings,
  ...input.supplementalPhases.integrationPhases.required.findings,
  ...input.supplementalPhases.integrationPhases.forbidden.findings,
  ...input.supplementalPhases.integrationPhases.boundary.findings,
];

const collectPhases = (input: {
  foundationPhase: Awaited<ReturnType<typeof inspectFoundation>>["phase"];
  directPhases: Awaited<ReturnType<typeof runDirectGovernancePhases>>;
  supplementalPhases: Awaited<ReturnType<typeof runSupplementalGovernancePhases>>;
}) => [
  input.foundationPhase,
  input.directPhases.required.phase,
  input.directPhases.authoringInput.phase,
  input.directPhases.forbidden.phase,
  input.directPhases.taskTemplateRunLimits.phase,
  input.directPhases.boundary.phase,
  input.directPhases.routePlanEntry.phase,
  input.directPhases.startupPreparation.phase,
  input.directPhases.muscleMemory.phase,
  input.supplementalPhases.antiEscape.phase,
  input.supplementalPhases.scorecard.phase,
  input.supplementalPhases.integrationPhases.required.phase,
  input.supplementalPhases.integrationPhases.forbidden.phase,
  input.supplementalPhases.integrationPhases.boundary.phase,
];

const inspector: DomainInspector = async (context) => {
  const foundation = await inspectFoundation(context);
  const project = createMapPluginAuditProject();
  const directPhases = await runDirectGovernancePhases(project);
  const supplementalPhases = await runSupplementalGovernancePhases(project, context);
  const findings = collectFindings({
    foundationFindings: foundation.findings,
    directPhases,
    supplementalPhases,
  });
  const phases = collectPhases({
    foundationPhase: foundation.phase,
    directPhases,
    supplementalPhases,
  });

  return finalizeInspectorResult({
    inspector: "GrassEye Map Plugin Package Governance Inspector",
    inspectorId: "map-plugin-package-governance",
    capabilityDomain: "map-plugin-package",
    findings,
    phases,
    summary: phases.find((phase) => !phase.passed)?.summary ?? "Map package governance passes direct parsed-data, boundary, and integration enforcement.",
  });
};

export { inspector as mapPluginPackageInspector };
