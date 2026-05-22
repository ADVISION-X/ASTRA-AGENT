import { existsSync, readFileSync, readdirSync } from "node:fs";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

type Finding = ReturnType<typeof createFinding>;

const launchPath = "scripts/startup/launch-grasseye.mjs";
const logPath = "scripts/startup/lib/terminal-structured-log.mjs";
const helperPath = "scripts/startup/lib/startup-log-helpers.mjs";
const packagePath = "package.json";
const inspectorPath = "scripts/audit/domains/startup-entrypoint/inspector.ts";

const readRepoFile = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

const listStartupFiles = (relativeDir = "scripts/startup"): string[] =>
  readdirSync(resolveFromRepo(relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const childPath = `${relativeDir}/${entry.name}`;
    return entry.isDirectory() ? listStartupFiles(childPath) : [childPath];
  });

const pushFinding = (
  findings: Finding[],
  input: {
    checkId: string;
    lawId: string;
    filePath: string;
    message: string;
    evidence?: string | undefined;
  },
): void => {
  findings.push(createFinding(input));
};

const inspectSingleGate = (findings: Finding[], lawId: string): void => {
  const packageJson = JSON.parse(readRepoFile(packagePath)) as { scripts?: Record<string, string> };
  const startupCommand = packageJson.scripts?.["grasseye:start"];
  if (startupCommand !== "node scripts/startup/launch-grasseye.mjs") {
    pushFinding(findings, {
      lawId,
      checkId: "startup/single-command",
      filePath: packagePath,
      message: "grasseye:start must point to scripts/startup/launch-grasseye.mjs.",
      evidence: startupCommand,
    });
  }
  if (!existsSync(resolveFromRepo(launchPath))) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/missing-entrypoint",
      filePath: launchPath,
      message: "Startup entrypoint is missing.",
    });
  }
};

const inspectForbiddenStartupSurface = (findings: Finding[], lawId: string, startupFiles: readonly string[]): void => {
  const forbiddenPatterns = [
    /startup-registry-readiness/iu,
    /registry_readiness/iu,
    /GRASSEYE_STARTUP_(?:ONLINE|LOCAL)_AI_READINESS_JSON/u,
    /MISSION_READINESS/iu,
    /mission_runtime/iu,
    /ci:full|codex:entry-gate|typecheck|acceptance:/u,
    /amazon-invoice-upload\.flow|facebook-product-video-mining\.flow/u,
    /dom-automation/u,
  ] as const;

  for (const filePath of startupFiles) {
    const fileText = readRepoFile(filePath);
    const matchedPattern = forbiddenPatterns.find((pattern) => pattern.test(fileText));
    if (!matchedPattern) {
      continue;
    }
    pushFinding(findings, {
      lawId,
      checkId: "startup/forbidden-surface",
      filePath,
      message: "Startup contains forbidden job, AI, CI, registry, DOM, or ability surface.",
      evidence: String(matchedPattern),
    });
  }
};

const inspectReadinessProbe = (findings: Finding[], lawId: string): void => {
  const launchText = readRepoFile(launchPath);
  if (!launchText.includes("/api/health")) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/health-probe",
      filePath: launchPath,
      message: "Startup must probe /api/health for readiness.",
    });
  }
  if (/fetch\(baseUrl\)/u.test(launchText)) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/homepage-probe",
      filePath: launchPath,
      message: "Startup must not use root HTML as the primary readiness probe.",
    });
  }
};

const inspectStructuredReport = (findings: Finding[], lawId: string): void => {
  const terminalLogText = readRepoFile(logPath);
  const helperText = readRepoFile(helperPath);
  const requiredFields = ["phase", "component", "eventType", "status", "message", "refs", "durationMs", "failureReason"];
  const missingFields = requiredFields.filter((field) => !terminalLogText.includes(field) && !helperText.includes(field));
  if (missingFields.length > 0) {
    pushFinding(findings, {
      lawId,
      checkId: "startup/structured-report-fields",
      filePath: logPath,
      message: "Startup structured terminal report is missing required fields.",
      evidence: missingFields.join(","),
    });
  }
};

const inspectAstProjectAccess = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const inspectorSource = context.project.getSourceFile(resolveFromRepo(inspectorPath));
  if (inspectorSource) {
    return;
  }
  pushFinding(findings, {
    lawId,
    checkId: "startup/inspector-ast-project",
    filePath: inspectorPath,
    message: "Startup inspector must be visible to the audit ts-morph project.",
  });
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const singleGateLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-001-V1");
  const boundaryLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-002-V1");
  const readinessLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-003-V1");
  const reportLawId = selectLawId(context.planEntry.lawIds, "APEX-STARTUP-004-V1");
  const inspectedFiles = new Set([packagePath, launchPath, logPath, helperPath, inspectorPath]);
  const startupFiles = listStartupFiles().map((filePath) => toRepoPath(resolveFromRepo(filePath)));
  startupFiles.forEach((filePath) => inspectedFiles.add(filePath));
  const findings: Finding[] = [];

  inspectAstProjectAccess(context, findings, boundaryLawId);
  inspectSingleGate(findings, singleGateLawId);
  inspectForbiddenStartupSurface(findings, boundaryLawId, startupFiles);
  inspectReadinessProbe(findings, readinessLawId);
  inspectStructuredReport(findings, reportLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
