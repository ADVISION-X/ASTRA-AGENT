import path from "node:path";

import { Node, SyntaxKind, type Identifier, type Project, type SourceFile, type Symbol as MorphSymbol, type VariableDeclaration } from "ts-morph";

import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  hasAnyKeyword,
  hasCallExpression,
  hasCallExpressionPath,
  hasImportModuleSpecifier,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/commander-console";
const CHILDREN_ROOT = `${ROOT}/children`;
const SHARED_SCHEMA_BASE_PATH = `${ROOT}/shared/commander-schema-base.ts`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const COMMAND_GATE_PATH = `${ROOT}/runtime/commander-command-gate.ts`;
const READ_GATE_PATH = `${ROOT}/runtime/commander-read-gate.ts`;
const EXECUTOR_PATH = `${ROOT}/runtime/commander-console-executor.ts`;
const RESULT_BUILDER_PATH = `${ROOT}/runtime/commander-result-builder.ts`;
const PROOF_BUILDER_PATH = `${ROOT}/runtime/commander-proof-builder.ts`;
const DISPATCH_FAILURE_PATH = `${ROOT}/runtime/commander-dispatch-failure.ts`;
const BOUNDARY_POLICY_PATH = `${ROOT}/runtime/commander-boundary-policy.ts`;
const CHILD_EXECUTORS_PATH = `${ROOT}/runtime/commander-child-executors.ts`;
const CLOCK_PORT_PATH = `${ROOT}/ports/commander-clock-port.ts`;
const CLOCK_PATH = `${ROOT}/runtime/commander-clock.ts`;
const NEGATIVE_PROOF_HARNESS_PATH = "scripts/audit/domains/commander-console-capability/negative-proof-harness.ts";
const MANIFEST_PATH = "scripts/audit/domains/commander-console-capability/manifest.json";
const TASK_HANDLER_PATH = "src/app/task-api-handlers.ts";
const CANDIDATE_HANDLER_PATH = "src/app/candidate-api-handlers.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const SHELL_RENDER_PATH = "src/lib/local-app-shell/render-commander-console-page.ts";
const SHELL_PAGE_CLIENT_PATH = "src/lib/local-app-shell/commander-console-page-client.ts";
const STARTUP_PATH = "scripts/startup/launch-grasseye.mjs";

const CHILD_IDS = [
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

const COMMAND_CHILD_IDS = new Set([
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
  SHARED_SCHEMA_BASE_PATH,
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  SCHEMA_PATH,
  REGISTRY_PATH,
  INDEX_PATH,
  COMMAND_GATE_PATH,
  READ_GATE_PATH,
  EXECUTOR_PATH,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  DISPATCH_FAILURE_PATH,
  BOUNDARY_POLICY_PATH,
  CHILD_EXECUTORS_PATH,
  CLOCK_PORT_PATH,
  CLOCK_PATH,
  NEGATIVE_PROOF_HARNESS_PATH,
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "/capabilities/ai/",
  "/capabilities/open/children/",
  "/capabilities/open/runtime/",
  "/capabilities/screenshot/",
  "/capabilities/mouse-click/",
  "/capabilities/mouse-scroll/",
  "/capabilities/geometry-guard/",
  "/capabilities/page-state/children/",
  "/capabilities/page-state/runtime/",
  "/capabilities/forensics-persistence/children/",
  "/capabilities/forensics-persistence/runtime/",
  "/lib/browser/",
  "/features/operator-control/",
] as const;

const FORBIDDEN_EXTERNAL_IMPORTS = [
  "/capabilities/commander-console/children/",
  "/capabilities/commander-console/runtime/",
  "/capabilities/commander-console/registry",
  "/capabilities/commander-console/ports/command-transport-port",
] as const;

function childDirectoryFiles(childId: string): string[] {
  return [
    `${CHILDREN_ROOT}/${childId}/contract.ts`,
    `${CHILDREN_ROOT}/${childId}/schema.ts`,
    `${CHILDREN_ROOT}/${childId}/implementation.ts`,
  ];
}

function toPascalCase(value: string): string {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function toUpperSnakeCase(value: string): string {
  return value.replace(/-/g, "_").toUpperCase();
}

function hasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.getText().startsWith("export *"));
}

function hasSuppressionComment(sourceFile: SourceFile): boolean {
  const text = sourceFile.getFullText();
  return text.includes("@ts-ignore")
    || text.includes("@ts-expect-error")
    || text.includes("eslint-disable");
}

function hasDynamicImportOrRequire(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return expression.getKind() === SyntaxKind.ImportKeyword
      || (Node.isIdentifier(expression) && expression.getText() === "require");
  });
}

