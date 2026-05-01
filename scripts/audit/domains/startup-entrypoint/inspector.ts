import path from "node:path";

import { Node, Project, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getNodeLine } from "../../core/ts-morph.js";

const STARTUP_ENTRY = "scripts/startup/launch-grasseye.mjs";
const STARTUP_HELPERS = [
  "scripts/startup/lib/dependency-check.mjs",
  "scripts/startup/lib/process-control.mjs",
  "scripts/startup/lib/health-check.mjs",
  "scripts/startup/lib/local-ai-runtime-readiness.mjs",
  "scripts/startup/lib/open-commander-console.mjs",
  "scripts/startup/lib/terminal-structured-log.mjs",
] as const;
const COMPETING_SCRIPT_NAMES = ["launch", "start:local", "start:workbench", "start:operator-control", "start:agent", "verify:startup"];
const FORBIDDEN_CALLS = ["startTask", "pauseTask", "resumeTask", "stopTask", "issueHumanCommand", "resetLocalStore"];

const createStartupProject = (): Project => {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });

  project.addSourceFileAtPath(pathFromRepoRoot(STARTUP_ENTRY));
  for (const helperPath of STARTUP_HELPERS) {
    project.addSourceFileAtPathIfExists(pathFromRepoRoot(helperPath));
  }

  return project;
};

const resolveRelativeImport = (relativeFilePath: string, moduleSpecifier: string): string | null => {
  if (!moduleSpecifier.startsWith(".")) {
    return null;
  }

  return path.normalize(path.join(path.dirname(relativeFilePath), moduleSpecifier)).replace(/\\/g, "/");
};

const hasImport = (sourceFile: import("ts-morph").SourceFile, moduleSpecifier: string, importedName: string): boolean =>
  sourceFile.getImportDeclarations().some(
    (declaration) =>
      declaration.getModuleSpecifierValue() === moduleSpecifier &&
      declaration.getNamedImports().some((specifier) => specifier.getName() === importedName),
  );

const REQUIRED_IMPORTS = [
  ["./lib/dependency-check.mjs", "assessDependencyState"],
  ["./lib/dependency-check.mjs", "installDependencies"],
  ["./lib/process-control.mjs", "clearPortListeners"],
  ["./lib/process-control.mjs", "startLocalService"],
  ["./lib/process-control.mjs", "stopLocalService"],
  ["./lib/health-check.mjs", "waitForHealth"],
  ["./lib/local-ai-runtime-readiness.mjs", "ensureLocalAiRuntimeReady"],
  ["./lib/open-commander-console.mjs", "openCommanderConsole"],
  ["./lib/terminal-structured-log.mjs", "createTerminalStructuredLogger"],
] as const;

const FORBIDDEN_STRING_HINTS = ["scripts/verify", "src/capabilities/", "src/lib/browser", "src/features/platform-action", "BrowserController"];

type StartupFindingInput = {
  lawId: string;
  file: string;
  message: string;
  line?: number;
  detail?: string;
  severity?: "error" | "fatal";
};

function createStartupFinding(input: StartupFindingInput): Finding {
  return createFinding({
    lawId: input.lawId,
    file: input.file,
    line: input.line ?? 1,
    severity: input.severity ?? "error",
    message: input.message,
    detail: input.detail,
  });
}

