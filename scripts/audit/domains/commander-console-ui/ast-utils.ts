import { Node, SyntaxKind, type Project, type SourceFile, type TypeElementTypes } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import {
  createAuditProject,
  flattenPropertyAccess,
  getSourceFileOrThrow,
  getTypeAliasPropertyNames,
  hasAnyKeyword,
  hasExportModuleSpecifier,
  hasImportModuleSpecifier,
} from "../_shared/ast-helpers.js";

export { getTypeAliasPropertyNames };
export { hasImportModuleSpecifier };

export const LAW_ID = "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2";
export const APP_SHELL_LAW_ID = "GRASSEYE-LOCAL-APP-SHELL-001-V1";
export const AUDIT_LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";

export const ROOT = "src/features/commander-console";
export const TYPES_PATH = `${ROOT}/types.ts`;
export const VIEW_MODEL_PATH = `${ROOT}/commander-console-view-model.ts`;
export const SHELL_PATH = `${ROOT}/CommanderConsoleShell.ts`;
export const SHELL_CLIENT_PATH = `${ROOT}/commander-console-shell-client.ts`;
export const PAGE_RENDER_PATH = "src/lib/local-app-shell/render-commander-console-page.ts";
export const CREATE_SERVER_PATH = "src/app/create-workbench-server.ts";
export const TASK_HANDLER_PATH = "src/app/task-api-handlers.ts";
export const CANDIDATE_HANDLER_PATH = "src/app/candidate-api-handlers.ts";
export const RUNTIME_HANDLER_PATH = "src/app/runtime-api-handlers.ts";
export const COMMAND_SCHEMA_PATH = "src/capabilities/commander-console/children/issue-human-command/schema.ts";
export const TRANSPORT_SCHEMA_PATH = "src/capabilities/commander-console/shared/commander-schema-base.ts";

export const LEGACY_FILE_PATHS = [
  "src/lib/local-app-shell/commander-console-page-client.ts",
  "src/lib/local-app-shell/commander-console-page-model.ts",
  "src/lib/local-app-shell/commander-console-page-styles.ts",
] as const;

