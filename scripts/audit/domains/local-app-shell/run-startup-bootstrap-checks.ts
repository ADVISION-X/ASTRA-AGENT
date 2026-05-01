import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { fileExists, readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { getNodeLine } from "../../core/ts-morph.js";

import { localAppShellInspectionConstants as config } from "./inspection-constants.js";
import {
  createStartupProject,
  getIdentifierCall,
  getIdentifierCallWithin,
  getPropertyPath,
  getResolvedRelativeImport,
  hasNamedImport,
} from "./inspection-utils.js";

const collectRequiredStartupFileFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const helperPath of [config.STARTUP_ENTRY, ...config.STARTUP_HELPERS]) {
    if (!(await fileExists(pathFromRepoRoot(helperPath)))) {
      findings.push(createFinding({
        lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1",
        file: helperPath,
        line: 1,
        severity: "error",
        message: "Startup bootstrap path is missing a required script file.",
      }));
    }
  }
  return findings;
};

const collectPackageScriptFindings = async (): Promise<Finding[]> => {
  const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(pathFromRepoRoot("package.json"));
  return packageJson.scripts?.["grasseye:start"] === "node scripts/startup/launch-grasseye.mjs"
    ? []
    : [createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1", file: "package.json", line: 1, severity: "error", message: "package.json must expose grasseye:start as node scripts/startup/launch-grasseye.mjs." })];
};

const collectLaunchImportFindings = (launchSource: import("ts-morph").SourceFile): Finding[] => {
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

  return requiredLaunchImports.flatMap((requiredImport) => {
    return hasNamedImport(launchSource, requiredImport.moduleSpecifier, requiredImport.importedName)
      ? []
      : [createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1", file: config.STARTUP_ENTRY, line: 1, severity: "error", message: `Launch entry must import ${requiredImport.importedName} from ${requiredImport.moduleSpecifier}.` })];
  });
};

const collectLaunchSequenceFindings = (launchSource: import("ts-morph").SourceFile): Finding[] => {
  const findings: Finding[] = [];
  const performLaunchFunction = launchSource.getFunction("performLaunch");
  const openReadyPageFunction = launchSource.getFunction("openReadyPage");
  const clearPortCall = performLaunchFunction ? getIdentifierCallWithin(performLaunchFunction, "clearPortListeners") : getIdentifierCall(launchSource, "clearPortListeners");
  const startCall = performLaunchFunction ? getIdentifierCallWithin(performLaunchFunction, "startLocalService") : getIdentifierCall(launchSource, "startLocalService");
  const healthCall = performLaunchFunction ? getIdentifierCallWithin(performLaunchFunction, "waitForHealth") : getIdentifierCall(launchSource, "waitForHealth");
  const openMainPageCall = openReadyPageFunction ? getIdentifierCallWithin(openReadyPageFunction, "openCommanderConsole") : getIdentifierCall(launchSource, "openCommanderConsole");
  const openCall = performLaunchFunction ? getIdentifierCallWithin(performLaunchFunction, "openReadyPage") ?? getIdentifierCallWithin(performLaunchFunction, "openCommanderConsole") : getIdentifierCall(launchSource, "openCommanderConsole");

  findings.push(...collectMissingLaunchCallFindings({ clearPortCall, startCall, healthCall, openCall, openMainPageCall }));
  findings.push(...collectLaunchOrderingFindings({ clearPortCall, startCall, healthCall, openCall }));
  findings.push(...collectStartArgumentFindings(startCall));
  if (launchSource.getFullText().includes("reusing current service") || launchSource.getFullText().includes("probeHealth(")) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1", file: config.STARTUP_ENTRY, line: 1, severity: "error", message: "Launch entry must not reuse an existing listener instead of reclaiming clean port ownership." }));
  }

  return findings;
};

const collectMissingLaunchCallFindings = (input: {
  clearPortCall: Node | undefined;
  startCall: Node | undefined;
  healthCall: Node | undefined;
  openCall: Node | undefined;
  openMainPageCall: Node | undefined;
}): Finding[] => {
  const callChecks = [
    { node: input.clearPortCall, message: "Launch entry must force-clear the canonical startup port before runtime launch." },
    { node: input.startCall, message: "Launch entry must start the local service through startLocalService." },
    { node: input.healthCall, message: "Launch entry must wait for the health gate before declaring success." },
    { node: input.openCall && input.openMainPageCall, message: "Launch entry must open Commander Console after health passes." },
  ];

  return callChecks.flatMap((check) => {
    return check.node ? [] : [createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1", file: config.STARTUP_ENTRY, line: 1, severity: "error", message: check.message })];
  });
};

const collectLaunchOrderingFindings = (input: {
  clearPortCall: Node | undefined;
  startCall: Node | undefined;
  healthCall: Node | undefined;
  openCall: Node | undefined;
}): Finding[] => {
  const findings: Finding[] = [];
  if (input.clearPortCall && input.startCall && input.clearPortCall.getStart() > input.startCall.getStart()) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1", file: config.STARTUP_ENTRY, line: getNodeLine(input.startCall), severity: "error", message: "Launch entry must clear the canonical startup port before startLocalService runs." }));
  }
  if (input.healthCall && input.openCall && input.healthCall.getStart() > input.openCall.getStart()) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1", file: config.STARTUP_ENTRY, line: getNodeLine(input.openCall), severity: "error", message: "Launch entry must gate page opening behind a completed health check." }));
  }
  return findings;
};