function collectPackageScriptFindings(packageJson: { scripts?: Record<string, string> }): Finding[] {
  const findings: Finding[] = [];
  const startupScripts = Object.entries(packageJson.scripts ?? {}).filter(([, command]) => command.includes("scripts/startup/launch-grasseye.mjs"));
  if (packageJson.scripts?.["grasseye:start"] !== "node scripts/startup/launch-grasseye.mjs") {
    findings.push(createStartupFinding({ lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1", file: "package.json", message: "package.json must expose grasseye:start as the canonical startup command." }));
  }
  if (startupScripts.length !== 1 || startupScripts[0]?.[0] !== "grasseye:start") {
    findings.push(createStartupFinding({ lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1", file: "package.json", message: "Exactly one package script may point to launch-grasseye.mjs, and it must be grasseye:start.", detail: startupScripts.map(([scriptName]) => scriptName).join(", ") }));
  }
  for (const scriptName of COMPETING_SCRIPT_NAMES) {
    if (scriptName in (packageJson.scripts ?? {})) {
      findings.push(createStartupFinding({ lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1", file: "package.json", message: `Competing startup script ${scriptName} must not remain user-facing.` }));
    }
  }
  return findings;
}

function collectLaunchImportFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];
  for (const [moduleSpecifier, importedName] of REQUIRED_IMPORTS) {
    if (!hasImport(launchSource, moduleSpecifier, importedName)) {
      findings.push(createStartupFinding({ lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1", file: STARTUP_ENTRY, message: `Startup entrypoint must import ${importedName} from ${moduleSpecifier}.` }));
    }
  }
  for (const declaration of launchSource.getImportDeclarations()) {
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    if (moduleSpecifier.startsWith("node:")) {
      continue;
    }
    const resolvedImport = resolveRelativeImport(toRepoRelativePath(launchSource.getFilePath()), moduleSpecifier);
    if (!resolvedImport || !resolvedImport.startsWith("scripts/startup/lib/")) {
      findings.push(createStartupFinding({ lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1", file: STARTUP_ENTRY, message: "Startup entrypoint may import only Node builtins and startup/lib helpers.", line: getNodeLine(declaration), detail: moduleSpecifier }));
    }
  }
  return findings;
}

function collectSourceFileBoundaryFindings(relativePath: string, sourceFile: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];
  for (const declaration of sourceFile.getImportDeclarations()) {
    const resolvedImport = resolveRelativeImport(relativePath, declaration.getModuleSpecifierValue());
    if (resolvedImport && !resolvedImport.startsWith("scripts/startup/lib/")) {
      findings.push(createStartupFinding({ lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1", file: relativePath, message: "Startup helpers must not reach outside scripts/startup/lib through relative imports.", line: getNodeLine(declaration), detail: declaration.getModuleSpecifierValue() }));
    }
  }
  return findings;
}

function collectHelperBoundaryFindings(startupProject: Project): Finding[] {
  const findings: Finding[] = [];
  for (const sourceFile of startupProject.getSourceFiles()) {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    findings.push(...collectSourceFileBoundaryFindings(relativePath, sourceFile));
  }
  return findings;
}

function collectForbiddenLiteralFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];
  for (const literal of launchSource.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
    const value = literal.getLiteralText();
    if (FORBIDDEN_STRING_HINTS.some((hint) => value.includes(hint))) {
      findings.push(createStartupFinding({ lawId: "GRASSEYE-STARTUP-ENTRYPOINT-004-V1", file: STARTUP_ENTRY, message: "Startup entrypoint must not reference verify paths, capability internals, browser owners, or platform adapters.", line: getNodeLine(literal), detail: value }));
    }
  }
  return findings;
}

function collectForbiddenCallFindings(launchSource: import("ts-morph").SourceFile): Finding[] {
  const findings: Finding[] = [];
  for (const callExpression of launchSource.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    if (Node.isIdentifier(expression) && FORBIDDEN_CALLS.includes(expression.getText())) {
      findings.push(createStartupFinding({ lawId: "GRASSEYE-STARTUP-ENTRYPOINT-002-V1", file: STARTUP_ENTRY, message: `Startup entrypoint must not call governed mission or command method ${expression.getText()}.`, line: getNodeLine(callExpression), severity: "fatal" }));
    }
  }
  return findings;
}

function createUniqueSourcePhase(findings: Finding[]): InspectorPhase {
  const uniqueSourceClean = findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-001-V1");
  return createPhase("startup-entrypoint-unique-source", uniqueSourceClean ? "PASS" : "CODE VIOLATION", uniqueSourceClean, uniqueSourceClean ? "Startup keeps one canonical user command, one entry file, and one startup/lib import surface." : "Startup still exposes duplicate commands or unguided import drift.");
}

function createCommandBoundaryPhase(findings: Finding[]): InspectorPhase {
  const commandBoundaryClean = findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-002-V1");
  return createPhase("startup-entrypoint-command-boundary", commandBoundaryClean ? "PASS" : "CODE VIOLATION", commandBoundaryClean, commandBoundaryClean ? "Startup bootstrap stays out of mission and command ownership." : "Startup bootstrap still reaches governed mission or command methods directly.");
}

function createOpenSequencePhase(findings: Finding[]): InspectorPhase {
  const openSequenceClean = findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-003-V1");
  return createPhase("startup-entrypoint-open-sequence", openSequenceClean ? "PASS" : "CODE VIOLATION", openSequenceClean, openSequenceClean ? "Startup preserves the dependency, service, health, open, readiness, and terminal-log sequence." : "Startup no longer preserves the governed bootstrap sequence.");
}

function createStartupAntiEscapePhase(findings: Finding[]): InspectorPhase {
  const antiEscapeClean = findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-004-V1");
  return createPhase("startup-entrypoint-anti-escape", antiEscapeClean ? "PASS" : "CODE VIOLATION", antiEscapeClean, antiEscapeClean ? "Startup stays free of verify paths, capability internals, and second-entry escape hatches." : "Startup still references forbidden internals or second-entry drift.");
}

function createStartupPhases(findings: Finding[]): InspectorPhase[] {
  return [
    createUniqueSourcePhase(findings),
    createCommandBoundaryPhase(findings),
    createOpenSequencePhase(findings),
    createStartupAntiEscapePhase(findings),
  ];
}

export const inspectStartupEntrypointBoundary = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const startupProject = createStartupProject();
  const launchSource = startupProject.getSourceFile(pathFromRepoRoot(STARTUP_ENTRY));
  const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(pathFromRepoRoot("package.json"));
  const findings = collectPackageScriptFindings(packageJson);
  if (!launchSource) {
    findings.push(createStartupFinding({ lawId: "GRASSEYE-STARTUP-ENTRYPOINT-004-V1", file: STARTUP_ENTRY, message: "Startup entrypoint must remain parseable by AST-based audit enforcement." }));
    return { findings, phases: [createPhase("startup-entrypoint-unique-source", "CODE VIOLATION", false, "Startup entrypoint file must remain parseable by AST-based audit enforcement.")] };
  }
  findings.push(...collectLaunchImportFindings(launchSource));
  findings.push(...collectHelperBoundaryFindings(startupProject));
  findings.push(...collectForbiddenLiteralFindings(launchSource));
  findings.push(...collectForbiddenCallFindings(launchSource));
  return { findings, phases: createStartupPhases(findings) };
};