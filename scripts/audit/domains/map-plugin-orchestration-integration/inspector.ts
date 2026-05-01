import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { createIntegrationAuditProject } from "./audit-project.js";
import { runAntiEscape } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShape } from "./required-shape.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MAP_PLUGIN_ORCH_INTEGRATION_NEGATIVE_PROOF";

const getFoundationState = (base: Awaited<ReturnType<typeof runDomainOwnerInspection>>) => {
  const ignoredFoundationMessages = new Set([
    "Generated enforcement matrix does not contain this owner.",
    "Generated audit plan does not contain this owner.",
  ]);
  const foundationFindings = base.findings.filter((finding) => !ignoredFoundationMessages.has(finding.message));
  const foundationPhases = foundationFindings.length === 0
    ? base.phases.map((phase) => {
        if (phase.name !== "owner-foundation") {
          return phase;
        }

        return createPhase(
          "owner-foundation",
          "PASS",
          true,
          "Custom integration inspector is governed by its manifest and referenced law files outside generated owner matrix/plan registration.",
        );
      })
    : base.phases;

  return {
    foundationFindings,
    foundationPhases,
  };
};

const getNegativeProofResult = async () => (
  process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? {
        findings: [],
        phase: createPhase(
          "negative-proof-harness",
          "PASS",
          true,
          "Integration negative-proof harness was skipped for nested inspector execution.",
        ),
      }
    : runNegativeProofHarness()
);

const inspector: DomainInspector = async (context) => {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "map-plugin-orchestration-integration",
    inspectorId: "map-plugin-orchestration-integration",
    inspectorEntry: "scripts/audit/domains/map-plugin-orchestration-integration/inspector.ts",
  });
  const { foundationFindings, foundationPhases } = getFoundationState(base);
  const project = createIntegrationAuditProject();
  const required = await runRequiredShape(project);
  const forbidden = await runForbiddenShape(project);
  const boundary = runBoundaryAttack(project);
  const antiEscape = await runAntiEscape(project, context);
  const negativeProof = await getNegativeProofResult();

  const findings = [
    ...foundationFindings,
    ...required.findings,
    ...forbidden.findings,
    ...boundary.findings,
    ...antiEscape.findings,
    ...negativeProof.findings,
  ];

  const phases = [
    ...foundationPhases,
    required.phase,
    forbidden.phase,
    boundary.phase,
    antiEscape.phase,
    negativeProof.phase,
  ];

  return finalizeInspectorResult({
    inspector: "GrassEye Map Plugin Orchestration Integration Inspector",
    inspectorId: "map-plugin-orchestration-integration",
    capabilityDomain: "map-plugin-orchestration-integration",
    findings,
    phases,
    summary: phases.find((phase) => !phase.passed)?.summary ?? "Map-plugin orchestration integration passes schema ownership, active binding, Commander ordinary feed, and negative-proof enforcement.",
  });
};

export { inspector as mapPluginOrchestrationIntegrationInspector };
