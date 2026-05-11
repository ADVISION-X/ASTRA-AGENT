import type { Project } from "ts-morph";

import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, hasAnyKeyword, hasCallExpressionPath, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { commanderConsoleInspectionConstants } from "./inspection-constants.js";
import { commanderConsoleInspectionUtils } from "./inspection-utils.js";

const {
  FORBIDDEN_EXTERNAL_IMPORTS,
  FORBIDDEN_IMPORT_MARKERS,
  ISSUE_HUMAN_COMMAND_CONTRACT_PATH,
  ISSUE_HUMAN_COMMAND_SCHEMA_PATH,
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

type ReviewOnlySurfaceTexts = {
  commandChildrenText: string;
  commandGateText: string;
  commandPayloadText: string;
  workbenchHumanCommandText: string;
};

type ShellAndStartupCheckResult = {
  findings: Finding[];
  shellTransportLeak: boolean;
  startupCommandLeak: boolean;
};

const COMMANDER_ENTRY_LAW_ID = "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V3";
const HUMAN_COMMAND_BOUNDARY_LAW_ID = "GRASSEYE-HUMAN-COMMAND-BOUNDARY-V1";
const SHELL_BOUNDARY_LAW_ID = "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2";

const createBoundaryFinding = (lawId: string, file: string, message: string): Finding => createFinding({
  lawId,
  file,
  line: 1,
  severity: "fatal",
  message,
});

const collectCommandEntryBoundaryFindings = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  const taskHandlerSource = getSourceFileOrThrow(project, TASK_HANDLER_PATH);
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);

  if (!hasCallExpressionPath(taskHandlerSource, ["activeWorkbench", "commanderConsole", "execute"]) || taskHandlerSource.getFullText().includes("issueHumanCommand(")) {
    findings.push(createBoundaryFinding(COMMANDER_ENTRY_LAW_ID, TASK_HANDLER_PATH, "task-api-handlers.ts must reach Commander only through commanderConsole.execute."));
  }
  if (!hasCallExpressionPath(workbenchSource, ["this", "nerveBusAbilityGroup", "dispatchHumanCommand"]) || !workbenchSource.getFullText().includes("createCommanderConsoleAbilityGroup") || workbenchSource.getFullText().includes("showMissionDashboard(")) {
    findings.push(createBoundaryFinding(COMMANDER_ENTRY_LAW_ID, WORKBENCH_PATH, "workbench.ts must compose Commander through execute-only API and governed Nerve Bus transport."));
  }

  return findings;
};

const collectIssueHumanCommandBoundaryFindings = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  const contractSource = getSourceFileOrThrow(project, ISSUE_HUMAN_COMMAND_CONTRACT_PATH);
  const schemaSource = getSourceFileOrThrow(project, ISSUE_HUMAN_COMMAND_SCHEMA_PATH);
  const contractText = contractSource.getFullText();
  const schemaText = schemaSource.getFullText();

  if (!contractText.includes('boundaryDecision: "command-transport-only"') || !contractText.includes('ownedCommandType: "start-mission"')) {
    findings.push(createBoundaryFinding(HUMAN_COMMAND_BOUNDARY_LAW_ID, ISSUE_HUMAN_COMMAND_CONTRACT_PATH, "issue-human-command must stay command-transport-only and own start-mission only."));
  }
  if (!schemaText.includes('commandType: z.literal("start-mission")') || !schemaText.includes("start-mission requires requestedPlatformId") || !schemaText.includes("start-mission requires governed initialPayload")) {
    findings.push(createBoundaryFinding(HUMAN_COMMAND_BOUNDARY_LAW_ID, ISSUE_HUMAN_COMMAND_SCHEMA_PATH, "issue-human-command schema must remain start-mission-only and require governed platform plus initialPayload truth."));
  }
  if (["roundId", "roundIndex", "previousRoundId", "currentPhase", "aiResultRef"].some((fieldName) => schemaText.includes(fieldName))) {
    findings.push(createBoundaryFinding(HUMAN_COMMAND_BOUNDARY_LAW_ID, ISSUE_HUMAN_COMMAND_SCHEMA_PATH, "issue-human-command schema must not absorb round-by-round runtime continuity fields."));
  }

  return findings;
};

const readReviewOnlySurfaceTexts = async (): Promise<ReviewOnlySurfaceTexts> => ({
  commandChildrenText: await readTextFile(pathFromRepoRoot("src/capabilities/commander-console/children/command-children.ts")),
  commandGateText: await readTextFile(pathFromRepoRoot("src/capabilities/commander-console/runtime/commander-command-gate.ts")),
  commandPayloadText: await readTextFile(pathFromRepoRoot("src/capabilities/commander-console/runtime/commander-command-payload.ts")),
  workbenchHumanCommandText: await readTextFile(pathFromRepoRoot("src/lib/local-runtime/workbench-human-command.ts")),
});

const collectCommandChildrenReviewSurfaceFindings = (input: ReviewOnlySurfaceTexts): Finding[] => (
  input.commandChildrenText.includes("APPROVE_CANDIDATE_CHILD") || input.commandChildrenText.includes("REJECT_CANDIDATE_CHILD")
    ? [createBoundaryFinding(HUMAN_COMMAND_BOUNDARY_LAW_ID, "src/capabilities/commander-console/children/command-children.ts", "Commander command child surface must not revive approve/reject candidate commands.")]
    : []
);

const collectCommandGateReviewSurfaceFindings = (input: ReviewOnlySurfaceTexts): Finding[] => (
  input.commandGateText.includes('"approve-candidate"') || input.commandGateText.includes('"reject-candidate"')
    ? [createBoundaryFinding(HUMAN_COMMAND_BOUNDARY_LAW_ID, "src/capabilities/commander-console/runtime/commander-command-gate.ts", "Commander command gate must not expose approve/reject candidate commands.")]
    : []
);