export const REQUIRED_FILE_EXPORTS = [
  { path: SHELL_PATH, exportName: "renderCommanderConsoleShell" },
  { path: `${ROOT}/layout/GlobalStatusBar.ts`, exportName: "renderGlobalStatusBar" },
  { path: `${ROOT}/layout/PrimaryNavigationRail.ts`, exportName: "renderPrimaryNavigationRail" },
  { path: `${ROOT}/layout/SecondaryTabBar.ts`, exportName: "renderSecondaryTabBar" },
  { path: `${ROOT}/layout/InspectDrawer.ts`, exportName: "renderInspectDrawer" },
  { path: `${ROOT}/pages/CommandCenterPage.ts`, exportName: "renderCommandCenterPage" },
  { path: `${ROOT}/pages/MissionCockpitPage.ts`, exportName: "renderMissionCockpitPage" },
  { path: `${ROOT}/pages/RecordsExportsPage.ts`, exportName: "renderRecordsExportsPage" },
  { path: `${ROOT}/pages/DebugHealthPage.ts`, exportName: "renderDebugHealthPage" },
  { path: `${ROOT}/pages/MapLabPage.ts`, exportName: "renderMapLabPage" },
  { path: `${ROOT}/pages/RunPolicyPage.ts`, exportName: "renderRunPolicyPage" },
  { path: `${ROOT}/modules/command/MapCommandCenter.ts`, exportName: "renderMapCommandCenter" },
  { path: `${ROOT}/modules/command/StartMissionForm.ts`, exportName: "renderStartMissionForm" },
  { path: `${ROOT}/modules/command/HumanCommandPreview.ts`, exportName: "renderHumanCommandPreview" },
  { path: `${ROOT}/modules/command/PreflightPanel.ts`, exportName: "renderPreflightPanel" },
  { path: `${ROOT}/modules/mission/MissionOverview.ts`, exportName: "renderMissionOverview" },
  { path: `${ROOT}/modules/mission/RuntimeProofTimeline.ts`, exportName: "renderRuntimeProofTimeline" },
  { path: `${ROOT}/modules/mission/RoundStatusPanel.ts`, exportName: "renderRoundStatusPanel" },
  { path: `${ROOT}/modules/mission/CurrentTargetPreview.ts`, exportName: "renderCurrentTargetPreview" },
  { path: `${ROOT}/modules/records/EvidencePacketList.ts`, exportName: "renderEvidencePacketList" },
  { path: `${ROOT}/modules/records/BrowseLedgerList.ts`, exportName: "renderBrowseLedgerList" },
  { path: `${ROOT}/modules/records/FailedRecordList.ts`, exportName: "renderFailedRecordList" },
  { path: `${ROOT}/modules/records/ExportCenter.ts`, exportName: "renderExportCenter" },
  { path: `${ROOT}/modules/debug/CapabilityHealthGrid.ts`, exportName: "renderCapabilityHealthGrid" },
  { path: `${ROOT}/modules/debug/FailureRadar.ts`, exportName: "renderFailureRadar" },
  { path: `${ROOT}/modules/debug/StructuredDebugLog.ts`, exportName: "renderStructuredDebugLog" },
  { path: `${ROOT}/modules/debug/UnfinalizedRoundWatcher.ts`, exportName: "renderUnfinalizedRoundWatcher" },
  { path: `${ROOT}/modules/map-lab/DraftMapPanel.ts`, exportName: "renderDraftMapPanel" },
  { path: `${ROOT}/modules/map-lab/MapValidationPanel.ts`, exportName: "renderMapValidationPanel" },
  { path: `${ROOT}/modules/map-lab/MapApprovalPanel.ts`, exportName: "renderMapApprovalPanel" },
  { path: `${ROOT}/modules/policy/SafetyLocksPanel.ts`, exportName: "renderSafetyLocksPanel" },
  { path: `${ROOT}/modules/policy/RunLimitsPanel.ts`, exportName: "renderRunLimitsPanel" },
  { path: `${ROOT}/modules/policy/AppShellReadinessPanel.ts`, exportName: "renderAppShellReadinessPanel" },
  { path: `${ROOT}/inspect/renderInspectMapDetails.ts`, exportName: "renderInspectMapDetails" },
  { path: `${ROOT}/inspect/renderInspectRoundDetails.ts`, exportName: "renderInspectRoundDetails" },
  { path: `${ROOT}/inspect/renderInspectEvidenceDetails.ts`, exportName: "renderInspectEvidenceDetails" },
] as const;

export const REQUIRED_PRIMARY_PAGES = [
  "command-center",
  "mission-cockpit",
  "records-exports",
  "debug-health",
  "map-lab",
  "run-policy",
] as const;

export const REQUIRED_HANDLER_NAMES = [
  "onDraftHumanCommand",
  "onSubmitHumanCommand",
  "onPauseMission",
  "onResumeMission",
  "onStopMission",
  "onEmergencyStop",
  "onSubmitReviewDecision",
  "onRequestExport",
  "onOpenInspect",
] as const;

export const REQUIRED_VIEW_MODEL_PROPERTIES = [
  "activeMissionSummary",
  "activeRoundSummary",
  "availableMaps",
  "preflightSummary",
  "commandDraft",
  "capabilityHealth",
  "reviewQueueSummary",
  "failureRadarSummary",
  "structuredLogPreview",
  "evidencePackets",
  "browseLedger",
  "failedRecords",
  "runtimeProofTimeline",
  "exportSummary",
  "inspectItems",
] as const;

export const REQUIRED_CLIENT_ROUTE_MARKERS = [
  "/api/tasks/start",
  "/api/tasks/pause",
  "/api/tasks/resume",
  "/api/tasks/stop",
  "/api/tasks/emergency-stop",
  "/api/candidates/review-decision",
  "/api/candidates/request-export",
  "data-review-candidate",
  "data-export-type",
] as const;

export const FORBIDDEN_IMPORT_MARKERS = [
  "/lib/local-runtime/",
  "/lib/browser/",
  "/capabilities/commander-console/children/",
  "/capabilities/commander-console/runtime/",
  "/capabilities/ai/",
  "/capabilities/open/",
  "/capabilities/forensics-persistence/",
  "/capabilities/page-state/children/",
  "/capabilities/page-state/runtime/",
] as const;

export function createCommanderConsoleUiProject(): Project {
  return createAuditProject();
}

