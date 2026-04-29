import path from "node:path";

import { Node, SyntaxKind, type SourceFile, type VariableDeclaration } from "ts-morph";

import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  hasCallExpressionPath,
  hasIdentifier,
  hasImportModuleSpecifier,
  hasInterfaceMethod,
  hasLiteralTextFragment,
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
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const COMMAND_POLICY_PATH = `${ROOT}/shared/commander-command-policy.ts`;
const COMMAND_RESULT_PATH = `${ROOT}/shared/commander-result.ts`;
const COMMAND_PROOF_PATH = `${ROOT}/shared/commander-proof.ts`;
const VIEW_TYPES_PATH = `${ROOT}/shared/commander-view-types.ts`;
const COMMAND_GATE_PATH = `${ROOT}/runtime/commander-command-gate.ts`;
const READ_GATE_PATH = `${ROOT}/runtime/commander-read-gate.ts`;
const EXECUTOR_PATH = `${ROOT}/runtime/commander-console-executor.ts`;
const RESULT_BUILDER_PATH = `${ROOT}/runtime/commander-result-builder.ts`;
const PROOF_BUILDER_PATH = `${ROOT}/runtime/commander-proof-builder.ts`;
const DISPATCH_FAILURE_PATH = `${ROOT}/runtime/commander-dispatch-failure.ts`;
const BOUNDARY_POLICY_PATH = `${ROOT}/runtime/commander-boundary-policy.ts`;
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
const SHELL_PAGE_MODEL_PATH = "src/lib/local-app-shell/commander-console-page-model.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const STARTUP_PATH = "scripts/startup/launch-grasseye.mjs";
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

const COMMAND_CHILDREN = new Set([
  "issue-human-command",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
]);

const REQUIRED_FILES = [
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  INDEX_PATH,
  REGISTRY_PATH,
  SCHEMA_PATH,
  COMMAND_POLICY_PATH,
  COMMAND_RESULT_PATH,
  COMMAND_PROOF_PATH,
  VIEW_TYPES_PATH,
  COMMAND_GATE_PATH,
  READ_GATE_PATH,
  EXECUTOR_PATH,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  DISPATCH_FAILURE_PATH,
  BOUNDARY_POLICY_PATH,
  COMMAND_TRANSPORT_PORT_PATH,
  MISSION_READ_MODEL_PORT_PATH,
  FORENSICS_READ_MODEL_PORT_PATH,
  CAPABILITY_HEALTH_PORT_PATH,
  AUDIT_READ_MODEL_PORT_PATH,
  RUNTIME_PROOF_READ_MODEL_PORT_PATH,
  SHELL_RENDER_PATH,
  SHELL_PAGE_MODEL_PATH,
] as const;

const RETIRED_FILES = [
  `${ROOT}/read-models.ts`,
  `${ROOT}/command-builder.ts`,
  `${ROOT}/shared/command-policy.ts`,
  `${ROOT}/shared/health-summary.ts`,
  `${ROOT}/shared/review-decision.ts`,
  `${ROOT}/shared/view-model-types.ts`,
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "capabilities/open/",
  "capabilities/mouse-click/",
  "capabilities/mouse-scroll/",
  "capabilities/screenshot/",
  "capabilities/geometry-guard/",
  "capabilities/page-state/",
  "capabilities/forensics-persistence/",
  "lib/browser/",
  "features/operator-control",
  "read-models",
  "command-builder",
] as const;

function hasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.getText().startsWith("export *"));
}

function hasDynamicImport(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

function hasAsAny(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => expression.getTypeNode()?.getText() === "any");
}

function hasAnyKeyword(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0;
}

function hasRecordUnknown(sourceFile: SourceFile): boolean {
  return sourceFile.getFullText().includes("Record<string, unknown>");
}

function findChildDefinition(sourceFile: SourceFile, childId: string): VariableDeclaration | undefined {
  return sourceFile.getVariableDeclarations().find((declaration) => {
    const typeNodeText = declaration.getTypeNode()?.getText() ?? "";
    const initializer = declaration.getInitializer();
    return typeNodeText.includes("CommanderConsoleChildDefinition")
      && Node.isObjectLiteralExpression(initializer)
      && initializer.getProperty("childCapabilityId")?.getText().includes(`"${childId}"`);
  });
}

