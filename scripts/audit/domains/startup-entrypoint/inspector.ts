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

export const inspectStartupEntrypointBoundary = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
    const findings: Finding[] = [];
    const startupProject = createStartupProject();
    const launchSource = startupProject.getSourceFile(pathFromRepoRoot(STARTUP_ENTRY));
    const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(pathFromRepoRoot("package.json"));

    const startupScripts = Object.entries(packageJson.scripts ?? {}).filter(([, command]) => command.includes("scripts/startup/launch-grasseye.mjs"));
    if (packageJson.scripts?.["grasseye:start"] !== "node scripts/startup/launch-grasseye.mjs") {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1",
          file: "package.json",
          line: 1,
          severity: "error",
          message: "package.json must expose grasseye:start as the canonical startup command.",
        }),
      );
    }

    if (startupScripts.length !== 1 || startupScripts[0]?.[0] !== "grasseye:start") {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1",
          file: "package.json",
          line: 1,
          severity: "error",
          message: "Exactly one package script may point to launch-grasseye.mjs, and it must be grasseye:start.",
          detail: startupScripts.map(([scriptName]) => scriptName).join(", "),
        }),
      );
    }

    for (const scriptName of COMPETING_SCRIPT_NAMES) {
      if (scriptName in (packageJson.scripts ?? {})) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1",
            file: "package.json",
            line: 1,
            severity: "error",
            message: `Competing startup script ${scriptName} must not remain user-facing.`,
          }),
        );
      }
    }

    if (!launchSource) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-STARTUP-ENTRYPOINT-004-V1",
          file: STARTUP_ENTRY,
          line: 1,
          severity: "error",
          message: "Startup entrypoint must remain parseable by AST-based audit enforcement.",
        }),
      );
      return {
        findings,
        phases: [
          createPhase("startup-entrypoint-unique-source", "CODE VIOLATION", false, "Startup entrypoint file must remain parseable by AST-based audit enforcement."),
        ],
      };
    }

    const requiredImports = [
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
    for (const [moduleSpecifier, importedName] of requiredImports) {
      if (!hasImport(launchSource, moduleSpecifier, importedName)) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1",
            file: STARTUP_ENTRY,
            line: 1,
            severity: "error",
            message: `Startup entrypoint must import ${importedName} from ${moduleSpecifier}.`,
          }),
        );
      }
    }

    for (const declaration of launchSource.getImportDeclarations()) {
      const moduleSpecifier = declaration.getModuleSpecifierValue();
      if (moduleSpecifier.startsWith("node:")) {
        continue;
      }

      const resolvedImport = resolveRelativeImport(toRepoRelativePath(launchSource.getFilePath()), moduleSpecifier);
      if (!resolvedImport || !resolvedImport.startsWith("scripts/startup/lib/")) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1",
            file: STARTUP_ENTRY,
            line: getNodeLine(declaration),
            severity: "error",
            message: "Startup entrypoint may import only Node builtins and startup/lib helpers.",
            detail: moduleSpecifier,
          }),
        );
      }
    }

    for (const sourceFile of startupProject.getSourceFiles()) {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      for (const declaration of sourceFile.getImportDeclarations()) {
        const resolvedImport = resolveRelativeImport(relativePath, declaration.getModuleSpecifierValue());
        if (resolvedImport && !resolvedImport.startsWith("scripts/startup/lib/")) {
          findings.push(
            createFinding({
              lawId: "GRASSEYE-STARTUP-ENTRYPOINT-001-V1",
              file: relativePath,
              line: getNodeLine(declaration),
              severity: "error",
              message: "Startup helpers must not reach outside scripts/startup/lib through relative imports.",
              detail: declaration.getModuleSpecifierValue(),
            }),
          );
        }
      }
    }

    const forbiddenStringHints = ["scripts/verify", "src/capabilities/", "src/lib/browser", "src/features/platform-action", "BrowserController"];
    for (const literal of launchSource.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      const value = literal.getLiteralText();
      if (forbiddenStringHints.some((hint) => value.includes(hint))) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-STARTUP-ENTRYPOINT-004-V1",
            file: STARTUP_ENTRY,
            line: getNodeLine(literal),
            severity: "error",
            message: "Startup entrypoint must not reference verify paths, capability internals, browser owners, or platform adapters.",
            detail: value,
          }),
        );
      }
    }

    for (const callExpression of launchSource.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expression = callExpression.getExpression();
      if (Node.isIdentifier(expression) && FORBIDDEN_CALLS.includes(expression.getText())) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-STARTUP-ENTRYPOINT-002-V1",
            file: STARTUP_ENTRY,
            line: getNodeLine(callExpression),
            severity: "fatal",
            message: `Startup entrypoint must not call governed mission or command method ${expression.getText()}.`,
          }),
        );
      }
    }

    return {
      findings,
      phases: [
        createPhase("startup-entrypoint-unique-source", findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-001-V1") ? "PASS" : "CODE VIOLATION", findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-001-V1"), findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-001-V1") ? "Startup keeps one canonical user command, one entry file, and one startup/lib import surface." : "Startup still exposes duplicate commands or unguided import drift."),
        createPhase("startup-entrypoint-command-boundary", findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-002-V1") ? "PASS" : "CODE VIOLATION", findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-002-V1"), findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-002-V1") ? "Startup bootstrap stays out of mission and command ownership." : "Startup bootstrap still reaches governed mission or command methods directly."),
        createPhase("startup-entrypoint-open-sequence", findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-003-V1") ? "PASS" : "CODE VIOLATION", findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-003-V1"), findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-003-V1") ? "Startup preserves the dependency, service, health, open, readiness, and terminal-log sequence." : "Startup no longer preserves the governed bootstrap sequence."),
        createPhase("startup-entrypoint-anti-escape", findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-004-V1") ? "PASS" : "CODE VIOLATION", findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-004-V1"), findings.every((finding) => finding.lawId !== "GRASSEYE-STARTUP-ENTRYPOINT-004-V1") ? "Startup stays free of verify paths, capability internals, and second-entry escape hatches." : "Startup still references forbidden internals or second-entry drift."),
      ],
    };
};