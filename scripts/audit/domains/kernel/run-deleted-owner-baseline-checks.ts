import { readJsonFile, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

type DeletedOwnerRequirement = {
  requirementId: string;
  label: string;
  deletedDomain?: string;
  expectedRehomedDomain?: string;
};

type AuditPlanOwner = {
  capabilityDomain?: string;
};

type AuditPlan = {
  owners?: AuditPlanOwner[];
};

const DELETED_OWNER_REQUIREMENTS: DeletedOwnerRequirement[] = [
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-001", label: "local-data", deletedDomain: "local-data" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-002", label: "localization", deletedDomain: "localization" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-003", label: "platform-action as action owner", deletedDomain: "platform-action", expectedRehomedDomain: "open-capability" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-004", label: "local-ai-runtime as independent owner", deletedDomain: "local-ai-runtime", expectedRehomedDomain: "ai-capability" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-005", label: "local-browser-session as independent owner", deletedDomain: "local-browser-session", expectedRehomedDomain: "open-capability" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-006", label: "local-app-shell as independent owner", deletedDomain: "local-app-shell", expectedRehomedDomain: "commander-console-capability" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-007", label: "startup-entrypoint as independent owner", deletedDomain: "startup-entrypoint", expectedRehomedDomain: "commander-console-capability" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-008", label: "structured-logging as independent owner", deletedDomain: "structured-logging", expectedRehomedDomain: "forensics-persistence-capability" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-009", label: "local-persistence-schema as independent owner", deletedDomain: "local-persistence-schema", expectedRehomedDomain: "forensics-persistence-capability" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-010", label: "multi-frame-evidence as independent owner", deletedDomain: "multi-frame-evidence" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-011", label: "code-topology as independent owner", deletedDomain: "code-topology", expectedRehomedDomain: "capability-group-governance" },
  { requirementId: "K01-BLUEPRINT-01-SECTION-008-REQ-012", label: "code-purity as independent owner", deletedDomain: "code-purity", expectedRehomedDomain: "audit-system" },
] as const;

const createRequirementFinding = (input: {
  requirementId: string;
  message: string;
  detail?: string;
}): Finding => createFinding({
  lawId: input.requirementId,
  file: kernelInspectionConstants.BLUEPRINT_FILE,
  line: 1,
  severity: "fatal",
  message: input.message,
  ...(input.detail ? { detail: input.detail } : {}),
});

const parseBulletSection = (content: string, heading: string): string[] => {
  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) {
    return [];
  }

  const items: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (!line) {
      continue;
    }
    if (line.startsWith("## ")) {
      break;
    }
    if (line.startsWith("- ")) {
      items.push(line.slice(2).trim());
    }
  }

  return items;
};

export async function runDeletedOwnerBaselineChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const [blueprintContent, auditPlan] = await Promise.all([
    readTextFile(pathFromRepoRoot(kernelInspectionConstants.BLUEPRINT_FILE)),
    readJsonFile<AuditPlan>(pathFromRepoRoot("scripts/audit/generated/audit-plan.generated.json")),
  ]);
  const deletedOwnerLines = parseBulletSection(blueprintContent, "## 已删除 active owner");
  const auditPlanDomains = new Set((auditPlan.owners ?? []).flatMap((owner) => owner.capabilityDomain ? [owner.capabilityDomain] : []));
  const findings: Finding[] = [];

  for (const requirement of DELETED_OWNER_REQUIREMENTS) {
    if (!deletedOwnerLines.includes(requirement.label)) {
      findings.push(createRequirementFinding({
        requirementId: requirement.requirementId,
        message: "Frozen baseline deleted active owner list drifted away from the governed baseline.",
        detail: `missing deleted-owner line: ${requirement.label}`,
      }));
      continue;
    }

    if (requirement.deletedDomain && auditPlanDomains.has(requirement.deletedDomain)) {
      findings.push(createRequirementFinding({
        requirementId: requirement.requirementId,
        message: "Deleted active owner must not reappear as an audit-plan owner.",
        detail: `deletedDomain=${requirement.deletedDomain}`,
      }));
    }

    if (requirement.expectedRehomedDomain && !auditPlanDomains.has(requirement.expectedRehomedDomain)) {
      findings.push(createRequirementFinding({
        requirementId: requirement.requirementId,
        message: "Deleted active owner must re-home under its governed parent owner rather than revive independently.",
        detail: `expectedRehomedDomain=${requirement.expectedRehomedDomain}`,
      }));
    }
  }

  const deletedLabels = new Set(DELETED_OWNER_REQUIREMENTS.map((requirement) => requirement.label));
  const unexpectedDeletedLines = deletedOwnerLines.filter((line) => !deletedLabels.has(line));
  if (unexpectedDeletedLines.length > 0) {
    findings.push(createRequirementFinding({
      requirementId: DELETED_OWNER_REQUIREMENTS[0]!.requirementId,
      message: "Frozen baseline deleted active owner list contains unexpected entries.",
      detail: unexpectedDeletedLines.join(", "),
    }));
  }

  return {
    findings,
    phases: [
      createPhase(
        "deleted-active-owner-baseline",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Frozen baseline deleted active owners stay deleted and re-home only through governed parent owners."
          : "A deleted active owner was removed from the baseline or reintroduced into the generated owner plan.",
      ),
    ],
  };
}