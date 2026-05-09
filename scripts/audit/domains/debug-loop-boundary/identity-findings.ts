import type { Finding, InspectorContext } from "../../core/schema.js";

import { buildFinding, extractSection } from "./inspection-utils.js";

const DOMAIN = "debug-loop-boundary";
const KERNEL_FILE = ".github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md";
const BASELINE_FILE = "docs/法案辅助文件/GrassEye 法案冻结基线.md";
const DEBUG_LOOP_OWNER_PATTERN = /debug-loop-controller|debug-loop-boundary|^debug-loop$/im;

const collectPhaseGateIdentityFindings = (context: InspectorContext): Finding[] => {
  const findings: Finding[] = [];
  const phaseGateGovernanceDomains = context.phaseGate.localDevelopmentGovernanceDomains ?? [];
  const debugLoopOwner = context.matrixOwnersByDomain.get(DOMAIN);

  if (!phaseGateGovernanceDomains.includes(DOMAIN)) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V1", file: "scripts/audit/phase-gates/phase-05-final-delivery-debug.json", line: 1, message: "debug-loop-boundary must stay in localDevelopmentGovernanceDomains during phase-five final delivery debugging." }));
  if (context.phaseGate.activeLawDomains.includes(DOMAIN)) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V1", file: "scripts/audit/phase-gates/phase-05-final-delivery-debug.json", line: 1, message: "debug-loop-boundary must not re-enter activeLawDomains in the current phase gate." }));
  if (!debugLoopOwner) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V1", file: "scripts/audit/generated/enforcement-matrix.generated.json", line: 1, message: "debug-loop-boundary must remain present in the enforcement matrix as a local-development-governance owner." }));
  if (debugLoopOwner && debugLoopOwner.ownerKind !== "local-development-governance") findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V1", file: "scripts/audit/generated/enforcement-matrix.generated.json", line: 1, message: "debug-loop-boundary must be classified as local-development-governance in the enforcement matrix." }));
  if (context.auditPlan.owners.some((owner) => owner.capabilityDomain === DOMAIN)) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V1", file: "scripts/audit/generated/audit-plan.generated.json", line: 1, message: "debug-loop-boundary must stay out of the generated audit plan main chain." }));

  return findings;
};

const collectKernelIdentityFindings = (kernelContent: string): Finding[] => {
  const findings: Finding[] = [];
  const kernelGroups = extractSection(kernelContent, "## Active Ability Groups");
  const kernelTooling = extractSection(kernelContent, "## Local Development Tooling");

  if (DEBUG_LOOP_OWNER_PATTERN.test(kernelGroups)) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V1", file: KERNEL_FILE, line: 1, message: "Kernel active ability groups must not include debug-loop." }));
  if (!/debug-loop-controller/.test(kernelTooling)) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V1", file: KERNEL_FILE, line: 1, message: "Kernel local development tooling must keep debug-loop-controller only as tooling." }));

  return findings;
};

const collectBaselineIdentityFindings = (baselineContent: string): Finding[] => {
  const findings: Finding[] = [];
  const baselineGroups = extractSection(baselineContent, "## 14 个 active ability groups");
  const baselineTooling = extractSection(baselineContent, "## 本地开发工具");

  if (DEBUG_LOOP_OWNER_PATTERN.test(baselineGroups)) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V1", file: BASELINE_FILE, line: 1, message: "Frozen baseline active ability groups must not include debug-loop." }));
  if (!/debug-loop-controller/.test(baselineTooling)) findings.push(buildFinding({ lawId: "GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V1", file: BASELINE_FILE, line: 1, message: "Frozen baseline local development tooling must keep debug-loop-controller only as tooling." }));

  return findings;
};

export const collectIdentityFindings = (
  context: InspectorContext,
  kernelContent: string,
  baselineContent: string,
): Finding[] => ([
  ...collectPhaseGateIdentityFindings(context),
  ...collectKernelIdentityFindings(kernelContent),
  ...collectBaselineIdentityFindings(baselineContent),
]);