export function getUiSourceFile(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export function getExportedNames(sourceFile: SourceFile): Set<string> {
  return new Set(sourceFile.getExportedDeclarations().keys());
}

export async function pathExists(repoRelativePath: string): Promise<boolean> {
  return fileExists(pathFromRepoRoot(repoRelativePath));
}

export function getUnionLiteralValues(sourceFile: SourceFile, typeAliasName: string): string[] {
  const alias = sourceFile.getTypeAlias(typeAliasName);
  const typeNode = alias?.getTypeNode();
  if (!typeNode || !Node.isUnionTypeNode(typeNode)) {
    return [];
  }

  return typeNode.getTypeNodes().flatMap((node) => {
    if (!Node.isLiteralTypeNode(node)) {
      return [];
    }

    const literal = node.getLiteral();
    return Node.isStringLiteral(literal) ? [literal.getLiteralText()] : [];
  });
}

export function getInterfaceMethodNames(sourceFile: SourceFile, interfaceName: string): Set<string> {
  const declaration = sourceFile.getInterface(interfaceName);
  if (!declaration) {
    return new Set();
  }

  return new Set(
    declaration.getMembers().flatMap((member: TypeElementTypes) => {
      if (Node.isMethodSignature(member)) {
        return [member.getName()];
      }

      return [];
    }),
  );
}

export function getObjectArrayLength(sourceFile: SourceFile, variableName: string): number {
  const declaration = sourceFile.getVariableDeclaration(variableName);
  const initializer = declaration?.getInitializer();
  return initializer && Node.isArrayLiteralExpression(initializer) ? initializer.getElements().length : 0;
}

export function hasLiteralFragment(sourceFile: SourceFile, fragment: string): boolean {
  return sourceFile.getDescendants().some((descendant) => {
    if (Node.isStringLiteral(descendant) || Node.isNoSubstitutionTemplateLiteral(descendant)) {
      return descendant.getLiteralText().includes(fragment);
    }

    if (Node.isTemplateHead(descendant) || Node.isTemplateMiddle(descendant) || Node.isTemplateTail(descendant)) {
      return descendant.getLiteralText().includes(fragment);
    }

    return false;
  });
}

export function hasIdentifierNamed(sourceFile: SourceFile, identifierName: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);
}

export function hasPropertyAccessPath(sourceFile: SourceFile, pathParts: string[]): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const parts = flattenPropertyAccess(expression);
    return parts.length === pathParts.length && parts.every((part, index) => part === pathParts[index]);
  });
}

export function hasForbiddenImport(sourceFile: SourceFile): boolean {
  return FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker) || hasExportModuleSpecifier(sourceFile, marker));
}

export function hasStartRequiredBothCondition(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => {
    const expression = statement.getExpression();
    return Node.isBinaryExpression(expression)
      && expression.getOperatorToken().getKind() === SyntaxKind.BarBarToken
      && isNegatedPath(expression.getLeft(), ["requestedPlatformId"]) 
      && isNegatedPath(expression.getRight(), ["selectedMapId"]);
  }) || sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => {
    const expression = statement.getExpression();
    return Node.isBinaryExpression(expression)
      && expression.getOperatorToken().getKind() === SyntaxKind.BarBarToken
      && isNegatedPath(expression.getLeft(), ["value", "requestedPlatformId"])
      && isNegatedPath(expression.getRight(), ["value", "selectedMapId"]);
  });
}

function isNegatedPath(node: Node, pathParts: string[]): boolean {
  if (!Node.isPrefixUnaryExpression(node) || node.getOperatorToken() !== SyntaxKind.ExclamationToken) {
    return false;
  }

  const operand = node.getOperand();
  const parts = flattenPropertyAccess(operand);
  return parts.length === pathParts.length && parts.every((part, index) => part === pathParts[index]);
}

export function getUiFeatureSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

export function hasUnsafeEscape(sourceFile: SourceFile): boolean {
  const text = sourceFile.getFullText();
  return hasAnyKeyword(sourceFile)
    || text.includes("as any")
    || text.includes("as unknown as")
    || text.includes("@ts-ignore")
    || text.includes("@ts-expect-error")
    || text.includes("eslint-disable")
    || text.includes("commanderConsolePageClient")
    || text.includes("buildCommanderConsolePageModel")
    || text.includes("commanderConsolePageStyles")
    || text.includes("window.commanderConsoleShell");
}