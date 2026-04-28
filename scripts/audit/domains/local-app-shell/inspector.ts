import path from "node:path";

import { Node, Project, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getExpressionPath, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

const STARTUP_ENTRY = "scripts/startup/launch-grasseye.mjs";
const STARTUP_HELPERS = [
  "scripts/startup/lib/dependency-check.mjs",
  "scripts/startup/lib/process-control.mjs",
  "scripts/startup/lib/health-check.mjs",
  "scripts/startup/lib/local-ai-runtime-readiness.mjs",
  "scripts/startup/lib/open-commander-console.mjs",
  "scripts/startup/lib/terminal-structured-log.mjs",
] as const;
const SERVER_HELPER = "src/app/create-workbench-server.ts";
const RUNTIME_API_HELPER = "src/app/runtime-api-handlers.ts";
const SHELL_RENDER_PATH = "src/lib/local-app-shell/render-commander-console-page.ts";
const LEGACY_CONSOLE_PATH = "src/features/operator-control/console-view.ts";
const ILLEGAL_LOCAL_RUNTIME_EXECUTION_PATHS = new Set([
  "src/lib/local-runtime/runtime-executor.ts",
  "src/lib/local-runtime/runtime-bootstrap.ts",
  "src/lib/local-runtime/runtime-state.ts",
  "src/lib/local-runtime/runtime-step-support.ts",
]);

const createStartupProject = (): Project => {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
    },
  });

  project.addSourceFileAtPath(pathFromRepoRoot(STARTUP_ENTRY));
  for (const helperPath of STARTUP_HELPERS) {
    project.addSourceFileAtPath(pathFromRepoRoot(helperPath));
  }

  return project;
};

const hasNamedImport = (sourceFile: import("ts-morph").SourceFile, moduleSpecifier: string, importedName: string): boolean =>
  sourceFile.getImportDeclarations().some(
    (declaration) =>
      declaration.getModuleSpecifierValue() === moduleSpecifier &&
      declaration.getNamedImports().some((specifier) => specifier.getName() === importedName),
  );

const getIdentifierCall = (sourceFile: import("ts-morph").SourceFile, identifierName: string) =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  });

const getIdentifierCallWithin = (node: Node, identifierName: string) =>
  node.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  });

const getResolvedRelativeImport = (relativeFilePath: string, moduleSpecifier: string): string | null => {
  if (!moduleSpecifier.startsWith(".")) {
    return null;
  }

  const resolvedPath = path.normalize(path.join(path.dirname(relativeFilePath), moduleSpecifier));
  return resolvedPath.replace(/\\/g, "/");
};

const getPropertyPath = (initializer: import("ts-morph").Expression | undefined): string[] => {
  if (!initializer) {
    return [];
  }

  return getExpressionPath(initializer);
};

