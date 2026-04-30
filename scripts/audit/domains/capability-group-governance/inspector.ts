import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectCodeTopology } from "../code-topology/components/inspect-code-topology.js";
import { runAbilityContractChecks } from "./run-ability-contract-checks.js";
import { runBoundaryImportChecks } from "./run-boundary-import-checks.js";
import { runOwnerRuntimeProofChecks } from "./run-owner-runtime-proof-checks.js";
import { runRetiredRootChecks } from "./run-retired-root-checks.js";

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
  ],
  pendingSummary: "capability-group-governance owner surface is missing law or blueprint truth",
  implementedSummary: "capability-group-governance owner surface enforces constitutional boundaries and topology checks",
  extraChecks: async (context) => {
    const project = getAuditProject();
    const findings: Finding[] = [];
    const phases: InspectorPhase[] = [];

    const retiredRootChecks = await runRetiredRootChecks(project);
    findings.push(...retiredRootChecks.findings);
    phases.push(...retiredRootChecks.phases);

    const abilityContracts = await runAbilityContractChecks();
    findings.push(...abilityContracts.findings);
    phases.push(...abilityContracts.phases);

    const boundaryImports = runBoundaryImportChecks(project);
    findings.push(...boundaryImports.findings);
    phases.push(...boundaryImports.phases);

    const ownerRuntimeProofChecks = runOwnerRuntimeProofChecks(project);
    findings.push(...ownerRuntimeProofChecks.findings);
    phases.push(...ownerRuntimeProofChecks.phases);

    const topology = await inspectCodeTopology(context);
    findings.push(...topology.findings);
    phases.push(...topology.phases);

    return { findings, phases };
  },
});