function implementationCarriesExecuteShape(sourceFile: SourceFile, childId: string): boolean {
  const declaration = findChildDefinition(sourceFile, childId);
  const initializer = declaration?.getInitializer();
  if (!declaration || !initializer || !Node.isObjectLiteralExpression(initializer)) {
    return false;
  }

  return Boolean(initializer.getProperty("inputSchema"))
    && Boolean(initializer.getProperty("outputSchema"))
    && Boolean(initializer.getProperty("execute"));
}

function referenceLeaksOutsideRegistry(declaration: VariableDeclaration): string[] {
  const nameNode = declaration.getNameNode();
  if (!Node.isIdentifier(nameNode)) {
    return [];
  }

  const referenceNodes = nameNode.findReferencesAsNodes();
  return [...new Set(referenceNodes.map((node) => toRepoRelativePath(node.getSourceFile().getFilePath())))]
    .filter((filePath) => filePath !== toRepoRelativePath(declaration.getSourceFile().getFilePath()))
    .filter((filePath) => filePath !== REGISTRY_PATH);
}

function childDirectoryFiles(childId: string): string[] {
  return [
    `${CHILDREN_ROOT}/${childId}/contract.ts`,
    `${CHILDREN_ROOT}/${childId}/schema.ts`,
    `${CHILDREN_ROOT}/${childId}/implementation.ts`,
  ];
}