export const inspectLocalAppShellBoundary = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
    const findings: Finding[] = [];
    const auditProject = getAuditProject();
    const startupProject = createStartupProject();
    const serverSource = getSourceFileOrThrow(auditProject, "src/app/server.ts");
    const serverHelperSource = getSourceFileOrThrow(auditProject, SERVER_HELPER);
    const runtimeApiSource = getSourceFileOrThrow(auditProject, RUNTIME_API_HELPER);
    const shellRenderSource = getSourceFileOrThrow(auditProject, SHELL_RENDER_PATH);
    const workbenchSource = getSourceFileOrThrow(auditProject, "src/lib/local-runtime/workbench.ts");
    const launchSource = startupProject.getSourceFile(pathFromRepoRoot(STARTUP_ENTRY));
    const relativeServerPath = toRelativeSourcePath(serverSource);
    const relativeServerHelperPath = toRelativeSourcePath(serverHelperSource);
    const relativeRuntimeApiPath = toRelativeSourcePath(runtimeApiSource);
    const relativeShellRenderPath = toRelativeSourcePath(shellRenderSource);
    const relativeWorkbenchPath = toRelativeSourcePath(workbenchSource);
    const illegalMissionRuntimeSources = auditProject
      .getSourceFiles()
      .filter((sourceFile) => ILLEGAL_LOCAL_RUNTIME_EXECUTION_PATHS.has(toRelativeSourcePath(sourceFile)));

    const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(pathFromRepoRoot("package.json"));
    const legacyConsoleExists = await fileExists(pathFromRepoRoot(LEGACY_CONSOLE_PATH));

    if (legacyConsoleExists) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
          file: LEGACY_CONSOLE_PATH,
          line: 1,
          severity: "fatal",
          message: "Deleted historical operator-control console path must not remain in the active shell boundary.",
        }),
      );
    }

    if (illegalMissionRuntimeSources.length > 0) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
          file: "src/lib/local-runtime/runtime-executor.ts",
          line: 1,
          severity: "fatal",
          message: "src/lib/local-runtime/runtime-executor.ts, runtime-bootstrap.ts, runtime-state.ts, and runtime-step-support.ts form an illegal shell-side execution chain and must be physically removed.",
          detail: illegalMissionRuntimeSources.map((sourceFile) => toRelativeSourcePath(sourceFile)).join(", "),
        }),
      );
    }

    const hostDeclaration = serverSource.getVariableDeclaration("host");
    const hostInitializer = hostDeclaration?.getInitializerIfKind(SyntaxKind.BinaryExpression);
    const hostFallbackNode = hostInitializer?.getRight();
    const hostFallback = hostFallbackNode && Node.isStringLiteral(hostFallbackNode) ? hostFallbackNode : undefined;
    const hostFallbackIsLocalOnly =
      hostInitializer?.getOperatorToken().getKind() === SyntaxKind.QuestionQuestionToken &&
      hostFallback?.getLiteralText() === "127.0.0.1";
    if (!hostFallbackIsLocalOnly) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1",
          file: relativeServerPath,
          line: getNodeLine(hostDeclaration ?? serverSource),
          severity: "error",
          message: "Server must default to 127.0.0.1 rather than a public host binding.",
        }),
      );
    }

    const workbenchDeclaration = serverSource.getVariableDeclaration("workbench");
    const workbenchInitializer = workbenchDeclaration?.getInitializerIfKind(SyntaxKind.NewExpression);
    const workbenchClass = workbenchInitializer?.getExpression().getText();
    if (workbenchClass !== "GrassEyeWorkbench") {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
          file: relativeServerPath,
          line: getNodeLine(workbenchDeclaration ?? serverSource),
          severity: "error",
          message: "Server shell must bootstrap through GrassEyeWorkbench.",
        }),
      );
    }

    const serverText = serverSource.getFullText();
    const serverHelperText = serverHelperSource.getFullText();
    const runtimeApiText = runtimeApiSource.getFullText();
    if (!runtimeApiText.includes('url.pathname === "/api/runtime/snapshot"')) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1",
          file: relativeRuntimeApiPath,
          line: 1,
          severity: "error",
          message: "Server shell must preserve the JSON snapshot endpoint under /api/runtime/snapshot.",
        }),
      );
    }

    if (!serverHelperText.includes('url.pathname === "/"') || !serverHelperText.includes("renderCommanderConsolePage(")) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1",
          file: relativeServerHelperPath,
          line: 1,
          severity: "error",
          message: "Root route must render the Commander Console shell HTML rather than a JSON response.",
        }),
      );
    }

    const shellRenderText = shellRenderSource.getFullText();
    if (shellRenderText.includes('<pre id="snapshot">') || shellRenderText.includes("JSON.stringify(snapshot, null, 2)")) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
          file: relativeShellRenderPath,
          line: 1,
          severity: "error",
          message: "Commander Console shell must not render raw snapshot JSON as the root-page body.",
        }),
      );
    }

    const requiredRealPlatformMarkers = [
      {
        ok: serverText.includes('const configuredPlatformTarget = process.env.GRASSEYE_PLATFORM_TARGET;'),
        marker: "configured platform target env gate",
      },
      {
        ok: serverText.includes('configuredPlatformTarget !== "tiktok-web"'),
        marker: "unsupported platform fail-fast",
      },
      {
        ok: serverText.includes('Fixture/demo fallback is forbidden in phase 3.'),
        marker: "fixture fallback prohibition",
      }
    ];
    for (const check of requiredRealPlatformMarkers) {
      if (!check.ok) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1",
            file: relativeServerPath,
            line: 1,
            severity: "error",
            message: `Local app shell must preserve the real-platform startup guard: ${check.marker}`,
          }),
        );
      }
    }

    const forbiddenShellMarkers = [".grasseye-demo-data", "/api/demo/", "/fixture/platform", "fixture-demo", "renderFixturePlatformPage"];
    for (const marker of forbiddenShellMarkers) {
      if (serverText.includes(marker) || shellRenderText.includes(marker) || workbenchSource.getFullText().includes(marker)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1",
            file: serverText.includes(marker) ? relativeServerPath : (shellRenderText.includes(marker) ? relativeShellRenderPath : relativeWorkbenchPath),
            line: 1,
            severity: "error",
            message: `Local app shell must not retain simulated runtime marker: ${marker}`,
          }),
        );
      }
    }

    const requiredConsoleSurfaceMarkers = [
      "createTranslator(",
      "buildLocaleHref(",
      "issueCommand(",
      "markCandidate(",
      "window.__grasseyeCommanderConsolePayload",
    ];
    for (const marker of requiredConsoleSurfaceMarkers) {
      if (!shellRenderText.includes(marker)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
            file: relativeShellRenderPath,
            line: 1,
            severity: "error",
            message: `Root Commander Console shell must preserve the local render surface marker: ${marker}`,
          }),
        );
      }
    }

    const requiredWorkbenchImports = [
      { moduleSpecifier: "../../capabilities/ai/index.js", importedName: "createAiAbilityGroup" },
    ];
    for (const requiredImport of requiredWorkbenchImports) {
      if (!hasNamedImport(workbenchSource, requiredImport.moduleSpecifier, requiredImport.importedName)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
            file: relativeWorkbenchPath,
            line: 1,
            severity: "error",
            message: `Workbench must keep the ${requiredImport.importedName} boundary import in place.`,
          }),
        );
      }
    }

    const hasRealBrowserBoundary = hasNamedImport(workbenchSource, "../browser/current-chrome-browser-controller.js", "CurrentChromeBrowserController");
    if (!hasRealBrowserBoundary) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
          file: relativeWorkbenchPath,
          line: 1,
          severity: "error",
          message: "Workbench must keep the governed real browser controller boundary import in place.",
        }),
      );
    }

    const workbenchText = workbenchSource.getFullText();
    const requiredModeMarkers = ["executionMode", "fallbackMode", "geometryGuard", "viewport", "calibration"];
    for (const marker of requiredModeMarkers) {
      if (!workbenchText.includes(marker)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
            file: relativeWorkbenchPath,
            line: 1,
            severity: "error",
            message: `Workbench must expose operator mode marker: ${marker}`,
          }),
        );
      }
    }

    for (const helperPath of [STARTUP_ENTRY, ...STARTUP_HELPERS]) {
      if (!(await fileExists(pathFromRepoRoot(helperPath)))) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
            file: helperPath,
            line: 1,
            severity: "error",
            message: "Startup bootstrap path is missing a required script file.",
          }),
        );
      }
    }

    if (!launchSource) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
          file: STARTUP_ENTRY,
          line: 1,
          severity: "error",
          message: "Startup entry file must be parseable by audit enforcement.",
        }),
      );
    }

    const requiredScripts = {
      "grasseye:start": "node scripts/startup/launch-grasseye.mjs",
    };
    for (const [scriptName, expectedCommand] of Object.entries(requiredScripts)) {
      if (packageJson.scripts?.[scriptName] !== expectedCommand) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
            file: "package.json",
            line: 1,
            severity: "error",
            message: `package.json must expose ${scriptName} as ${expectedCommand}.`,
          }),
        );
      }
    }

    if (launchSource) {
      const requiredLaunchImports = [
        { moduleSpecifier: "./lib/dependency-check.mjs", importedName: "assessDependencyState" },
        { moduleSpecifier: "./lib/dependency-check.mjs", importedName: "installDependencies" },
        { moduleSpecifier: "./lib/process-control.mjs", importedName: "clearPortListeners" },
        { moduleSpecifier: "./lib/process-control.mjs", importedName: "startLocalService" },
        { moduleSpecifier: "./lib/process-control.mjs", importedName: "stopLocalService" },
        { moduleSpecifier: "./lib/health-check.mjs", importedName: "waitForHealth" },
        { moduleSpecifier: "./lib/local-ai-runtime-readiness.mjs", importedName: "ensureLocalAiRuntimeReady" },
        { moduleSpecifier: "./lib/open-commander-console.mjs", importedName: "openCommanderConsole" },
        { moduleSpecifier: "./lib/terminal-structured-log.mjs", importedName: "createTerminalStructuredLogger" },
      ];
      for (const requiredImport of requiredLaunchImports) {
        if (!hasNamedImport(launchSource, requiredImport.moduleSpecifier, requiredImport.importedName)) {
          findings.push(
            createFinding({
              lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
              file: STARTUP_ENTRY,
              line: 1,
              severity: "error",
              message: `Launch entry must import ${requiredImport.importedName} from ${requiredImport.moduleSpecifier}.`,
            }),
          );
        }
      }

      const performLaunchFunction = launchSource.getFunction("performLaunch");
      const openReadyPageFunction = launchSource.getFunction("openReadyPage");
      const clearPortCall = performLaunchFunction
        ? getIdentifierCallWithin(performLaunchFunction, "clearPortListeners")
        : getIdentifierCall(launchSource, "clearPortListeners");
      const startCall = performLaunchFunction
        ? getIdentifierCallWithin(performLaunchFunction, "startLocalService")
        : getIdentifierCall(launchSource, "startLocalService");
      const healthCall = performLaunchFunction
        ? getIdentifierCallWithin(performLaunchFunction, "waitForHealth")
        : getIdentifierCall(launchSource, "waitForHealth");
      const openMainPageCall = openReadyPageFunction
        ? getIdentifierCallWithin(openReadyPageFunction, "openCommanderConsole")
        : getIdentifierCall(launchSource, "openCommanderConsole");
      const openCall = performLaunchFunction
        ? getIdentifierCallWithin(performLaunchFunction, "openReadyPage") ??
          getIdentifierCallWithin(performLaunchFunction, "openCommanderConsole")
        : getIdentifierCall(launchSource, "openCommanderConsole");

      if (!clearPortCall) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
            file: STARTUP_ENTRY,
            line: 1,
            severity: "error",
            message: "Launch entry must force-clear the canonical startup port before runtime launch.",
          }),
        );
      }

      if (!startCall) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
            file: STARTUP_ENTRY,
            line: 1,
            severity: "error",
            message: "Launch entry must start the local service through startLocalService.",
          }),
        );
      }

      if (!healthCall) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
            file: STARTUP_ENTRY,
            line: 1,
            severity: "error",
            message: "Launch entry must wait for the health gate before declaring success.",
          }),
        );
      }

      if (!openCall || !openMainPageCall) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
            file: STARTUP_ENTRY,
            line: 1,
            severity: "error",
            message: "Launch entry must open Commander Console after health passes.",
          }),
        );
      }

      if (clearPortCall && startCall && clearPortCall.getStart() > startCall.getStart()) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
            file: STARTUP_ENTRY,
            line: getNodeLine(startCall),
            severity: "error",
            message: "Launch entry must clear the canonical startup port before startLocalService runs.",
          }),
        );
      }

      if (healthCall && openCall && healthCall.getStart() > openCall.getStart()) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
            file: STARTUP_ENTRY,
            line: getNodeLine(openCall),
            severity: "error",
            message: "Launch entry must gate page opening behind a completed health check.",
          }),
        );
      }

      if (startCall) {
        const startArgument = startCall.getArguments()[0];
        const startRootPath =
          startArgument && Node.isObjectLiteralExpression(startArgument)
            ? getPropertyPath(startArgument.getProperty("rootDir")?.getFirstDescendantByKind(SyntaxKind.Identifier))
            : [];
        if (startRootPath.length === 0 || startRootPath[0] !== "rootDir") {
          findings.push(
            createFinding({
              lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
              file: STARTUP_ENTRY,
              line: getNodeLine(startCall),
              severity: "error",
              message: "Launch entry must pass the repository root into startLocalService.",
            }),
          );
        }
      }

      if (launchSource.getFullText().includes("reusing current service") || launchSource.getFullText().includes("probeHealth(")) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
            file: STARTUP_ENTRY,
            line: 1,
            severity: "error",
            message: "Launch entry must not reuse an existing listener instead of reclaiming clean port ownership.",
          }),
        );
      }

      const startupSources = startupProject.getSourceFiles();
      for (const sourceFile of startupSources) {
        const relativePath = toRepoRelativePath(sourceFile.getFilePath());
        for (const importDeclaration of sourceFile.getImportDeclarations()) {
          const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
          if (moduleSpecifier.startsWith("node:")) {
            continue;
          }

          const resolvedImport = getResolvedRelativeImport(relativePath, moduleSpecifier);
          if (!resolvedImport || !resolvedImport.startsWith("scripts/startup/")) {
            findings.push(
              createFinding({
                lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
                file: relativePath,
                line: getNodeLine(importDeclaration),
                severity: "error",
                message: "Startup scripts must stay inside the startup boundary and must not import business domains.",
              }),
            );
          }
        }
      }
    }

    return {
      findings,
      phases: [
        createPhase(
          "local-shell-boundary",
          findings.some((finding) => finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-001-V1" || finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-002-V1")
            ? "LAW-SCRIPT DRIFT"
            : "PASS",
          !findings.some((finding) => finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-001-V1" || finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-002-V1"),
          findings.some((finding) => finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-001-V1" || finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-002-V1")
            ? "Local app shell boundary wiring is incomplete or drifted."
            : "Server and workbench keep localhost shell, local runtime, local AI, browser, and data boundaries together.",
        ),
        createPhase(
          "startup-bootstrap-boundary",
          findings.some((finding) => finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-004-V1") ? "CODE VIOLATION" : "PASS",
          !findings.some((finding) => finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-004-V1"),
          findings.some((finding) => finding.lawId === "GRASSEYE-LOCAL-APP-SHELL-004-V1")
            ? "Startup bootstrap path drifted away from the governed dependency -> start -> health -> open sequence."
            : "Startup bootstrap stays bounded to dependency readiness, health-gated service launch, and page opening.",
        ),
      ],
    };
};