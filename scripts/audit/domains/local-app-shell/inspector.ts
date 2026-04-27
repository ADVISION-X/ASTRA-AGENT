import path from "node:path";

import { Node, Project, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { getAuditProject, getExpressionPath, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const STARTUP_ENTRY = "scripts/startup/launch-grasseye.mjs";
const STARTUP_HELPERS = [
  "scripts/startup/lib/dependency-check.mjs",
  "scripts/startup/lib/process-control.mjs",
  "scripts/startup/lib/health-check.mjs",
  "scripts/startup/lib/open-main-page.mjs",
] as const;

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

export default createPendingDomainInspector({
  inspector: "GrassEye Local App Shell Owner Inspector",
  inspectorId: "local-app-shell-owner",
  capabilityDomain: "local-app-shell",
  inspectorEntry: "scripts/audit/domains/local-app-shell/inspector.ts",
  ownedPaths: ["src/app/server.ts", "src/lib/local-runtime"],
  pendingSummary: "local-app-shell implementation is partial; local console or local runtime shell enforcement is still manual-first",
  implementedSummary: "local app shell is implemented as a localhost workbench with local runtime surfaces",
  extraChecks: async () => {
    const findings = [];
    const auditProject = getAuditProject();
    const startupProject = createStartupProject();
    const serverSource = getSourceFileOrThrow(auditProject, "src/app/server.ts");
    const consoleViewSource = getSourceFileOrThrow(auditProject, "src/features/operator-control/console-view.ts");
    const workbenchSource = getSourceFileOrThrow(auditProject, "src/lib/local-runtime/workbench.ts");
    const launchSource = startupProject.getSourceFile(pathFromRepoRoot(STARTUP_ENTRY));
    const relativeServerPath = toRelativeSourcePath(serverSource);
    const relativeConsoleViewPath = toRelativeSourcePath(consoleViewSource);
    const relativeWorkbenchPath = toRelativeSourcePath(workbenchSource);

    const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(pathFromRepoRoot("package.json"));

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
    if (!serverText.includes('url.pathname === "/api/runtime/snapshot"')) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1",
          file: relativeServerPath,
          line: 1,
          severity: "error",
          message: "Server shell must preserve the JSON snapshot endpoint under /api/runtime/snapshot.",
        }),
      );
    }

    if (!serverText.includes('url.pathname === "/"') || !serverText.includes("renderOperatorConsole(")) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1",
          file: relativeServerPath,
          line: 1,
          severity: "error",
          message: "Root route must render the operator console HTML rather than a JSON response.",
        }),
      );
    }

    const consoleViewText = consoleViewSource.getFullText();
    if (consoleViewText.includes('<pre id="snapshot">') || consoleViewText.includes("JSON.stringify(snapshot, null, 2)")) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
          file: relativeConsoleViewPath,
          line: 1,
          severity: "error",
          message: "Operator console must not render raw snapshot JSON as the root-page body.",
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
      if (serverText.includes(marker) || consoleViewText.includes(marker) || workbenchSource.getFullText().includes(marker)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-001-V1",
            file: serverText.includes(marker) ? relativeServerPath : (consoleViewText.includes(marker) ? relativeConsoleViewPath : relativeWorkbenchPath),
            line: 1,
            severity: "error",
            message: `Local app shell must not retain simulated runtime marker: ${marker}`,
          }),
        );
      }
    }

    const requiredConsoleSurfaceMarkers = [
      "snapshot.mode",
      "snapshot.runtime.components",
      "buildLocaleHref(",
      "snapshot.mode.executionMode",
      "snapshot.mode.geometryGuard",
      "snapshot.mode.viewport",
      "snapshot.mode.calibration",
    ];
    for (const marker of requiredConsoleSurfaceMarkers) {
      if (!consoleViewText.includes(marker)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
            file: relativeConsoleViewPath,
            line: 1,
            severity: "error",
            message: `Root operator console must preserve the local shell surface marker: ${marker}`,
          }),
        );
      }
    }

    const requiredWorkbenchImports = [
      { moduleSpecifier: "../../features/local-data/evidence-store-service.js", importedName: "EvidenceStoreService" },
      { moduleSpecifier: "../local-ai/local-ai-gateway.js", importedName: "LocalAiGateway" },
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

    const hasRealBrowserBoundary = hasNamedImport(workbenchSource, "../browser/playwright-browser-controller.js", "PlaywrightBrowserController");
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
      launch: "node scripts/startup/launch-grasseye.mjs",
      "start:local": "node scripts/startup/launch-grasseye.mjs",
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
        { moduleSpecifier: "./lib/open-main-page.mjs", importedName: "openMainPage" },
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
        ? getIdentifierCallWithin(openReadyPageFunction, "openMainPage")
        : getIdentifierCall(launchSource, "openMainPage");
      const openCall = performLaunchFunction
        ? getIdentifierCallWithin(performLaunchFunction, "openReadyPage") ??
          getIdentifierCallWithin(performLaunchFunction, "openMainPage")
        : getIdentifierCall(launchSource, "openMainPage");

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
            message: "Launch entry must open the main page after health passes.",
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
  },
});