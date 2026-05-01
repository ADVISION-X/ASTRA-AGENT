import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { getAuditProject, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

import { localAppShellInspectionConstants as config } from "./inspection-constants.js";
import { hasNamedImport } from "./inspection-utils.js";

const collectLegacyBoundaryFindings = async (auditProject: ReturnType<typeof getAuditProject>): Promise<Finding[]> => {
  const legacyConsoleExists = await fileExists(pathFromRepoRoot(config.LEGACY_CONSOLE_PATH));
  const illegalMissionRuntimeSources = auditProject.getSourceFiles().filter((sourceFile) => {
    return config.ILLEGAL_LOCAL_RUNTIME_EXECUTION_PATHS.has(toRelativeSourcePath(sourceFile));
  });
  const findings: Finding[] = [];

  if (legacyConsoleExists) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
      file: config.LEGACY_CONSOLE_PATH,
      line: 1,
      severity: "fatal",
      message: "Deleted historical operator-control console path must not remain in the active shell boundary.",
    }));
  }
  if (illegalMissionRuntimeSources.length > 0) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
      file: "src/lib/local-runtime/runtime-executor.ts",
      line: 1,
      severity: "fatal",
      message: "src/lib/local-runtime/runtime-executor.ts, runtime-bootstrap.ts, runtime-state.ts, and runtime-step-support.ts form an illegal shell-side execution chain and must be physically removed.",
      detail: illegalMissionRuntimeSources.map((sourceFile) => toRelativeSourcePath(sourceFile)).join(", "),
    }));
  }

  return findings;
};

const collectServerBoundaryFindings = (serverSource: import("ts-morph").SourceFile): Finding[] => {
  const relativeServerPath = toRelativeSourcePath(serverSource);
  const findings: Finding[] = [];
  const hostDeclaration = serverSource.getVariableDeclaration("host");
  const hostInitializer = hostDeclaration?.getInitializerIfKind(SyntaxKind.BinaryExpression);
  const hostFallbackNode = hostInitializer?.getRight();
  const hostFallback = hostFallbackNode && Node.isStringLiteral(hostFallbackNode) ? hostFallbackNode : undefined;
  const hostFallbackIsLocalOnly = hostInitializer?.getOperatorToken().getKind() === SyntaxKind.QuestionQuestionToken && hostFallback?.getLiteralText() === "127.0.0.1";
  const workbenchDeclaration = serverSource.getVariableDeclaration("workbench");
  const workbenchInitializer = workbenchDeclaration?.getInitializerIfKind(SyntaxKind.NewExpression);

  if (!hostFallbackIsLocalOnly) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1",
      file: relativeServerPath,
      line: getNodeLine(hostDeclaration ?? serverSource),
      severity: "error",
      message: "Server must default to 127.0.0.1 rather than a public host binding.",
    }));
  }
  if (workbenchInitializer?.getExpression().getText() !== "GrassEyeWorkbench") {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
      file: relativeServerPath,
      line: getNodeLine(workbenchDeclaration ?? serverSource),
      severity: "error",
      message: "Server shell must bootstrap through GrassEyeWorkbench.",
    }));
  }

  return findings;
};

const collectRouteSurfaceFindings = (input: {
  serverSource: import("ts-morph").SourceFile;
  serverHelperSource: import("ts-morph").SourceFile;
  runtimeApiSource: import("ts-morph").SourceFile;
  shellRenderSource: import("ts-morph").SourceFile;
  workbenchSource: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];
  const serverText = input.serverSource.getFullText();
  const serverHelperText = input.serverHelperSource.getFullText();
  const runtimeApiText = input.runtimeApiSource.getFullText();
  const shellRenderText = input.shellRenderSource.getFullText();
  const workbenchText = input.workbenchSource.getFullText();

  if (!runtimeApiText.includes('url.pathname === "/api/runtime/snapshot"')) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1", file: toRelativeSourcePath(input.runtimeApiSource), line: 1, severity: "error", message: "Server shell must preserve the JSON snapshot endpoint under /api/runtime/snapshot." }));
  }
  if (!serverHelperText.includes('url.pathname === "/"') || !serverHelperText.includes("renderCommanderConsolePage(")) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1", file: toRelativeSourcePath(input.serverHelperSource), line: 1, severity: "error", message: "Root route must render the Commander Console shell HTML rather than a JSON response." }));
  }
  if (shellRenderText.includes('<pre id="snapshot">') || shellRenderText.includes("JSON.stringify(snapshot, null, 2)")) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1", file: toRelativeSourcePath(input.shellRenderSource), line: 1, severity: "error", message: "Commander Console shell must not render raw snapshot JSON as the root-page body." }));
  }

  findings.push(...collectServerMarkerFindings(serverText, toRelativeSourcePath(input.serverSource)));
  findings.push(...collectForbiddenShellMarkerFindings({ serverText, shellRenderText, workbenchText, serverPath: toRelativeSourcePath(input.serverSource), shellRenderPath: toRelativeSourcePath(input.shellRenderSource), workbenchPath: toRelativeSourcePath(input.workbenchSource) }));
  findings.push(...collectConsoleSurfaceFindings(shellRenderText, toRelativeSourcePath(input.shellRenderSource)));
  return findings;
};

