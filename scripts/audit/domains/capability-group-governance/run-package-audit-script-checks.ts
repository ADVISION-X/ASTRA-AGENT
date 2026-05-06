import { loadDomainManifests } from "../../core/manifests.js";
import { readJsonFile } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";

type PackageJson = {
  scripts?: Record<string, string>;
};

const {
  LAW_ID_001,
} = capabilityGroupGovernanceConstants;

const RESERVED_AUDIT_SCRIPT_NAMES = ["audit", "audit:build"] as const;
const GOVERNED_AUDIT_UTILITY_SCRIPT_NAMES = ["audit:coverage:anti-fraud", "audit:code-purity"] as const;
const REQUIRED_ABILITY_AUDIT_SCRIPT_NAMES = [
  "audit:commander-console",
  "audit:orchestration",
  "audit:nerve-bus",
  "audit:ai",
  "audit:open",
  "audit:screenshot",
  "audit:visual-target",
  "audit:geometry-guard",
  "audit:mouse-click",
  "audit:text-input-capability",
  "audit:mouse-scroll",
  "audit:post-action-verification",
  "audit:forensics-persistence",
  "audit:page-state",
] as const;

const resolveOwnerAuditScriptNames = (capabilityDomain: string): string[] => {
  if (capabilityDomain === "audit-coverage-governance") {
    return ["audit:coverage"];
  }

  if (capabilityDomain === "text-input-capability") {
    return ["audit:text-input", "audit:text-input-capability"];
  }

  if (capabilityDomain.endsWith("-capability")) {
    return [`audit:${capabilityDomain.slice(0, -"-capability".length)}`];
  }

  return [`audit:${capabilityDomain}`];
};

const collectAllowedAuditScriptNames = async (): Promise<Set<string>> => {
  const manifests = await loadDomainManifests();
  const allowed = new Set<string>([
    ...RESERVED_AUDIT_SCRIPT_NAMES,
    ...GOVERNED_AUDIT_UTILITY_SCRIPT_NAMES,
  ]);

  for (const manifest of manifests) {
    if (!manifest.owner) {
      continue;
    }

    for (const scriptName of resolveOwnerAuditScriptNames(manifest.capabilityDomain)) {
      allowed.add(scriptName);
    }
  }

  return allowed;
};

const collectUnauthorizedAuditScriptFindings = async (scripts: Record<string, string>): Promise<Finding[]> => {
  const allowedAuditScriptNames = await collectAllowedAuditScriptNames();

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

const collectMissingRequiredAuditScriptFindings = (scripts: Record<string, string>): Finding[] =>
  REQUIRED_ABILITY_AUDIT_SCRIPT_NAMES
    .filter((scriptName) => !scripts[scriptName])
    .map((scriptName) => createFinding({
      lawId: LAW_ID_001,
      file: "package.json",
      line: 1,
      severity: "fatal",
      message: `package.json must expose ${scriptName}; every active ability group owner audit entrypoint is machine-blocking.`,
    }));

const createPackageAuditScriptPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "package-audit-entrypoints",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0
      ? "package.json only exposes constitutional owner audit entrypoints plus governed audit utility commands."
      : "package.json exposes non-constitutional owner or ungoverned audit:* commands.",
  );

export async function runPackageAuditScriptChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const packageJson = await readJsonFile<PackageJson>(pathFromRepoRoot("package.json"));
  const scripts = packageJson.scripts ?? {};
  const findings = [
    ...(await collectUnauthorizedAuditScriptFindings(scripts)),
    ...collectMissingRequiredAuditScriptFindings(scripts),
  ];
  return {
    findings,
    phases: [createPackageAuditScriptPhase(findings)],
  };
}