const collectStartArgumentFindings = (startCall: Node | undefined): Finding[] => {
  if (!startCall || !Node.isCallExpression(startCall)) {
    return [];
  }

  const startArgument = startCall.getArguments()[0];
  const startRootPath = startArgument && Node.isObjectLiteralExpression(startArgument)
    ? getPropertyPath(startArgument.getProperty("rootDir")?.getFirstDescendantByKind(SyntaxKind.Identifier))
    : [];
  return startRootPath.length > 0 && startRootPath[0] === "rootDir"
    ? []
    : [createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1", file: config.STARTUP_ENTRY, line: getNodeLine(startCall), severity: "error", message: "Launch entry must pass the repository root into startLocalService." })];
};

const getStartupBoundaryImportFinding = (relativePath: string, importDeclaration: import("ts-morph").ImportDeclaration): Finding | null => {
  const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
  if (moduleSpecifier.startsWith("node:")) {
    return null;
  }

  const resolvedImport = getResolvedRelativeImport(relativePath, moduleSpecifier);
  return resolvedImport && resolvedImport.startsWith("scripts/startup/")
    ? null
    : createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1", file: relativePath, line: getNodeLine(importDeclaration), severity: "error", message: "Startup scripts must stay inside the startup boundary and must not import business domains." });
};

const collectSourceImportFindings = (sourceFile: import("ts-morph").SourceFile): Finding[] => {
  const relativePath = toRepoRelativePath(sourceFile.getFilePath());
  return sourceFile.getImportDeclarations().flatMap((importDeclaration) => {
    const finding = getStartupBoundaryImportFinding(relativePath, importDeclaration);
    return finding ? [finding] : [];
  });
};

const collectStartupBoundaryImportFindings = (startupProject: ReturnType<typeof createStartupProject>): Finding[] => {
  return startupProject.getSourceFiles().flatMap((sourceFile) => collectSourceImportFindings(sourceFile));
};

export const runStartupBootstrapChecks = async (): Promise<Finding[]> => {
  const startupProject = createStartupProject();
  const launchSource = startupProject.getSourceFile(pathFromRepoRoot(config.STARTUP_ENTRY));
  const findings = [
    ...await collectRequiredStartupFileFindings(),
    ...await collectPackageScriptFindings(),
  ];

  if (!launchSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-APP-SHELL-004-V1", file: config.STARTUP_ENTRY, line: 1, severity: "error", message: "Startup entry file must be parseable by audit enforcement." }));
    return findings;
  }

  return [
    ...findings,
    ...collectLaunchImportFindings(launchSource),
    ...collectLaunchSequenceFindings(launchSource),
    ...collectStartupBoundaryImportFindings(startupProject),
  ];
};