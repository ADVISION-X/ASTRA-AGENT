import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectCodeTopology } from "../code-topology/components/inspect-code-topology.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runAiOnlyCognitionSurfaceChecks } from "./run-ai-only-cognition-surface-checks.js";
import { runNegativeProofWiringChecks } from "./run-negative-proof-wiring-checks.js";
import { runAiOnlyMediaChangeChecks } from "./run-ai-only-media-change-checks.js";
import { runAbilityContractChecks } from "./run-ability-contract-checks.js";
import { runBoundaryImportChecks } from "./run-boundary-import-checks.js";
import { runOwnerRuntimeProofChecks } from "./run-owner-runtime-proof-checks.js";
import { runPackageAuditScriptChecks } from "./run-package-audit-script-checks.js";
import { runRetiredRootChecks } from "./run-retired-root-checks.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_CAPABILITY_GROUP_GOVERNANCE_NEGATIVE_PROOF";
const NEGATIVE_PROOF_PHASE_ENV = "GRASSEYE_CAPABILITY_GROUP_NEGATIVE_PROOF_PHASE";

type TargetNegativeProofPhase =
  | "package-audit-entrypoints"
  | "negative-proof-wiring"
  | "ai-only-media-change-boundary"
  | "ai-only-cognition-surface-boundary";

const shouldRunNegativeProofPhase = (phase: TargetNegativeProofPhase): boolean => {
  const selectedPhase = process.env[NEGATIVE_PROOF_PHASE_ENV];
  return selectedPhase === undefined || selectedPhase === phase;
};

const shouldRunFullInspectorSurface = (): boolean => process.env[NEGATIVE_PROOF_PHASE_ENV] === undefined;

export const capabilityGroupGovernanceInspector = createPendingDomainInspector({
  inspector: "GrassEye Capability Group Governance Owner Inspector",
  inspectorId: "capability-group-governance-owner",
  capabilityDomain: "capability-group-governance",
  inspectorEntry: "scripts/audit/domains/capability-group-governance/inspector.ts",
  ownedPaths: [
    ".github/instructions/cursor-rules/modules/module-capability-group-governance.instructions.md",
    ".github/instructions/cursor-rules/modules/module-code-topology.instructions.md",
    "docs/法案辅助文件/GrassEye 能力组与子能力总纲施工图.md",
    "docs/法案辅助文件/GrassEye 文件路径与阶段目录施工图.md",
    "scripts/audit/domains/capability-group-governance/negative-proof-harness.ts",
  ],
  pendingSummary: "capability-group-governance owner surface is missing law or blueprint truth",
  implementedSummary: "capability-group-governance owner surface enforces constitutional boundaries and topology checks",
  extraChecks: async (context) => {
    const project = getAuditProject();
    const findings: Finding[] = [];
    const phases: InspectorPhase[] = [];

    if (shouldRunNegativeProofPhase("package-audit-entrypoints")) {
      const packageAuditScriptChecks = await runPackageAuditScriptChecks();
      findings.push(...packageAuditScriptChecks.findings);
      phases.push(...packageAuditScriptChecks.phases);
    }

    if (shouldRunFullInspectorSurface()) {
      const retiredRootChecks = await runRetiredRootChecks(project);
      findings.push(...retiredRootChecks.findings);
      phases.push(...retiredRootChecks.phases);
    }

    if (shouldRunFullInspectorSurface()) {
      const abilityContracts = await runAbilityContractChecks();
      findings.push(...abilityContracts.findings);
      phases.push(...abilityContracts.phases);
    }

    if (shouldRunFullInspectorSurface()) {
      const boundaryImports = runBoundaryImportChecks(project);
      findings.push(...boundaryImports.findings);
      phases.push(...boundaryImports.phases);
    }

    if (shouldRunNegativeProofPhase("ai-only-media-change-boundary")) {
      const aiOnlyMediaChangeChecks = runAiOnlyMediaChangeChecks(project);
      findings.push(...aiOnlyMediaChangeChecks.findings);
      phases.push(...aiOnlyMediaChangeChecks.phases);
    }

    if (shouldRunNegativeProofPhase("ai-only-cognition-surface-boundary")) {
      const aiOnlyCognitionSurfaceChecks = runAiOnlyCognitionSurfaceChecks(project);
      findings.push(...aiOnlyCognitionSurfaceChecks.findings);
      phases.push(...aiOnlyCognitionSurfaceChecks.phases);
    }

    if (shouldRunFullInspectorSurface()) {
      const ownerRuntimeProofChecks = runOwnerRuntimeProofChecks(project);
      findings.push(...ownerRuntimeProofChecks.findings);
      phases.push(...ownerRuntimeProofChecks.phases);
    }

    if (shouldRunNegativeProofPhase("negative-proof-wiring")) {
      const negativeProofWiring = await runNegativeProofWiringChecks(project);
      findings.push(...negativeProofWiring.findings);
      phases.push(...negativeProofWiring.phases);
    }

    if (shouldRunFullInspectorSurface()) {
      const topology = await inspectCodeTopology(context);
      findings.push(...topology.findings);
      phases.push(...topology.phases);
    }

    const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
      ? {
          findings: [],
          phase: {
            name: "negative-proof-harness",
            classification: "PASS" as const,
            passed: true,
            summary: "Capability-group-governance negative-proof harness was skipped for nested inspector execution.",
          },
        }
      : await runNegativeProofHarness();
    findings.push(...negativeProof.findings);
    phases.push(negativeProof.phase);

    return { findings, phases };
  },
});
