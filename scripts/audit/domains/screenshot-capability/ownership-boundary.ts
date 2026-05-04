import type { Project, SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpressionPath } from "../_shared/ast-helpers.js";

import { LAW_IDS } from "./config.js";
import { getRepoPath } from "./project-access.js";

const HISTORICAL_DRAWER_PATH = "platform-action-screenshot-drawer";
const LOCAL_AI_ROOT = "src/lib/local-ai/";
const ALLOWED_CAPTURE_ADAPTER = "src/capabilities/screenshot/adapters/browser-controller-screenshot-capture-port.ts";
const LOCAL_AI_OPERATION_TOKENS = ["resize", "crop"] as const;
const LOCAL_AI_TRUTH_TOKENS = ["artifact", "scalemapping", "scale"] as const;

function collectDeclaredNames(sourceFile: SourceFile): string[] {
  return [
    ...sourceFile.getFunctions().map((declaration) => declaration.getName()),
    ...sourceFile.getVariableDeclarations().map((declaration) => declaration.getName()),
    ...sourceFile.getClasses().map((declaration) => declaration.getName()),
    ...sourceFile.getInterfaces().map((declaration) => declaration.getName()),
    ...sourceFile.getTypeAliases().map((declaration) => declaration.getName()),
  ].filter((name): name is string => Boolean(name));
}

function normalizeToken(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isLocalAiScreenshotOwnerName(name: string): boolean {
  const normalizedName = normalizeToken(name);
  return normalizedName.includes("screenshot")
    && LOCAL_AI_OPERATION_TOKENS.some((token) => normalizedName.includes(token))
    && LOCAL_AI_TRUTH_TOKENS.some((token) => normalizedName.includes(token));
}

function collectHistoricalDrawerFindings(project: Project): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) =>
    getRepoPath(sourceFile).includes(HISTORICAL_DRAWER_PATH)
      ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: getRepoPath(sourceFile), line: 1, severity: "fatal", message: "Historical screenshot drawer path must remain deleted." })]
      : [],
  );
}

function collectLocalAiOwnerFindings(project: Project): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const repoPath = getRepoPath(sourceFile);
    if (!repoPath.startsWith(LOCAL_AI_ROOT)) {
      return [];
    }

    const matchedName = collectDeclaredNames(sourceFile).find(isLocalAiScreenshotOwnerName);
    return matchedName
      ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: repoPath, line: 1, severity: "fatal", message: "Local AI must not own screenshot resize/crop artifact helpers or scale-mapping truth.", detail: `symbol=${matchedName}` })]
      : [];
  });
}

function collectBrowserCaptureFindings(project: Project): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const repoPath = getRepoPath(sourceFile);
    if (repoPath === ALLOWED_CAPTURE_ADAPTER || !hasCallExpressionPath(sourceFile, ["browserController", "screenshotRegion"])) {
      return [];
    }

    return [createFinding({ lawId: LAW_IDS.PUBLIC, file: repoPath, line: 1, severity: "fatal", message: "Direct browserController.screenshotRegion calls must stay behind ScreenshotCapturePort adapters." })];
  });
}

export function runOwnershipBoundary(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectHistoricalDrawerFindings(project),
    ...collectLocalAiOwnerFindings(project),
    ...collectBrowserCaptureFindings(project),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "ownership-boundary",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Screenshot ownership remains isolated to the Screenshot ability group and its governed capture adapter."
        : "Screenshot ownership drifted into forbidden paths or direct browser capture sites.",
    ),
  };
}