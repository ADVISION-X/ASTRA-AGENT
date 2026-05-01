import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, hasAnyKeyword, hasCallExpressionPath, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { commanderConsoleInspectionConstants } from "./inspection-constants.js";
import { commanderConsoleInspectionUtils } from "./inspection-utils.js";

const {
  CANDIDATE_HANDLER_PATH,
  FORBIDDEN_EXTERNAL_IMPORTS,
  FORBIDDEN_IMPORT_MARKERS,
  ROOT,
  SHELL_PAGE_CLIENT_PATH,
  SHELL_RENDER_PATH,
  STARTUP_PATH,
  TASK_HANDLER_PATH,
  WORKBENCH_PATH,
} = commanderConsoleInspectionConstants;
const { getCommanderSourceFiles, isCommanderAntiEscapeViolation } = commanderConsoleInspectionUtils;

type BoundaryCheckResult = {
  findings: Finding[];
  boundaryViolation: boolean;
  antiEscapeViolation: boolean;
};

const collectCommandEntryBoundaryFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const taskHandlerSource = getSourceFileOrThrow(project, TASK_HANDLER_PATH);
  const candidateHandlerSource = getSourceFileOrThrow(project, CANDIDATE_HANDLER_PATH);
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);

  if (!hasCallExpressionPath(taskHandlerSource, ["activeWorkbench", "commanderConsole", "execute"]) || taskHandlerSource.getFullText().includes("issueHumanCommand(")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: TASK_HANDLER_PATH, line: 1, severity: "fatal", message: "task-api-handlers.ts must reach Commander only through commanderConsole.execute." }));
  }
  if (!hasCallExpressionPath(candidateHandlerSource, ["activeWorkbench", "commanderConsole", "execute"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: CANDIDATE_HANDLER_PATH, line: 1, severity: "fatal", message: "candidate-api-handlers.ts must reach Commander only through commanderConsole.execute." }));
  }
  if (!hasCallExpressionPath(workbenchSource, ["this", "nerveBusAbilityGroup", "dispatchHumanCommand"]) || !workbenchSource.getFullText().includes("createCommanderConsoleAbilityGroup") || workbenchSource.getFullText().includes("showMissionDashboard(")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "workbench.ts must compose Commander through execute-only API and governed Nerve Bus transport." }));
  }

  return findings;
};

const detectShellTransportLeak = (project: import("ts-morph").Project): boolean => {
  const shellRenderSource = getSourceFileOrThrow(project, SHELL_RENDER_PATH);
  const shellPageClientSource = project.getSourceFile(pathFromRepoRoot(SHELL_PAGE_CLIENT_PATH));
  return shellRenderSource.getFullText().includes("command-transport-port")
    || (shellPageClientSource?.getFullText().includes("command-transport-port") ?? false)
    || (shellPageClientSource?.getFullText().includes("dispatchHumanCommand") ?? false);
};

const collectShellAndStartupFindings = async (project: import("ts-morph").Project): Promise<{ findings: Finding[]; shellTransportLeak: boolean; startupCommandLeak: boolean }> => {
  const findings: Finding[] = [];
  const shellTransportLeak = detectShellTransportLeak(project);
  const startupText = await readTextFile(pathFromRepoRoot(STARTUP_PATH));
  const startupCommandLeak = startupText.includes("commanderConsole.execute(") || startupText.includes("dispatchHumanCommand(");

  if (shellTransportLeak) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: SHELL_PAGE_CLIENT_PATH, line: 1, severity: "fatal", message: "Local App Shell must not import Commander transport internals or dispatch commands directly." }));
  }
  if (startupCommandLeak) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: STARTUP_PATH, line: 1, severity: "fatal", message: "Startup must remain bootstrap-only and must not issue Commander commands." }));
  }

  return { findings, shellTransportLeak, startupCommandLeak };
};

const findForbiddenImportFile = (project: import("ts-morph").Project) => {
  const commanderSources = getCommanderSourceFiles(project);
  return commanderSources.find((sourceFile) => FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker)));
};

const findAntiEscapeFile = (project: import("ts-morph").Project) => {
  const commanderSources = getCommanderSourceFiles(project);
  return commanderSources.find((sourceFile) => hasAnyKeyword(sourceFile) || isCommanderAntiEscapeViolation(sourceFile));
};

const findExternalLeakFile = (project: import("ts-morph").Project) => {
  return project.getSourceFiles().find((sourceFile) => {
    const repoPath = toRepoRelativePath(sourceFile.getFilePath());
    return !repoPath.startsWith(`${ROOT}/`) && FORBIDDEN_EXTERNAL_IMPORTS.some((marker) => hasImportModuleSpecifier(sourceFile, marker));
  });
};

export async function runCommanderBoundaryChecks(project: import("ts-morph").Project): Promise<BoundaryCheckResult> {
  const commandEntryFindings = collectCommandEntryBoundaryFindings(project);
  const shellAndStartup = await collectShellAndStartupFindings(project);
  const forbiddenImportFile = findForbiddenImportFile(project);
  if (forbiddenImportFile) {
    commandEntryFindings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: toRepoRelativePath(forbiddenImportFile.getFilePath()), line: 1, severity: "fatal", message: "Commander root must not import other ability implementations or browser/runtime internals." }));
  }

  const antiEscapeFile = findAntiEscapeFile(project);
  if (antiEscapeFile) {
    commandEntryFindings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: toRepoRelativePath(antiEscapeFile.getFilePath()), line: 1, severity: "fatal", message: "Commander anti-escape failed: any laundering, suppression, dynamic import, or scattered time allocation detected." }));
  }

  const externalLeakFile = findExternalLeakFile(project);
  if (externalLeakFile) {
    commandEntryFindings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: toRepoRelativePath(externalLeakFile.getFilePath()), line: 1, severity: "fatal", message: "External modules must not import Commander children, runtime internals, registry, or transport port directly." }));
  }

  return {
    findings: [...commandEntryFindings, ...shellAndStartup.findings],
    boundaryViolation: Boolean(forbiddenImportFile || externalLeakFile || shellAndStartup.startupCommandLeak || shellAndStartup.shellTransportLeak),
    antiEscapeViolation: Boolean(antiEscapeFile),
  };
}