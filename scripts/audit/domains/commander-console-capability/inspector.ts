import { createFinding, createPhase } from "../../core/result.js";
import path from "node:path";

import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  hasCallExpressionPath,
  createAuditProject,
  getSourceFileOrThrow,
  getTypeAliasPropertyNames,
  hasExportModuleSpecifier,
  hasIdentifier,
  hasImportModuleSpecifier,
  hasInterfaceMethod,
  hasLiteralTextFragment,
  hasNullishCoalescingLiteral,
  hasPropertyAccessPath,
  hasPropertyNamed,
  hasStringLiteral,
  hasTypeReference,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectLocalAppShellBoundary } from "../local-app-shell/inspector.js";
import { inspectStartupEntrypointBoundary } from "../startup-entrypoint/inspector.js";

const ROOT = "src/capabilities/commander-console";
const CHILDREN_ROOT = `${ROOT}/children`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const READ_MODELS_PATH = `${ROOT}/read-models.ts`;
const COMMAND_BUILDER_PATH = `${ROOT}/command-builder.ts`;
const COMMAND_POLICY_PATH = `${ROOT}/shared/command-policy.ts`;
const COMMANDER_RESULT_PATH = `${ROOT}/shared/commander-result.ts`;
const HEALTH_SUMMARY_PATH = `${ROOT}/shared/health-summary.ts`;
const REVIEW_DECISION_PATH = `${ROOT}/shared/review-decision.ts`;
const VIEW_MODEL_TYPES_PATH = `${ROOT}/shared/view-model-types.ts`;
const COMMAND_TRANSPORT_PORT_PATH = `${ROOT}/ports/command-transport-port.ts`;
const MISSION_READ_MODEL_PORT_PATH = `${ROOT}/ports/mission-read-model-port.ts`;
const FORENSICS_READ_MODEL_PORT_PATH = `${ROOT}/ports/forensics-read-model-port.ts`;
const CAPABILITY_HEALTH_PORT_PATH = `${ROOT}/ports/capability-health-read-model-port.ts`;
const AUDIT_READ_MODEL_PORT_PATH = `${ROOT}/ports/audit-read-model-port.ts`;
const RUNTIME_PROOF_READ_MODEL_PORT_PATH = `${ROOT}/ports/runtime-proof-read-model-port.ts`;
const TASK_HANDLER_PATH = "src/app/task-api-handlers.ts";
const CANDIDATE_HANDLER_PATH = "src/app/candidate-api-handlers.ts";
const SERVER_HELPER_PATH = "src/app/create-workbench-server.ts";
const SHELL_RENDER_PATH = "src/lib/local-app-shell/render-commander-console-page.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const STARTUP_PATH = "scripts/startup/launch-grasseye.mjs";
const VERIFY_PATH = "scripts/verify/verify-commander-console-capabilities.ts";
const LEGACY_OPERATOR_CONTROL_ROOT = "src/features/operator-control";

const REQUIRED_CHILDREN = [
  "issue-human-command",
  "show-mission-dashboard",
  "show-capability-roster",
  "show-capability-health",
  "show-operational-map-progress",
  "show-runtime-proof-timeline",
  "show-evidence-packets",
  "show-browse-ledger",
  "show-failed-records",
  "show-review-queue",
  "show-audit-summary",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
  "inspect-record-detail",
] as const;

const REQUIRED_FILES = [
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  INDEX_PATH,
  REGISTRY_PATH,
  READ_MODELS_PATH,
  COMMAND_BUILDER_PATH,
  COMMAND_POLICY_PATH,
  COMMANDER_RESULT_PATH,
  HEALTH_SUMMARY_PATH,
  REVIEW_DECISION_PATH,
  VIEW_MODEL_TYPES_PATH,
  COMMAND_TRANSPORT_PORT_PATH,
  MISSION_READ_MODEL_PORT_PATH,
  FORENSICS_READ_MODEL_PORT_PATH,
  CAPABILITY_HEALTH_PORT_PATH,
  AUDIT_READ_MODEL_PORT_PATH,
  RUNTIME_PROOF_READ_MODEL_PORT_PATH,
  SHELL_RENDER_PATH,
] as const;