function hasAsAny(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => expression.getTypeNode()?.getText() === "any");
}

function hasUnknownAs(sourceFile: SourceFile): boolean {
  return sourceFile.getFullText().includes("as unknown as");
}

function hasPassthrough(sourceFile: SourceFile): boolean {
  return sourceFile.getFullText().includes(".passthrough()");
}

function hasDateParse(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === "Date.parse");
}

function hasNewDate(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date");
}

function countOccurrences(text: string, fragment: string): number {
  return text.split(fragment).length - 1;
}

function getCommanderSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

function getExportedDeclarationNames(sourceFile: SourceFile): Set<string> {
  return new Set(sourceFile.getExportedDeclarations().keys());
}

function hasChildSchemaShape(sourceFile: SourceFile, childId: string): boolean {
  const prefix = toPascalCase(childId);
  const exportedNames = getExportedDeclarationNames(sourceFile);
  return sourceFile.getExportDeclarations().length === 0
    && exportedNames.has(`${prefix}InputSchema`)
    && exportedNames.has(`${prefix}OutputSchema`)
    && exportedNames.has(`${prefix}BoundaryPolicySchema`)
    && exportedNames.has(`${prefix}ProofPolicySchema`)
    && exportedNames.has(`${prefix}ReadinessSchema`);
}

function hasChildContractShape(sourceFile: SourceFile, childId: string): boolean {
  const prefix = toPascalCase(childId);
  const upper = toUpperSnakeCase(childId);
  const exportedNames = getExportedDeclarationNames(sourceFile);
  return sourceFile.getExportDeclarations().length === 0
    && exportedNames.has(`${upper}_CHILD_ID`)
    && exportedNames.has(`${upper}_CONTRACT`)
    && exportedNames.has(`${prefix}Input`)
    && exportedNames.has(`${prefix}Output`);
}

function findChildDefinition(sourceFile: SourceFile, childId: string): VariableDeclaration | undefined {
  const namedDefinition = sourceFile.getVariableDeclaration(`${toUpperSnakeCase(childId)}_CHILD`);
  if (namedDefinition) {
    return namedDefinition;
  }
  return sourceFile.getVariableDeclarations().find((declaration) => {
    const initializer = declaration.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
    return Boolean(initializer?.getProperty("inputSchema"))
      && Boolean(initializer?.getProperty("outputSchema"))
      && Boolean(initializer?.getProperty("execute"));
  });
}

function hasChildImplementationShape(sourceFile: SourceFile, childId: string): boolean {
  const definition = findChildDefinition(sourceFile, childId);
  const initializer = definition?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  if (!definition || !initializer) {
    return false;
  }
  return Boolean(initializer.getProperty("inputSchema"))
    && Boolean(initializer.getProperty("outputSchema"))
    && Boolean(initializer.getProperty("execute"));
}

function resolveIdentifierSymbol(identifier: Identifier): MorphSymbol | undefined {
  const symbol = identifier.getSymbol();
  if (!symbol) {
    return undefined;
  }
  return symbol.getAliasedSymbol() ?? symbol;
}

function referenceLeaksOutsideRegistry(definition: VariableDeclaration): string[] {
  const nameNode = definition.getNameNode();
  if (!Node.isIdentifier(nameNode)) {
    return [];
  }
  resolveIdentifierSymbol(nameNode);
  const references = nameNode.findReferencesAsNodes();
  return [...new Set(references.map((reference) => toRepoRelativePath(reference.getSourceFile().getFilePath())))]
    .filter((filePath) => filePath !== toRepoRelativePath(definition.getSourceFile().getFilePath()))
    .filter((filePath) => filePath !== REGISTRY_PATH);
}