const collectServerMarkerFindings = (serverText: string, relativeServerPath: string): Finding[] => {
  const requiredRealPlatformMarkers = [
    { ok: serverText.includes('const configuredPlatformTarget = process.env.GRASSEYE_PLATFORM_TARGET;'), marker: "configured platform target env gate" },
    { ok: serverText.includes('configuredPlatformTarget !== "tiktok-web"'), marker: "unsupported platform fail-fast" },
    { ok: serverText.includes('Fixture/demo fallback is forbidden in phase 3.'), marker: "fixture fallback prohibition" },
  ];

  return requiredRealPlatformMarkers.flatMap((check) => {
    return check.ok ? [] : [createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1", file: relativeServerPath, line: 1, severity: "error", message: `Local app shell must preserve the real-platform startup guard: ${check.marker}` })];
  });
};

const collectForbiddenShellMarkerFindings = (input: {
  serverText: string;
  shellRenderText: string;
  workbenchText: string;
  serverPath: string;
  shellRenderPath: string;
  workbenchPath: string;
}): Finding[] => {
  const forbiddenShellMarkers = [".grasseye-demo-data", "/api/demo/", "/fixture/platform", "fixture-demo", "renderFixturePlatformPage"];
  return forbiddenShellMarkers.flatMap((marker) => {
    if (input.serverText.includes(marker)) {
      return [createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1", file: input.serverPath, line: 1, severity: "error", message: `Local app shell must not retain simulated runtime marker: ${marker}` })];
    }
    if (input.shellRenderText.includes(marker)) {
      return [createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1", file: input.shellRenderPath, line: 1, severity: "error", message: `Local app shell must not retain simulated runtime marker: ${marker}` })];
    }
    return input.workbenchText.includes(marker)
      ? [createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1", file: input.workbenchPath, line: 1, severity: "error", message: `Local app shell must not retain simulated runtime marker: ${marker}` })]
      : [];
  });
};

const collectConsoleSurfaceFindings = (shellRenderText: string, relativeShellRenderPath: string): Finding[] => {
  const requiredConsoleSurfaceMarkers = ["createTranslator(", "buildLocaleHref(", "issueCommand(", "markCandidate(", "window.__grasseyeCommanderConsolePayload"];
  return requiredConsoleSurfaceMarkers.flatMap((marker) => {
    return shellRenderText.includes(marker)
      ? []
      : [createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1", file: relativeShellRenderPath, line: 1, severity: "error", message: `Root Commander Console shell must preserve the local render surface marker: ${marker}` })];
  });
};

const collectWorkbenchBoundaryFindings = (workbenchSource: import("ts-morph").SourceFile): Finding[] => {
  const relativeWorkbenchPath = toRelativeSourcePath(workbenchSource);
  const workbenchText = workbenchSource.getFullText();
  const findings: Finding[] = [];

  if (!hasNamedImport(workbenchSource, "../../capabilities/ai/index.js", "createAiAbilityGroup")) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1", file: relativeWorkbenchPath, line: 1, severity: "error", message: "Workbench must keep the createAiAbilityGroup boundary import in place." }));
  }
  if (!hasNamedImport(workbenchSource, "../browser/current-chrome-browser-controller.js", "CurrentChromeBrowserController")) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1", file: relativeWorkbenchPath, line: 1, severity: "error", message: "Workbench must keep the governed real browser controller boundary import in place." }));
  }

  for (const marker of ["executionMode", "fallbackMode", "geometryGuard", "viewport", "calibration"]) {
    if (!workbenchText.includes(marker)) {
      findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1", file: relativeWorkbenchPath, line: 1, severity: "error", message: `Workbench must expose operator mode marker: ${marker}` }));
    }
  }

  return findings;
};

export const runLocalShellBoundaryChecks = async (): Promise<Finding[]> => {
  const auditProject = getAuditProject();
  const serverSource = getSourceFileOrThrow(auditProject, "src/app/server.ts");
  const serverHelperSource = getSourceFileOrThrow(auditProject, config.SERVER_HELPER);
  const runtimeApiSource = getSourceFileOrThrow(auditProject, config.RUNTIME_API_HELPER);
  const shellRenderSource = getSourceFileOrThrow(auditProject, config.SHELL_RENDER_PATH);
  const workbenchSource = getSourceFileOrThrow(auditProject, "src/lib/local-runtime/workbench.ts");

  return [
    ...await collectLegacyBoundaryFindings(auditProject),
    ...collectServerBoundaryFindings(serverSource),
    ...collectRouteSurfaceFindings({ serverSource, serverHelperSource, runtimeApiSource, shellRenderSource, workbenchSource }),
    ...collectWorkbenchBoundaryFindings(workbenchSource),
  ];
};