const collectCommandPayloadReviewSurfaceFindings = (input: ReviewOnlySurfaceTexts): Finding[] => (
  input.commandPayloadText.includes('"approve-candidate"') || input.commandPayloadText.includes('"reject-candidate"')
    ? [createBoundaryFinding(HUMAN_COMMAND_BOUNDARY_LAW_ID, "src/capabilities/commander-console/runtime/commander-command-payload.ts", "Commander transport payload builder must not rebuild approve/reject candidate commands.")]
    : []
);

const collectWorkbenchReviewRoutingFindings = (input: ReviewOnlySurfaceTexts): Finding[] => (
  input.workbenchHumanCommandText.includes('case "approve-candidate"') || input.workbenchHumanCommandText.includes('case "reject-candidate"')
    ? [createBoundaryFinding(HUMAN_COMMAND_BOUNDARY_LAW_ID, "src/lib/local-runtime/workbench-human-command.ts", "Workbench human-command routing must keep candidate review fail-closed to mark-review-required only.")]
    : []
);

const collectReviewOnlySurfaceFindings = async (): Promise<Finding[]> => {
  const reviewOnlySurfaceTexts = await readReviewOnlySurfaceTexts();

  return [
    ...collectCommandChildrenReviewSurfaceFindings(reviewOnlySurfaceTexts),
    ...collectCommandGateReviewSurfaceFindings(reviewOnlySurfaceTexts),
    ...collectCommandPayloadReviewSurfaceFindings(reviewOnlySurfaceTexts),
    ...collectWorkbenchReviewRoutingFindings(reviewOnlySurfaceTexts),
  ];
};

const detectShellTransportLeak = (project: Project): boolean => {
  const shellRenderSource = getSourceFileOrThrow(project, SHELL_RENDER_PATH);
  const shellPageClientSource = project.getSourceFile(pathFromRepoRoot(SHELL_PAGE_CLIENT_PATH));

  return shellRenderSource.getFullText().includes("command-transport-port")
    || (shellPageClientSource?.getFullText().includes("command-transport-port") ?? false)
    || (shellPageClientSource?.getFullText().includes("dispatchHumanCommand") ?? false);
};

const collectShellAndStartupFindings = async (project: Project): Promise<ShellAndStartupCheckResult> => {
  const shellTransportLeak = detectShellTransportLeak(project);
  const startupText = await readTextFile(pathFromRepoRoot(STARTUP_PATH));
  const startupCommandLeak = startupText.includes("commanderConsole.execute(") || startupText.includes("dispatchHumanCommand(");
  const findings = [
    ...(shellTransportLeak ? [createBoundaryFinding(SHELL_BOUNDARY_LAW_ID, SHELL_PAGE_CLIENT_PATH, "Local App Shell must not import Commander transport internals or dispatch commands directly.")] : []),
    ...(startupCommandLeak ? [createBoundaryFinding(SHELL_BOUNDARY_LAW_ID, STARTUP_PATH, "Startup must remain bootstrap-only and must not issue Commander commands.")] : []),
  ];

  return { findings, shellTransportLeak, startupCommandLeak };
};

const findForbiddenImportFile = (project: Project) => {
  const commanderSources = getCommanderSourceFiles(project);

  return commanderSources.find((sourceFile) => FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker)));
};

const findAntiEscapeFile = (project: Project) => {
  const commanderSources = getCommanderSourceFiles(project);

  return commanderSources.find((sourceFile) => hasAnyKeyword(sourceFile) || isCommanderAntiEscapeViolation(sourceFile));
};

const findExternalLeakFile = (project: Project) => project.getSourceFiles().find((sourceFile) => {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());

  return !repoPath.startsWith(`${ROOT}/`) && FORBIDDEN_EXTERNAL_IMPORTS.some((marker) => hasImportModuleSpecifier(sourceFile, marker));
});

export async function runCommanderBoundaryChecks(project: Project): Promise<BoundaryCheckResult> {
  const boundaryFindings = [
    ...collectCommandEntryBoundaryFindings(project),
    ...collectIssueHumanCommandBoundaryFindings(project),
    ...await collectReviewOnlySurfaceFindings(),
  ];
  const shellAndStartup = await collectShellAndStartupFindings(project);
  const forbiddenImportFile = findForbiddenImportFile(project);
  if (forbiddenImportFile) {
    boundaryFindings.push(createBoundaryFinding(COMMANDER_ENTRY_LAW_ID, toRepoRelativePath(forbiddenImportFile.getFilePath()), "Commander root must not import other ability implementations or browser/runtime internals."));
  }

  const antiEscapeFile = findAntiEscapeFile(project);
  const antiEscapeFindings = antiEscapeFile
    ? [createBoundaryFinding(COMMANDER_ENTRY_LAW_ID, toRepoRelativePath(antiEscapeFile.getFilePath()), "Commander anti-escape failed: any laundering, suppression, dynamic import, or scattered time allocation detected.")]
    : [];

  const externalLeakFile = findExternalLeakFile(project);
  if (externalLeakFile) {
    boundaryFindings.push(createBoundaryFinding(COMMANDER_ENTRY_LAW_ID, toRepoRelativePath(externalLeakFile.getFilePath()), "External modules must not import Commander children, runtime internals, registry, or transport port directly."));
  }

  return {
    findings: [...boundaryFindings, ...antiEscapeFindings, ...shellAndStartup.findings],
    boundaryViolation: Boolean(boundaryFindings.length > 0 || shellAndStartup.startupCommandLeak || shellAndStartup.shellTransportLeak),
    antiEscapeViolation: Boolean(antiEscapeFile),
  };
}