function hasRegistryMetadata(sourceFile: SourceFile): boolean {
  const text = sourceFile.getFullText();
  const requiredFragments = [
    "inputSchema",
    "outputSchema",
    "implementation",
    "boundaryPolicy",
    "evidencePolicy",
    "proofPolicy",
    "ownedCommandType",
    "readModelSource",
    "hardStopPriority",
    "idempotencyPolicy",
  ];
  return requiredFragments.every((fragment) => text.includes(fragment));
}

function getRegistryImplementationChildIds(sourceFile: SourceFile): string[] {
  return sourceFile.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue() ?? "")
    .filter((specifier) => specifier.includes("/children/") && specifier.endsWith("/implementation.js"))
    .map((specifier) => path.posix.basename(path.posix.dirname(specifier)));
}

function functionContainsThrow(sourceFile: SourceFile, functionName: string): boolean {
  return (sourceFile.getFunction(functionName)?.getDescendantsOfKind(SyntaxKind.ThrowStatement).length ?? 0) > 0;
}

function countCommanderMissionDashboardDeclarations(commanderSources: SourceFile[]): number {
  return commanderSources.reduce((count, sourceFile) => {
    return count + sourceFile.getVariableDeclarations().filter((declaration) => declaration.getName() === "CommanderMissionDashboardViewSchema").length;
  }, 0);
}

function contractCollapsesToAny(declaration: VariableDeclaration | undefined): boolean {
  return declaration ? declaration.getType().isAny() : true;
}

async function requiredFilesExist(): Promise<boolean> {
  const results = await Promise.all(REQUIRED_FILES.map((filePath) => fileExists(pathFromRepoRoot(filePath))));
  return results.every(Boolean);
}