export default createPendingDomainInspector({
  inspector: "GrassEye Commander Console Capability Owner Inspector",
  inspectorId: "commander-console-capability-owner",
  capabilityDomain: "commander-console-capability",
  inspectorEntry: "scripts/audit/domains/commander-console-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "commander-console-capability law exists but the rebuilt execute architecture is not yet fully enforced",
  implementedSummary: "commander-console-capability is implemented as the governed human command and read-only dashboard owner",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const executorSource = getSourceFileOrThrow(project, EXECUTOR_PATH);
    const taskHandlerSource = getSourceFileOrThrow(project, TASK_HANDLER_PATH);
    const candidateHandlerSource = getSourceFileOrThrow(project, CANDIDATE_HANDLER_PATH);
    const serverHelperSource = getSourceFileOrThrow(project, SERVER_HELPER_PATH);
    const shellRenderSource = getSourceFileOrThrow(project, SHELL_RENDER_PATH);
    const shellPageModelSource = getSourceFileOrThrow(project, SHELL_PAGE_MODEL_PATH);
    const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
    const startupSource = await readTextFile(pathFromRepoRoot(STARTUP_PATH));
    const commanderSourceFiles = project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
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
      for (const childFile of childDirectoryFiles(childId)) {
        if (!childFileSet.has(childFile)) {
          findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: childFile, line: 1, severity: "fatal", message: "Commander Console child folder is incomplete; contract/schema/implementation must all exist." }));
        }
      }
    }

    for (const retiredFile of RETIRED_FILES) {
      if (await fileExists(pathFromRepoRoot(retiredFile))) {
        findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: retiredFile, line: 1, severity: "fatal", message: "Retired Commander Console residue must stay deleted." }));
      }
    }

    const executeContractPassed = hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "execute")
      && hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "listChildAbilityIds")
      && !hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "issueHumanCommand")
      && !hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "pauseMission")
      && !hasInterfaceMethod(contractSource, "CommanderConsoleAbilityGroup", "approveCandidate");
    if (!executeContractPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Commander Console contract must expose only listChildAbilityIds and execute on the public ability-group surface." }));
    }

    const thinAbilityGroupPassed = hasIdentifier(abilityGroupSource, "CommanderConsoleInputSchema")
      && hasIdentifier(abilityGroupSource, "getCommanderConsoleChild")
      && hasIdentifier(abilityGroupSource, "executeCommanderConsoleChild")
      && !hasIdentifier(abilityGroupSource, "commandTransport")
      && !hasImportModuleSpecifier(abilityGroupSource, "ports/");
    if (!thinAbilityGroupPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Commander Console ability-group must stay thin and route through registry plus runtime executor only." }));
    }

    const executorProofPassed = hasIdentifier(executorSource, "buildCommanderRuntimeProof")
      && hasIdentifier(executorSource, "buildCommanderConsoleResult");
    if (!executorProofPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Commander Console executor must always build governed result and runtime proof." }));
    }

    if (hasExportStar(indexSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Commander Console index must not use export-star barrels." }));
    }

    const registryImports = registrySource.getImportDeclarations()
      .map((declaration) => declaration.getModuleSpecifierValue() ?? "")
      .filter((specifier) => specifier.includes("children/") && specifier.endsWith("/implementation.js"));
    if (registryImports.length !== REQUIRED_CHILDREN.length || !hasIdentifier(registrySource, "COMMANDER_CONSOLE_CHILD_MAP")) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Commander Console registry must register all real child implementations behind COMMANDER_CONSOLE_CHILD_MAP." }));
    }

    for (const childId of REQUIRED_CHILDREN) {
      const implementationPath = `${CHILDREN_ROOT}/${childId}/implementation.ts`;
      const implementationSource = getSourceFileOrThrow(project, implementationPath);
      const definition = findChildDefinition(implementationSource, childId);
      if (!implementationCarriesExecuteShape(implementationSource, childId)) {
        findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: implementationPath, line: 1, severity: "fatal", message: "Commander Console child implementation must export a CommanderConsoleChildDefinition with inputSchema, outputSchema, and execute." }));
      }

      const shouldUseGate = COMMAND_CHILDREN.has(childId) ? "gateCommanderCommand" : "gateCommanderRead";
      if (!hasIdentifier(implementationSource, shouldUseGate)) {
        findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: implementationPath, line: 1, severity: "fatal", message: `Commander Console child ${childId} must route through ${shouldUseGate}.` }));
      }

      if (childId === "emergency-stop" && hasLiteralTextFragment(implementationSource, "stop-mission")) {
        findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: implementationPath, line: 1, severity: "fatal", message: "Emergency-stop child must not degrade into stop-mission semantics." }));
      }

      if (definition) {
        const leakedReferences = referenceLeaksOutsideRegistry(definition);
        if (leakedReferences.length > 0) {
          findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: leakedReferences[0]!, line: 1, severity: "fatal", message: "Commander Console child implementations must stay private and only be consumed by the registry." }));
        }
      }
    }

    const forbiddenImportFile = commanderSourceFiles.find((sourceFile) => FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker)));
    if (forbiddenImportFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: toRepoRelativePath(forbiddenImportFile.getFilePath()), line: 1, severity: "fatal", message: "Commander Console root must not import browser/runtime internals or retired legacy surfaces directly." }));
    }

    const antiEscapeFile = commanderSourceFiles.find((sourceFile) => hasDynamicImport(sourceFile) || hasAsAny(sourceFile) || hasAnyKeyword(sourceFile) || hasRecordUnknown(sourceFile));
    if (antiEscapeFile) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: toRepoRelativePath(antiEscapeFile.getFilePath()), line: 1, severity: "fatal", message: "Commander Console root must not use dynamic import, any, or Record<string, unknown> escape hatches." }));
    }

    const taskCutoverPassed = hasCallExpressionPath(taskHandlerSource, ["activeWorkbench", "commanderConsole", "execute"])
      && !hasLiteralTextFragment(taskHandlerSource, "issueHumanCommand(")
      && !hasLiteralTextFragment(taskHandlerSource, "pauseMission(")
      && !hasLiteralTextFragment(taskHandlerSource, "stopMission(")
      && !hasImportModuleSpecifier(taskHandlerSource, "command-builder");
    if (!taskCutoverPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: TASK_HANDLER_PATH, line: 1, severity: "fatal", message: "Task API handlers must route through commanderConsole.execute and must not revive legacy command builders." }));
    }

    const candidateCutoverPassed = hasCallExpressionPath(candidateHandlerSource, ["activeWorkbench", "commanderConsole", "execute"])
      && !hasLiteralTextFragment(candidateHandlerSource, "approveCandidate(")
      && !hasLiteralTextFragment(candidateHandlerSource, "rejectCandidate(")
      && !hasLiteralTextFragment(candidateHandlerSource, "markReviewRequired(")
      && !hasImportModuleSpecifier(candidateHandlerSource, "review-decision");
    if (!candidateCutoverPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: CANDIDATE_HANDLER_PATH, line: 1, severity: "fatal", message: "Candidate review handlers must route through commanderConsole.execute only." }));
    }

    const workbenchCutoverPassed = hasCallExpressionPath(workbenchSource, ["this", "nerveBusAbilityGroup", "dispatchHumanCommand"])
      && hasCallExpressionPath(workbenchSource, ["this", "commanderConsole", "execute"])
      && hasIdentifier(workbenchSource, "defaultOperatorRef")
      && !hasLiteralTextFragment(workbenchSource, "showMissionDashboard(");
    if (!workbenchCutoverPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench must compose Commander Console through execute plus Nerve Bus human command transport." }));
    }

    const shellCutoverPassed = hasImportModuleSpecifier(serverHelperSource, "local-app-shell/render-commander-console-page")
      && hasImportModuleSpecifier(shellRenderSource, "./commander-console-page-model")
      && !hasImportModuleSpecifier(shellRenderSource, "command-transport-port")
      && hasLiteralTextFragment(shellRenderSource, "/api/tasks/start");
    if (!shellCutoverPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: SHELL_RENDER_PATH, line: 1, severity: "fatal", message: "Local App Shell must render commander views through its local page model and must not reach transport internals." }));
    }

    if (!hasIdentifier(shellPageModelSource, "buildCommanderConsolePageModel")) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: SHELL_PAGE_MODEL_PATH, line: 1, severity: "fatal", message: "Local App Shell must own the commander page-model builder after the rebuild." }));
    }

    const externalRuntimeLeak = project.getSourceFiles().find((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath.startsWith(`${ROOT}/`)) {
        return false;
      }

      return sourceFile.getImportDeclarations().some((declaration) => {
        const specifier = declaration.getModuleSpecifierValue() ?? "";
        return specifier.includes("capabilities/commander-console/children/")
          || specifier.includes("capabilities/commander-console/runtime/")
          || specifier.includes("capabilities/commander-console/ports/command-transport-port");
      });
    });
    if (externalRuntimeLeak) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: toRepoRelativePath(externalRuntimeLeak.getFilePath()), line: 1, severity: "fatal", message: "External modules must not import Commander Console children, runtime internals, or command transport port directly." }));
    }

    if (startupSource.includes("issueHumanCommand(") || startupSource.includes("commanderConsole.execute(")) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: STARTUP_PATH, line: 1, severity: "fatal", message: "Startup must remain bootstrap-only and must not issue Commander commands." }));
    }

    if (await fileExists(pathFromRepoRoot(LEGACY_OPERATOR_CONTROL_ROOT))) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: LEGACY_OPERATOR_CONTROL_ROOT, line: 1, severity: "fatal", message: "Deleted operator-control root must stay removed." }));
    }

    const requiredShapePassed = requiredFiles.every((entry) => entry.exists)
      && REQUIRED_CHILDREN.every((childId) => childDirectoryFiles(childId).every((filePath) => childFileSet.has(filePath)));
    const architecturePassed = executeContractPassed && thinAbilityGroupPassed && executorProofPassed && !hasExportStar(indexSource);
    const cutoverPassed = taskCutoverPassed && candidateCutoverPassed && workbenchCutoverPassed && shellCutoverPassed;
    const antiEscapePassed = !forbiddenImportFile && !antiEscapeFile && !externalRuntimeLeak;

    const localAppShell = await inspectLocalAppShellBoundary();
    const startupEntrypoint = await inspectStartupEntrypointBoundary();

    return {
      findings: [...findings, ...localAppShell.findings, ...startupEntrypoint.findings],
      phases: [
        createPhase("commander-console-required-shape", requiredShapePassed ? "PASS" : "CODE VIOLATION", requiredShapePassed, requiredShapePassed ? "Commander Console canonical root contains schema, runtime, shared layers, and real child folders." : "Commander Console canonical root is missing required schema/runtime/shared or child files."),
        createPhase("commander-console-architecture", architecturePassed ? "PASS" : "CODE VIOLATION", architecturePassed, architecturePassed ? "Commander Console public surface is execute-only, thin, and always emits governed results plus runtime proof." : "Commander Console public surface or runtime pipeline drifted away from the rebuilt execute architecture."),
        createPhase("commander-console-cutover", cutoverPassed ? "PASS" : "CODE VIOLATION", cutoverPassed, cutoverPassed ? "Workbench, HTTP handlers, and Local App Shell are fully cut over to Commander Console execute." : "Workbench, HTTP handlers, or Local App Shell still depend on legacy Commander Console surfaces."),
        createPhase("commander-console-anti-escape", antiEscapePassed ? "PASS" : "CODE VIOLATION", antiEscapePassed, antiEscapePassed ? "Commander Console keeps one canonical root with no transport/runtime leakage and no dynamic or any escape hatches." : "Commander Console still exposes transport/runtime leakage or escape hatches."),
        ...localAppShell.phases,
        ...startupEntrypoint.phases,
      ],
    };
  },
});
