import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { runCapabilityGroupGovernanceExtraChecks } from "./extra-checks.js";

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
  extraChecks: runCapabilityGroupGovernanceExtraChecks,
});