export const commanderConsoleCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Commander Console Capability Owner Inspector",
  inspectorId: "commander-console-capability-owner",
  capabilityDomain: "commander-console-capability",
  inspectorEntry: "scripts/audit/domains/commander-console-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "commander-console-capability requires hard production enforcement for execute-only routing, child privacy, strict gates, and negative proof",
  implementedSummary: "commander-console-capability is enforced as the execute-only human command and command-facing read-console owner",
  extraChecks: async () => {
    const project = createAuditProject();
    const findings: Finding[] = [];

    const commanderSources = getCommanderSourceFiles(project);
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const schemaSource = getSourceFileOrThrow(project, SCHEMA_PATH);
    const sharedSchemaSource = getSourceFileOrThrow(project, SHARED_SCHEMA_BASE_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const commandGateSource = getSourceFileOrThrow(project, COMMAND_GATE_PATH);
    const readGateSource = getSourceFileOrThrow(project, READ_GATE_PATH);
    const executorSource = getSourceFileOrThrow(project, EXECUTOR_PATH);
    const resultBuilderSource = getSourceFileOrThrow(project, RESULT_BUILDER_PATH);
    const proofBuilderSource = getSourceFileOrThrow(project, PROOF_BUILDER_PATH);
    const dispatchFailureSource = getSourceFileOrThrow(project, DISPATCH_FAILURE_PATH);
    const boundaryPolicySource = getSourceFileOrThrow(project, BOUNDARY_POLICY_PATH);
    const childExecutorsSource = getSourceFileOrThrow(project, CHILD_EXECUTORS_PATH);
    const taskHandlerSource = getSourceFileOrThrow(project, TASK_HANDLER_PATH);
    const candidateHandlerSource = getSourceFileOrThrow(project, CANDIDATE_HANDLER_PATH);
    const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
    const shellRenderSource = getSourceFileOrThrow(project, SHELL_RENDER_PATH);
    const shellPageClientSource = project.getSourceFile(pathFromRepoRoot(SHELL_PAGE_CLIENT_PATH));
    const manifestText = await readTextFile(pathFromRepoRoot(MANIFEST_PATH));
    const startupText = await readTextFile(pathFromRepoRoot(STARTUP_PATH));
    const childFiles = await listFilesRecursive(pathFromRepoRoot(CHILDREN_ROOT), { extensions: [".ts"] });
    const childFileSet = new Set(childFiles.map((filePath) => toRepoRelativePath(filePath)));

    if (!(await requiredFilesExist())) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
        file: ROOT,
        line: 1,
        severity: "fatal",
        message: "Commander Console canonical production package is incomplete.",
      }));
    }

    for (const childId of CHILD_IDS) {
      for (const childFile of childDirectoryFiles(childId)) {
        if (!childFileSet.has(childFile)) {
          findings.push(createFinding({
            lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
            file: childFile,
            line: 1,
            severity: "fatal",
            message: "Commander Console child package must contain contract.ts, schema.ts, and implementation.ts.",
          }));
        }
      }
    }

    if (countCommanderMissionDashboardDeclarations(commanderSources) !== 1) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
        file: SHARED_SCHEMA_BASE_PATH,
        line: 1,
        severity: "fatal",
        message: "CommanderMissionDashboardViewSchema must be declared exactly once in the Commander root.",
      }));
    }

    const requiredPublicSchemas = [
      "CommanderConsoleInputSchema",
      "CommanderConsoleResultSchema",
      "CommanderTransportPayloadSchema",
      "RuntimeProofSchema",
      "CommanderCommandReceiptSchema",
    ];
    if (!requiredPublicSchemas.every((name) => schemaSource.getFullText().includes(name) || sharedSchemaSource.getVariableDeclaration(name))) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
        file: SCHEMA_PATH,
        line: 1,
        severity: "fatal",
        message: "Commander schema surface is missing governed schema exports.",
      }));
    }

    const abilityGroupInterface = contractSource.getInterface("CommanderConsoleAbilityGroup");
    const publicMethodNames = abilityGroupInterface?.getMethods().map((method) => method.getName()) ?? [];
    if (!abilityGroupInterface || publicMethodNames.join(",") !== "listChildAbilityIds,execute") {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1",
        file: CONTRACT_PATH,
        line: 1,
        severity: "fatal",
        message: "Commander Console public surface must expose only listChildAbilityIds and execute.",
      }));
    }

    if (!hasCallExpression(abilityGroupSource, "executeCommanderConsoleChild")
      || abilityGroupSource.getFullText().includes("dispatchHumanCommand")
      || hasImportModuleSpecifier(abilityGroupSource, "ports/")
      || abilityGroupSource.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1",
        file: ABILITY_GROUP_PATH,
        line: 1,
        severity: "fatal",
        message: "ability-group.ts must stay thin and route only through registry plus runtime executor.",
      }));
    }

    const registryChildIds = getRegistryImplementationChildIds(registrySource).sort().join(",");
    if (registryChildIds !== [...CHILD_IDS].sort().join(",") || !hasRegistryMetadata(registrySource)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
        file: REGISTRY_PATH,
        line: 1,
        severity: "fatal",
        message: "registry.ts must register every Commander child implementation with full metadata.",
      }));
    }

    if (functionContainsThrow(registrySource, "getCommanderConsoleChild")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
        file: REGISTRY_PATH,
        line: 1,
        severity: "fatal",
        message: "getCommanderConsoleChild must return null when a child is missing, not throw.",
      }));
    }

    if (hasExportStar(indexSource)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
        file: INDEX_PATH,
        line: 1,
        severity: "fatal",
        message: "Commander index.ts must not use export-star barrels.",
      }));
    }

    if (![
      "StartMissionTransportPayloadSchema.parse",
      "PauseMissionTransportPayloadSchema.parse",
      "ResumeMissionTransportPayloadSchema.parse",
      "StopMissionTransportPayloadSchema.parse",
      "EmergencyStopTransportPayloadSchema.parse",
      "ApproveCandidateTransportPayloadSchema.parse",
      "RejectCandidateTransportPayloadSchema.parse",
      "MarkReviewRequiredTransportPayloadSchema.parse",
      "CommandTransportResultSchema.parse",
    ].every((fragment) => commandGateSource.getFullText().includes(fragment))
      || !commandGateSource.getFullText().includes("Child ${input.childCapabilityId} only owns ${expectedCommandType}.")
      || !commandGateSource.getFullText().includes("emergency-stop must dispatch with emergency priority.")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1",
        file: COMMAND_GATE_PATH,
        line: 1,
        severity: "fatal",
        message: "commander-command-gate.ts must be command-specific and must parse both transport payloads and transport results.",
      }));
    }

    if (!hasCallExpression(readGateSource, "safeParse")
      || hasPassthrough(readGateSource)
      || !readGateSource.getFullText().includes("operatorRef is required.")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
        file: READ_GATE_PATH,
        line: 1,
        severity: "fatal",
        message: "commander-read-gate.ts must stay strict and must not accept passthrough input.",
      }));
    }

    if (![
      "createMissingChildOutcome",
      "buildCommanderRuntimeProof",
      "buildCommanderConsoleResult",
      "input.child.inputSchema.safeParse",
      "input.child.outputSchema.safeParse",
    ].every((fragment) => executorSource.getFullText().includes(fragment))) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
        file: EXECUTOR_PATH,
        line: 1,
        severity: "fatal",
        message: "Commander executor must own missing-child fallback, schema gates, runtime proof, and public result building.",
      }));
    }

    if (!resultBuilderSource.getFullText().includes("CommanderCommandReceiptSchema.parse")
      || !resultBuilderSource.getFullText().includes("CommanderConsoleResultSchema.parse")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
        file: RESULT_BUILDER_PATH,
        line: 1,
        severity: "fatal",
        message: "Commander result builders must parse governed receipts and public result envelopes.",
      }));
    }

    if (!proofBuilderSource.getFullText().includes("RuntimeProofSchema.parse")
      || !proofBuilderSource.getFullText().includes("hardStopDecision")
      || hasDateParse(proofBuilderSource)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
        file: PROOF_BUILDER_PATH,
        line: 1,
        severity: "fatal",
        message: "Commander proof builder must parse RuntimeProofSchema and preserve hard-stop proof fields.",
      }));
    }

    if (!dispatchFailureSource.getFullText().includes("dispatch_child_missing")
      || dispatchFailureSource.getFullText().includes("throw new Error")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
        file: DISPATCH_FAILURE_PATH,
        line: 1,
        severity: "fatal",
        message: "Missing-child dispatch failures must be governed and non-throwing.",
      }));
    }

    if (!boundaryPolicySource.getFullText().includes("buildCommanderEvidenceRef")
      || !boundaryPolicySource.getFullText().includes("transport_missing_envelope")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
        file: BOUNDARY_POLICY_PATH,
        line: 1,
        severity: "fatal",
        message: "Commander boundary policy must build structured evidence refs and envelope quality flags.",
      }));
    }

    if (countOccurrences(childExecutorsSource.getFullText(), "output: receipt,") < 3
      || !childExecutorsSource.getFullText().includes("hard-stop-dispatch-failed")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
        file: CHILD_EXECUTORS_PATH,
        line: 1,
        severity: "fatal",
        message: "Commander child executors must emit governed command receipts on failure and preserve hard-stop/not-found policy decisions.",
      }));
    }

    if (!hasCallExpressionPath(taskHandlerSource, ["activeWorkbench", "commanderConsole", "execute"]) || taskHandlerSource.getFullText().includes("issueHumanCommand(")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1",
        file: TASK_HANDLER_PATH,
        line: 1,
        severity: "fatal",
        message: "task-api-handlers.ts must reach Commander only through commanderConsole.execute.",
      }));
    }

    if (!hasCallExpressionPath(candidateHandlerSource, ["activeWorkbench", "commanderConsole", "execute"])) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1",
        file: CANDIDATE_HANDLER_PATH,
        line: 1,
        severity: "fatal",
        message: "candidate-api-handlers.ts must reach Commander only through commanderConsole.execute.",
      }));
    }

    if (!hasCallExpressionPath(workbenchSource, ["this", "nerveBusAbilityGroup", "dispatchHumanCommand"])
      || !workbenchSource.getFullText().includes("createCommanderConsoleAbilityGroup")
      || workbenchSource.getFullText().includes("showMissionDashboard(")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1",
        file: WORKBENCH_PATH,
        line: 1,
        severity: "fatal",
        message: "workbench.ts must compose Commander through execute-only API and governed Nerve Bus transport.",
      }));
    }

    if (shellRenderSource.getFullText().includes("command-transport-port")
      || shellPageClientSource?.getFullText().includes("command-transport-port")
      || shellPageClientSource?.getFullText().includes("dispatchHumanCommand")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1",
        file: SHELL_PAGE_CLIENT_PATH,
        line: 1,
        severity: "fatal",
        message: "Local App Shell must not import Commander transport internals or dispatch commands directly.",
      }));
    }

    if (startupText.includes("commanderConsole.execute(") || startupText.includes("dispatchHumanCommand(")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1",
        file: STARTUP_PATH,
        line: 1,
        severity: "fatal",
        message: "Startup must remain bootstrap-only and must not issue Commander commands.",
      }));
    }

    const forbiddenImportFile = commanderSources.find((sourceFile) => FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker)));
    if (forbiddenImportFile) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1",
        file: toRepoRelativePath(forbiddenImportFile.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "Commander root must not import other ability implementations or browser/runtime internals.",
      }));
    }

    const antiEscapeFile = commanderSources.find((sourceFile) => {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      return hasAnyKeyword(sourceFile)
        || hasAsAny(sourceFile)
        || hasUnknownAs(sourceFile)
        || hasSuppressionComment(sourceFile)
        || hasDynamicImportOrRequire(sourceFile)
        || (repoPath !== CLOCK_PATH && hasNewDate(sourceFile))
        || hasDateParse(sourceFile);
    });
    if (antiEscapeFile) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
        file: toRepoRelativePath(antiEscapeFile.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "Commander anti-escape failed: any laundering, suppression, dynamic import, or scattered time allocation detected.",
      }));
    }

    const externalLeakFile = project.getSourceFiles().find((sourceFile) => {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      if (repoPath.startsWith(`${ROOT}/`)) {
        return false;
      }
      return FORBIDDEN_EXTERNAL_IMPORTS.some((marker) => hasImportModuleSpecifier(sourceFile, marker));
    });
    if (externalLeakFile) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1",
        file: toRepoRelativePath(externalLeakFile.getFilePath()),
        line: 1,
        severity: "fatal",
        message: "External modules must not import Commander children, runtime internals, registry, or transport port directly.",
      }));
    }

    for (const childId of CHILD_IDS) {
      const schemaPath = `${CHILDREN_ROOT}/${childId}/schema.ts`;
      const contractPath = `${CHILDREN_ROOT}/${childId}/contract.ts`;
      const implementationPath = `${CHILDREN_ROOT}/${childId}/implementation.ts`;
      const schemaFile = getSourceFileOrThrow(project, schemaPath);
      const contractFile = getSourceFileOrThrow(project, contractPath);
      const implementationFile = getSourceFileOrThrow(project, implementationPath);
      const definition = findChildDefinition(implementationFile, childId);

      if (!hasChildSchemaShape(schemaFile, childId)) {
        findings.push(createFinding({
          lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
          file: schemaPath,
          line: 1,
          severity: "fatal",
          message: "Commander child schema.ts must define real local input/output/policy schemas and must not be a re-export shell.",
        }));
      }

      if (!hasChildContractShape(contractFile, childId)) {
        findings.push(createFinding({
          lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
          file: contractPath,
          line: 1,
          severity: "fatal",
          message: "Commander child contract.ts must define real metadata constants and local input/output types.",
        }));
      }

      if (!hasChildImplementationShape(implementationFile, childId)) {
        findings.push(createFinding({
          lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
          file: implementationPath,
          line: 1,
          severity: "fatal",
          message: "Commander child implementation must export a real child definition with inputSchema/outputSchema/execute.",
        }));
      }

      const contractDeclaration = contractFile.getVariableDeclaration(`${toUpperSnakeCase(childId)}_CONTRACT`);
      if (contractCollapsesToAny(contractDeclaration)) {
        findings.push(createFinding({
          lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
          file: contractPath,
          line: 1,
          severity: "fatal",
          message: "Commander child contracts must stay strongly typed and must not collapse to any.",
        }));
      }

      if (definition) {
        const leakedReferences = referenceLeaksOutsideRegistry(definition);
        if (leakedReferences.length > 0) {
          findings.push(createFinding({
            lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1",
            file: leakedReferences[0]!,
            line: 1,
            severity: "fatal",
            message: "Commander child implementations must stay private and only be referenced from registry.ts.",
          }));
        }
      }

      if (COMMAND_CHILD_IDS.has(childId) && !hasCallExpression(implementationFile, "executeCommanderCommandChild")) {
        findings.push(createFinding({
          lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
          file: implementationPath,
          line: 1,
          severity: "fatal",
          message: `Command child ${childId} must execute through executeCommanderCommandChild.`,
        }));
      }
      if (!COMMAND_CHILD_IDS.has(childId) && !hasCallExpression(implementationFile, "executeCommanderReadChild")) {
        findings.push(createFinding({
          lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
          file: implementationPath,
          line: 1,
          severity: "fatal",
          message: `Read child ${childId} must execute through executeCommanderReadChild.`,
        }));
      }
      if (childId === "emergency-stop" && implementationFile.getFullText().includes('"stop-mission"')) {
        findings.push(createFinding({
          lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
          file: implementationPath,
          line: 1,
          severity: "fatal",
          message: "emergency-stop child must never downgrade into stop-mission semantics.",
        }));
      }
      if (childId === "inspect-record-detail" && !implementationFile.getFullText().includes("record_not_found")) {
        findings.push(createFinding({
          lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
          file: implementationPath,
          line: 1,
          severity: "fatal",
          message: "inspect-record-detail must preserve the record_not_found review-required outcome.",
        }));
      }
    }

    const manifest = JSON.parse(manifestText) as { allowedLawIds?: string[]; entry?: string };
    const requiredLawIds = [
      "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1",
      "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1",
      "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1",
      "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
      "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2",
    ];
    if (manifest.entry !== "scripts/audit/domains/commander-console-capability/inspector.ts"
      || !requiredLawIds.every((lawId) => manifest.allowedLawIds?.includes(lawId))) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1",
        file: MANIFEST_PATH,
        line: 1,
        severity: "fatal",
        message: "Commander manifest must point at this inspector and carry all active commander law IDs.",
      }));
    }

    const requiredPassed = findings.length === 0;
    const forbiddenPassed = !hasExportStar(indexSource)
      && !hasPassthrough(readGateSource)
      && !functionContainsThrow(registrySource, "getCommanderConsoleChild")
      && countOccurrences(childExecutorsSource.getFullText(), "output: receipt,") >= 3;
    const boundaryPassed = !forbiddenImportFile
      && !externalLeakFile
      && !startupText.includes("dispatchHumanCommand(")
      && !(shellPageClientSource?.getFullText().includes("command-transport-port") ?? false);
    const antiEscapePassed = !antiEscapeFile;

    return {
      findings,
      phases: [
        createPhase(
          "commander-required-shape",
          requiredPassed ? "PASS" : "CODE VIOLATION",
          requiredPassed,
          requiredPassed
            ? "Required Commander production shape passed: package, child modules, strict gates, proof, and harness all exist."
            : "Required Commander production shape is incomplete or structurally invalid.",
        ),
        createPhase(
          "commander-forbidden-shape",
          forbiddenPassed ? "PASS" : "CODE VIOLATION",
          forbiddenPassed,
          forbiddenPassed
            ? "Forbidden residue checks passed."
            : "Forbidden residue still exists inside Commander surfaces.",
        ),
        createPhase(
          "commander-boundary-attack",
          boundaryPassed ? "PASS" : "CODE VIOLATION",
          boundaryPassed,
          boundaryPassed
            ? "Boundary checks passed: shell stays render-only and startup stays bootstrap-only."
            : "Boundary attack checks failed: direct imports or bypass paths still exist.",
        ),
        createPhase(
          "commander-anti-escape",
          antiEscapePassed ? "PASS" : "CODE VIOLATION",
          antiEscapePassed,
          antiEscapePassed
            ? "Anti-escape checks passed."
            : "Anti-escape violations were detected inside Commander sources.",
        ),
      ],
    };
  },
});