const RETIRED_FILES = [
  `${ROOT}/build-pending-analysis-candidate.ts`,
  `${ROOT}/build-browse-runtime-snapshot.ts`,
  `${ROOT}/build-runtime-skill-matrix-snapshot.ts`,
  `${ROOT}/runtime-skill-catalog.ts`,
  `${ROOT}/runtime-skill-resolution.ts`,
  `${ROOT}/children.ts`,
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "features/local-data",
  "types/agent-skill",
  "types/evidence-packet",
  "types/local-ai",
  "types/runtime",
  "types/task-run",
  "build-pending-analysis-candidate",
  "build-browse-runtime-snapshot",
  "build-runtime-skill-matrix-snapshot",
  "runtime-skill-catalog",
  "runtime-skill-resolution",
  "BrowserController",
  "platform-action",
] as const;

const FORBIDDEN_DRIFT_TOKENS = ["compat", "legacy", "bridge"] as const;

function sourceCarriesDriftMarker(sourceFile: import("ts-morph").SourceFile): boolean {
  const relativePath = toRepoRelativePath(sourceFile.getFilePath()).toLowerCase();
  if (FORBIDDEN_DRIFT_TOKENS.some((token) => path.basename(relativePath).includes(token))) {
    return true;
  }

  const moduleSpecifiers = [
    ...sourceFile.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue() ?? ""),
    ...sourceFile.getExportDeclarations().map((declaration) => declaration.getModuleSpecifierValue() ?? ""),
  ].map((specifier) => specifier.toLowerCase());
  return moduleSpecifiers.some((specifier) => FORBIDDEN_DRIFT_TOKENS.some((token) => specifier.includes(token)));
}

