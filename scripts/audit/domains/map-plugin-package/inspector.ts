import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { createMapPluginAuditProject } from "./audit-project.js";
import { runAntiEscape } from "./anti-escape.js";
import { runAuthoringInputPackage } from "./authoring-input-package.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runMuscleMemoryGovernance } from "./muscle-memory-governance.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShape } from "./required-shape.js";
import { runRoutePlanEntrySpine } from "./route-plan-entry-spine.js";
import { runScorecardGate } from "./scorecard-gate.js";
import { runStartupPreparationEntrySpine } from "./startup-preparation-entry-spine.js";
import { runTaskTemplateRunLimitGovernance } from "./task-template-run-limit-governance.js";
import { runIntegrationPhaseBundle } from "../map-plugin-orchestration-integration/phase-bundle.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF";

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

const runDirectGovernancePhases = async (project: ReturnType<typeof createMapPluginAuditProject>) => {
  const required = await runRequiredShape(project);
  const authoringInput = await runAuthoringInputPackage(project);
  const forbidden = await runForbiddenShape(project);
  const taskTemplateRunLimits = await runTaskTemplateRunLimitGovernance(project);
  const boundary = runBoundaryAttack(project);
  const routePlanEntry = await runRoutePlanEntrySpine();
  const startupPreparation = await runStartupPreparationEntrySpine();
  const muscleMemory = await runMuscleMemoryGovernance();
  return { required, authoringInput, forbidden, taskTemplateRunLimits, boundary, routePlanEntry, startupPreparation, muscleMemory };
};

const runSupplementalPhases = async (project: ReturnType<typeof createMapPluginAuditProject>, context: Parameters<DomainInspector>[0]) => {
  const antiEscape = await runAntiEscape(project, context);
  const scorecard = await runScorecardGate();
  const integrationPhases = await runIntegrationPhaseBundle();

  return { antiEscape, scorecard, integrationPhases };
};

const runNegativeProofPhase = async () => {
  return process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? {
        findings: [],
        phase: createPhase(
          "negative-proof-harness",
          "PASS",
          true,
          "Map package negative-proof harness was skipped for nested inspector execution.",
        ),
      }
    : runNegativeProofHarness();
};

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

const collectFindings = (input: {
  foundationFindings: Awaited<ReturnType<typeof inspectFoundation>>["findings"];
  directPhases: Awaited<ReturnType<typeof runDirectGovernancePhases>>;
  supplementalPhases: Awaited<ReturnType<typeof runSupplementalPhases>>;
  negativeProof: Awaited<ReturnType<typeof runNegativeProofPhase>>;
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
  ...input.negativeProof.findings,
];

const collectPhases = (input: {
  foundationPhase: Awaited<ReturnType<typeof inspectFoundation>>["phase"];
  directPhases: Awaited<ReturnType<typeof runDirectGovernancePhases>>;
  supplementalPhases: Awaited<ReturnType<typeof runSupplementalPhases>>;
  negativeProof: Awaited<ReturnType<typeof runNegativeProofPhase>>;
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
  input.negativeProof.phase,
];

const inspector: DomainInspector = async (context) => {
  const foundation = await inspectFoundation(context);
  const project = createMapPluginAuditProject();
  const directPhases = await runDirectGovernancePhases(project);
  const supplementalPhases = await runSupplementalPhases(project, context);
  const negativeProof = await runNegativeProofPhase();
  const findings = collectFindings({
    foundationFindings: foundation.findings,
    directPhases,
    supplementalPhases,
    negativeProof,
  });
  const phases = collectPhases({
    foundationPhase: foundation.phase,
    directPhases,
    supplementalPhases,
    negativeProof,
  });

  return finalizeInspectorResult({
    inspector: "GrassEye Map Plugin Package Governance Inspector",
    inspectorId: "map-plugin-package-governance",
    capabilityDomain: "map-plugin-package",
    findings,
    phases,
    summary: phases.find((phase) => !phase.passed)?.summary ?? "Map package governance passes direct parsed-data, boundary, and negative-proof enforcement.",
  });
};

export { inspector as mapPluginPackageInspector };
