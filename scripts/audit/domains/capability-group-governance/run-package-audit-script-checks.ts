import { readJsonFile } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";

type PackageJson = {
  scripts?: Record<string, string>;
};

const {
  ACTIVE_ABILITY_GROUPS,
  FOUNDATION_LAWS,
  LAW_ID_001,
  SUPPORT_GOVERNANCE_DOMAINS,
} = capabilityGroupGovernanceConstants;

const RESERVED_AUDIT_SCRIPT_NAMES = ["audit", "audit:build"] as const;
const ROUTING_AUDIT_SCRIPT_NAMES = ["audit:kernel", "audit:index"] as const;
const LOCAL_DEVELOPMENT_AUDIT_SCRIPT_NAMES = ["audit:debug-loop-boundary"] as const;

const collectAllowedAuditScriptNames = (): Set<string> => {
  const allowed = new Set<string>([
    ...RESERVED_AUDIT_SCRIPT_NAMES,
    ...ROUTING_AUDIT_SCRIPT_NAMES,
    ...LOCAL_DEVELOPMENT_AUDIT_SCRIPT_NAMES,
  ]);

  for (const foundationLaw of FOUNDATION_LAWS) {
    allowed.add(`audit:${foundationLaw}`);
  }

  for (const supportDomain of SUPPORT_GOVERNANCE_DOMAINS) {
    allowed.add(`audit:${supportDomain}`);
  }

  for (const abilityGroup of ACTIVE_ABILITY_GROUPS) {
    allowed.add(`audit:${abilityGroup}`);
    allowed.add(`audit:${abilityGroup}-capability`);
  }

  return allowed;
};

const collectUnauthorizedAuditScriptFindings = (scripts: Record<string, string>): Finding[] => {
  const allowedAuditScriptNames = collectAllowedAuditScriptNames();

  return Object.keys(scripts)
    .filter((scriptName) => scriptName.startsWith("audit:") && !allowedAuditScriptNames.has(scriptName))
    .sort((left, right) => left.localeCompare(right))
    .map((scriptName) => createFinding({
      lawId: LAW_ID_001,
      file: "package.json",
      line: 1,
      severity: "fatal",
      message: `package.json must not expose ${scriptName}; only constitutional owners may publish audit entrypoints.`,
    }));
};

const createPackageAuditScriptPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "package-audit-entrypoints",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0
      ? "package.json only exposes audit entrypoints for constitutional owners."
      : "package.json exposes audit entrypoints for non-constitutional owners.",
  );

export async function runPackageAuditScriptChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const packageJson = await readJsonFile<PackageJson>(pathFromRepoRoot("package.json"));
  const findings = collectUnauthorizedAuditScriptFindings(packageJson.scripts ?? {});
  return {
    findings,
    phases: [createPackageAuditScriptPhase(findings)],
  };
}