export default createPendingDomainInspector({
  inspector: "GrassEye Commander Console Capability Owner Inspector",
  inspectorId: "commander-console-capability-owner",
  capabilityDomain: "commander-console-capability",
  inspectorEntry: "scripts/audit/domains/commander-console-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "commander-console-capability law exists but commander transport and read-model cutover may still drift",
  implementedSummary: "commander-console-capability is implemented as the governed human command and read-only dashboard owner",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const readModelsSource = getSourceFileOrThrow(project, READ_MODELS_PATH);
    const viewModelTypesSource = getSourceFileOrThrow(project, VIEW_MODEL_TYPES_PATH);
    const taskHandlerSource = getSourceFileOrThrow(project, TASK_HANDLER_PATH);
    const candidateHandlerSource = getSourceFileOrThrow(project, CANDIDATE_HANDLER_PATH);
    const serverHelperSource = getSourceFileOrThrow(project, SERVER_HELPER_PATH);
    const shellRenderSource = getSourceFileOrThrow(project, SHELL_RENDER_PATH);
    const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
    const rootSourceFiles = project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
    const startupSource = await readTextFile(pathFromRepoRoot(STARTUP_PATH));
    const findings: Finding[] = [];

    const requiredFiles = await Promise.all(REQUIRED_FILES.map(async (file) => ({ file, exists: await fileExists(pathFromRepoRoot(file)) })));
    for (const requiredFile of requiredFiles) {
      if (!requiredFile.exists) {
        findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: requiredFile.file, line: 1, severity: "fatal", message: "Required Commander Console canonical file is missing." }));
      }
    }

    const childFiles = await listFilesRecursive(pathFromRepoRoot(CHILDREN_ROOT), { extensions: [".ts"] });
    const childFileSet = new Set(childFiles.map((filePath) => toRepoRelativePath(filePath)));
    for (const childId of REQUIRED_CHILDREN) {
      const expectedFile = `${CHILDREN_ROOT}/${childId}/implementation.ts`;
      if (!childFileSet.has(expectedFile)) {
        findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: expectedFile, line: 1, severity: "fatal", message: "Commander Console required child implementation is missing." }));
      }
    }

    const retiredFiles = await Promise.all(RETIRED_FILES.map(async (file) => ({ file, exists: await fileExists(pathFromRepoRoot(file)) })));
    for (const retiredFile of retiredFiles) {
      if (retiredFile.exists) {
        findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: retiredFile.file, line: 1, severity: "fatal", message: "Retired Commander Console residue must stay deleted." }));
      }
    }

    const contractShapePassed = hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "issueHumanCommand")
      && hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "showMissionDashboard")
      && hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "pauseMission")
      && hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "resumeMission")
      && hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "stopMission")
      && hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "emergencyStop")
      && hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "approveCandidate")
      && hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "rejectCandidate")
      && hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "markReviewRequired")
      && hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "inspectRecordDetail");
    if (!contractShapePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Commander Console contract must expose the governed mission and review surface." }));
    }

    const contractLeaksForbiddenTruth = hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "resetLocalStore")
      || hasTypeReference(contractSource, "OrchestrationAbilityGroup");
    if (contractLeaksForbiddenTruth) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Commander Console contract must not expose resetLocalStore or raw Orchestration ownership." }));
    }

    const createInputProps = getTypeAliasPropertyNames(contractSource, "CreateCommanderConsoleAbilityGroupInput");
    if (createInputProps.has("defaultRequestedPlatformId")) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Commander Console input must not hide platform truth behind defaultRequestedPlatformId." }));
    }

    const missionViewProps = getTypeAliasPropertyNames(viewModelTypesSource, "CommanderMissionView");
    if (missionViewProps.has("activeTaskRunId") || !missionViewProps.has("missionRunRef")) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: VIEW_MODEL_TYPES_PATH, line: 1, severity: "fatal", message: "Commander mission view must expose Commander-owned missionRunRef and must not preserve activeTaskRunId naming." }));
    }

    if (hasStringLiteral(readModelsSource, "Task Run") || hasIdentifier(readModelsSource, "activeTaskRunId")) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: READ_MODELS_PATH, line: 1, severity: "fatal", message: "Commander read models must not surface Task Run or activeTaskRunId naming." }));
    }

    const indexExportsChildren = indexSource.getExportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("children/"));
    if (indexExportsChildren) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Commander Console index must not leak child implementation paths." }));
    }

    const forbiddenImports = rootSourceFiles.flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      const importSpecifiers = sourceFile.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue() ?? "");
      return FORBIDDEN_IMPORT_MARKERS.some((marker) => importSpecifiers.some((specifier) => specifier.includes(marker))) ? [relativePath] : [];
    });
    if (forbiddenImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: forbiddenImports[0]!, line: 1, severity: "fatal", message: "Commander Console root must not import local-data, old runtime builders, or platform/runtime internals." }));
    }

    const directOrchestrationCalls = hasImportModuleSpecifier(abilityGroupSource, "capabilities/orchestration")
      || hasIdentifier(abilityGroupSource, "OrchestrationAbilityGroup")
      || hasCallExpressionPath(abilityGroupSource, ["setCandidateDisposition"])
      || hasCallExpressionPath(abilityGroupSource, ["resetLocalStore"])
      || hasCallExpressionPath(abilityGroupSource, ["this", "orchestration", "startMission"])
      || hasCallExpressionPath(abilityGroupSource, ["this", "orchestration", "pauseMission"])
      || hasCallExpressionPath(abilityGroupSource, ["this", "orchestration", "resumeMission"])
      || hasCallExpressionPath(abilityGroupSource, ["this", "orchestration", "stopMission"])
      || hasCallExpressionPath(abilityGroupSource, ["this", "orchestration", "emergencyStop"]);
    if (directOrchestrationCalls) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Commander Console ability-group must use ports and command transport, not direct orchestration or review mutations." }));
    }

    const externalChildImports = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const specifier = declaration.getModuleSpecifierValue() ?? "";
        return specifier.includes("capabilities/commander-console/children/") && !relativePath.startsWith(`${ROOT}/`)
          ? [relativePath]
          : [];
      });
    });
    if (externalChildImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: externalChildImports[0]!, line: 1, severity: "fatal", message: "Commander Console child implementations must stay private to the canonical root." }));
    }

    const taskHandlerCutoverPassed = hasPropertyAccessPath(taskHandlerSource, ["activeWorkbench", "commanderConsole", "issueHumanCommand"])
      && hasPropertyAccessPath(taskHandlerSource, ["activeWorkbench", "commanderConsole", "pauseMission"])
      && hasPropertyAccessPath(taskHandlerSource, ["activeWorkbench", "commanderConsole", "stopMission"])
      && !hasStringLiteral(taskHandlerSource, "/api/runtime/reset-store")
      && !hasPropertyAccessPath(taskHandlerSource, ["activeWorkbench", "startTask"])
      && !hasPropertyAccessPath(taskHandlerSource, ["activeWorkbench", "pauseTask"])
      && !hasPropertyAccessPath(taskHandlerSource, ["activeWorkbench", "stopTask"]);
    if (!taskHandlerCutoverPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: TASK_HANDLER_PATH, line: 1, severity: "fatal", message: "Task API handlers must route human commands through Commander Console only and must not expose reset-store." }));
    }

    const candidateCutoverPassed = hasPropertyAccessPath(candidateHandlerSource, ["activeWorkbench", "commanderConsole", "approveCandidate"])
      && hasPropertyAccessPath(candidateHandlerSource, ["activeWorkbench", "commanderConsole", "rejectCandidate"])
      && hasPropertyAccessPath(candidateHandlerSource, ["activeWorkbench", "commanderConsole", "markReviewRequired"]);
    if (!candidateCutoverPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: CANDIDATE_HANDLER_PATH, line: 1, severity: "fatal", message: "Candidate review routes must use Commander Console review methods." }));
    }

    const shellCutoverPassed = hasImportModuleSpecifier(serverHelperSource, "local-app-shell/render-commander-console-page")
      && !hasImportModuleSpecifier(serverHelperSource, "operator-control")
      && !hasExportModuleSpecifier(serverHelperSource, "operator-control")
      && hasLiteralTextFragment(shellRenderSource, "commanderConsoleShell.issueCommand('/api/tasks/start')")
      && !hasLiteralTextFragment(shellRenderSource, "/api/runtime/reset-store");
    if (!shellCutoverPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: SHELL_RENDER_PATH, line: 1, severity: "fatal", message: "Local App Shell must render Commander Console without reviving reset-store or operator-control paths." }));
    }

    const workbenchCutoverPassed = hasCallExpressionPath(workbenchSource, ["this", "nerveBusAbilityGroup", "dispatchHumanCommand"])
      && hasPropertyNamed(workbenchSource, "humanCommandHandler")
      && !hasImportModuleSpecifier(workbenchSource, "build-browse-runtime-snapshot")
      && !hasImportModuleSpecifier(workbenchSource, "build-runtime-skill-matrix-snapshot")
      && !workbenchSource.getClass("GrassEyeWorkbench")?.getMethod("updateCandidateDisposition")
      && !workbenchSource.getClass("GrassEyeWorkbench")?.getMethod("resetLocalStore");
    if (!workbenchCutoverPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must compose Commander Console through Nerve Bus human command transport and read-model ports." }));
    }

    const silentPlatformFallbackDetected = createInputProps.has("defaultRequestedPlatformId")
      || hasIdentifier(abilityGroupSource, "defaultRequestedPlatformId")
      || hasIdentifier(workbenchSource, "defaultRequestedPlatformId")
      || hasNullishCoalescingLiteral(workbenchSource, "tiktok-web");
    if (silentPlatformFallbackDetected) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Commander command transport must not recover missing platform truth through defaultRequestedPlatformId or a tiktok-web fallback." }));
    }

    const startupPassed = !startupSource.includes("startTask(")
      && !startupSource.includes("beginMissionRuntime(")
      && !startupSource.includes("issueHumanCommand(");
    if (!startupPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: STARTUP_PATH, line: 1, severity: "fatal", message: "Startup must remain bootstrap-only and must not issue governed commands." }));
    }

    const driftMarkers = [...rootSourceFiles, taskHandlerSource, candidateHandlerSource, serverHelperSource, shellRenderSource, workbenchSource]
      .some((sourceFile) => sourceCarriesDriftMarker(sourceFile));
    if (driftMarkers) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Commander Console migration must not reintroduce compat, legacy, or bridge drift." }));
    }

    const verifyScriptExists = await fileExists(pathFromRepoRoot(VERIFY_PATH));
    if (verifyScriptExists) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: VERIFY_PATH, line: 1, severity: "fatal", message: "Commander Console must not introduce a verify-* release gate." }));
    }

    const legacyRootExists = await fileExists(pathFromRepoRoot(LEGACY_OPERATOR_CONTROL_ROOT));
    if (legacyRootExists) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: LEGACY_OPERATOR_CONTROL_ROOT, line: 1, severity: "fatal", message: "Deleted operator-control root must stay removed." }));
    }

    const requiredShapePassed = requiredFiles.every((entry) => entry.exists)
      && contractShapePassed
      && REQUIRED_CHILDREN.every((childId) => childFileSet.has(`${CHILDREN_ROOT}/${childId}/implementation.ts`));
    const boundaryPurityPassed = forbiddenImports.length === 0 && !directOrchestrationCalls && retiredFiles.every((entry) => !entry.exists);
    const cutoverPassed = taskHandlerCutoverPassed && candidateCutoverPassed && shellCutoverPassed && workbenchCutoverPassed && startupPassed;
    const antiDriftPassed = externalChildImports.length === 0 && !indexExportsChildren && !verifyScriptExists && !driftMarkers && !legacyRootExists;

    const localAppShell = await inspectLocalAppShellBoundary();
    const startupEntrypoint = await inspectStartupEntrypointBoundary();

    return {
      findings: [...findings, ...localAppShell.findings, ...startupEntrypoint.findings],
      phases: [
        createPhase("commander-console-required-shape", requiredShapePassed ? "PASS" : "CODE VIOLATION", requiredShapePassed, requiredShapePassed ? "Commander Console canonical root contains ports, shared contracts, and real child implementation folders." : "Commander Console canonical shape is incomplete."),
        createPhase("commander-console-boundary-purity", boundaryPurityPassed ? "PASS" : "CODE VIOLATION", boundaryPurityPassed, boundaryPurityPassed ? "Commander Console root stays clean from local-data, old runtime builders, and direct orchestration mutations." : "Commander Console root still carries forbidden imports, direct mutations, or retired residue."),
        createPhase("commander-console-entry-cutover", cutoverPassed ? "PASS" : "CODE VIOLATION", cutoverPassed, cutoverPassed ? "Human command entry, candidate review routes, Local App Shell, and workbench transport are cut over to Commander Console." : "Command entry or transport cutover is incomplete."),
        createPhase("commander-console-anti-drift", antiDriftPassed ? "PASS" : "CODE VIOLATION", antiDriftPassed, antiDriftPassed ? "Commander Console keeps one canonical root with no child leakage, verify escape, or legacy drift." : "Commander Console still shows child leakage, verify escape, or legacy drift."),
        ...localAppShell.phases,
        ...startupEntrypoint.phases,
      ],
    };
  },
});