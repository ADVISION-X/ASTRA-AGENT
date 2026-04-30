import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { createMapPluginAuditProject } from "./ast-utils.js";
import { runAntiEscape } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShape } from "./required-shape.js";
import { runScorecardGate } from "./scorecard-gate.js";
import { createIntegrationAuditProject } from "../map-plugin-orchestration-integration/ast-utils.js";
import { runBoundaryAttack as runIntegrationBoundaryAttack } from "../map-plugin-orchestration-integration/boundary-attack.js";
import { runForbiddenShape as runIntegrationForbiddenShape } from "../map-plugin-orchestration-integration/forbidden-shape.js";
import { runRequiredShape as runIntegrationRequiredShape } from "../map-plugin-orchestration-integration/required-shape.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF";

const inspector: DomainInspector = async (context) => {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "map-plugin-package",
    inspectorId: "map-plugin-package-governance",
    inspectorEntry: "scripts/audit/domains/map-plugin-package/inspector.ts",
  });
  const foundationFindings = base.findings.filter((finding) => finding.message !== "Generated audit plan does not contain this owner.");
  const foundationPhase = foundationFindings.length === 0
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

  const project = createMapPluginAuditProject();
  const required = await runRequiredShape(project);
  const forbidden = await runForbiddenShape(project);
  const boundary = runBoundaryAttack(project);
  const antiEscape = await runAntiEscape(project, context);
  const scorecard = await runScorecardGate();
  const integrationProject = createIntegrationAuditProject();
  const integrationRequired = await runIntegrationRequiredShape(integrationProject);
  const integrationForbidden = await runIntegrationForbiddenShape(integrationProject);
  const integrationBoundary = runIntegrationBoundaryAttack(integrationProject);
  const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? {
        findings: [],
        phase: createPhase(
          "negative-proof-harness",
          "PASS",
          true,
          "Map package negative-proof harness was skipped for nested inspector execution.",
        ),
      }
    : await runNegativeProofHarness();

  const findings = [
    ...foundationFindings,
    ...required.findings,
    ...forbidden.findings,
    ...boundary.findings,
    ...antiEscape.findings,
    ...scorecard.findings,
    ...integrationRequired.findings,
    ...integrationForbidden.findings,
    ...integrationBoundary.findings,
    ...negativeProof.findings,
  ];

  const phases = [
    foundationPhase,
    required.phase,
    forbidden.phase,
    boundary.phase,
    antiEscape.phase,
    scorecard.phase,
    integrationRequired.phase,
    integrationForbidden.phase,
    integrationBoundary.phase,
    negativeProof.phase,
  ];

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
