import { fileExists, readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

type PackageJson = {
  scripts?: Record<string, string>;
};

const LEGACY_OWNER_IDS = [
  "agent-runtime",
  "browse-flow",
  "mechanical-skills",
  "operator-control",
  "visual-action",
  "visual-only-runtime",
  "evidence-packet",
  "product-signal",
  "comment-intelligence",
  "vision-boundary",
] as const;

const NON_OWNER_AUDIT_IDS = [
  "local-data",
  "platform-action",
  "startup-entrypoint",
  "local-app-shell",
  "local-browser-session",
  "local-ai-runtime",
  "local-persistence-schema",
  "structured-logging",
  "code-topology",
  "localization",
] as const;

const PSEUDO_OWNER_AUDIT_IDS = [
  "platform-adapter",
  "PlatformAdapter",
  "feature-folder",
  "feature-folders",
  "helper-file",
  "helper-files",
  "startup-script",
  "startup-scripts",
  "browser-primitive",
  "browser-primitives",
  "browser-controller",
] as const;

const FORBIDDEN_RUNTIME_ROOTS = ["src/features/local-data", "src/features/platform-action"] as const;
const FORBIDDEN_AUDIT_TRUTH_TOKENS = [
  "scripts/verify",
  "verify-",
  "verify/",
  ".test.",
  ".spec.",
  "smoke",
  "capability-check",
  "scorecard",
] as const;

const {
  REQUIREMENT_ID_009,
  REQUIREMENT_ID_011,
  REQUIREMENT_ID_012,
  REQUIREMENT_ID_013,
  REQUIREMENT_ID_014,
  REQUIREMENT_ID_015,
} = kernelInspectionConstants;

const createRequirementFinding = (input: {
  lawId: string;
  file: string;
  message: string;
  detail?: string;
}): Finding => createFinding({
  lawId: input.lawId,
  file: input.file,
  line: 1,
  severity: "fatal",
  message: input.message,
  ...(input.detail ? { detail: input.detail } : {}),
});

const collectForbiddenAuditEntryFindings = (scripts: Record<string, string>): Finding[] => {
  const findings: Finding[] = [];

  for (const ownerId of LEGACY_OWNER_IDS) {
    const scriptName = `audit:${ownerId}`;
    if (scriptName in scripts) {
      findings.push(createRequirementFinding({
        lawId: REQUIREMENT_ID_009,
        file: "package.json",
        message: `package.json must not expose ${scriptName}; retired legacy owners must not be reintroduced as active owners.`,
      }));
    }
  }

  for (const ownerId of NON_OWNER_AUDIT_IDS) {
    const scriptName = `audit:${ownerId}`;
    if (!(scriptName in scripts)) {
      continue;
    }

    const lawId = ownerId === "local-data"
      ? REQUIREMENT_ID_013
      : ownerId === "platform-action"
        ? REQUIREMENT_ID_014
        : REQUIREMENT_ID_011;
    const message = ownerId === "local-data"
      ? "package.json must not expose audit:local-data; local-data must not own evidence, ledger, AI-result, snapshot, or operator-snapshot truth."
      : ownerId === "platform-action"
        ? "package.json must not expose audit:platform-action; platform-action must not own open, screenshot, visual target, geometry, click, scroll, page-state, or post-action verification truth."
        : `package.json must not expose ${scriptName}; non-capability surfaces must not publish audit owners.`;

    findings.push(createRequirementFinding({
      lawId,
      file: "package.json",
      message,
    }));
  }

  for (const ownerId of PSEUDO_OWNER_AUDIT_IDS) {
    const scriptName = `audit:${ownerId}`;
    if (!(scriptName in scripts)) {
      continue;
    }

    findings.push(createRequirementFinding({
      lawId: REQUIREMENT_ID_011,
      file: "package.json",
      message: `package.json must not expose ${scriptName}; PlatformAdapter, feature folders, helper files, startup scripts, and browser primitives must not publish ability owners.`,
    }));
  }

  return findings;
};

const collectAuditTruthBoundaryFindings = (scripts: Record<string, string>): Finding[] => {
  const findings: Finding[] = [];

  for (const [scriptName, command] of Object.entries(scripts)) {
    if (!scriptName.startsWith("audit:")) {
      continue;
    }

    const normalizedCommand = command.toLowerCase();
    if (!FORBIDDEN_AUDIT_TRUTH_TOKENS.some((token) => normalizedCommand.includes(token))) {
      continue;
    }

    findings.push(createRequirementFinding({
      lawId: REQUIREMENT_ID_015,
      file: "package.json",
      message: `Audit entrypoint ${scriptName} must not delegate enforcement truth to verify/test/ad-hoc quality scripts.`,
      detail: command,
    }));
  }

  return findings;
};

async function collectForbiddenRuntimeRootFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const relativePath of FORBIDDEN_RUNTIME_ROOTS) {
    if (!(await fileExists(pathFromRepoRoot(relativePath)))) {
      continue;
    }

    findings.push(createRequirementFinding({
      lawId: REQUIREMENT_ID_012,
      file: relativePath,
      message: "src/features/local-data and src/features/platform-action must not exist as active runtime roots after capability-group cutover.",
      detail: relativePath,
    }));
  }

  return findings;
}

export async function runForbiddenOwnerRuntimeChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const packageJson = await readJsonFile<PackageJson>(pathFromRepoRoot("package.json"));
  const scripts = packageJson.scripts ?? {};
  const forbiddenAuditEntryFindings = collectForbiddenAuditEntryFindings(scripts);
  const auditTruthBoundaryFindings = collectAuditTruthBoundaryFindings(scripts);
  const forbiddenRuntimeRootFindings = await collectForbiddenRuntimeRootFindings();
  const secondExecutionChainFindings = [
    ...forbiddenAuditEntryFindings,
    ...forbiddenRuntimeRootFindings,
  ];

  return {
    findings: [
      ...forbiddenAuditEntryFindings,
      ...forbiddenRuntimeRootFindings,
      ...auditTruthBoundaryFindings,
    ],
    phases: [
      createPhase(
        "forbidden-audit-owner-publication",
        forbiddenAuditEntryFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        forbiddenAuditEntryFindings.length === 0,
        forbiddenAuditEntryFindings.length === 0
          ? "package.json does not publish retired or non-capability audit owners."
          : "package.json still publishes retired owners or non-capability surfaces as audit owners.",
      ),
      createPhase(
        "forbidden-feature-runtime-roots",
        forbiddenRuntimeRootFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        forbiddenRuntimeRootFindings.length === 0,
        forbiddenRuntimeRootFindings.length === 0
          ? "Legacy feature runtime roots remain removed after capability-group cutover."
          : "Legacy feature runtime roots reappeared after capability-group cutover.",
      ),
      createPhase(
        "no-second-execution-chain",
        secondExecutionChainFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        secondExecutionChainFindings.length === 0,
        secondExecutionChainFindings.length === 0
          ? "Kernel keeps a single execution chain beside the ability-group formula."
          : "Kernel drift reintroduced a second execution chain beside the ability-group formula.",
      ),
      createPhase(
        "audit-enforcement-truth-boundary",
        auditTruthBoundaryFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        auditTruthBoundaryFindings.length === 0,
        auditTruthBoundaryFindings.length === 0
          ? "Audit entrypoints keep enforcement truth inside the governed audit chain."
          : "Audit entrypoints still delegate enforcement truth to verify/test/ad-hoc quality scripts.",
      ),
    ],
  };
}
