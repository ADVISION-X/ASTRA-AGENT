import { readFile } from "node:fs/promises";

import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import {
  createAuditProject,
  hasCallExpression,
  getSourceFileOrThrow,
  getTypeAliasPropertyNames,
  hasAnyKeyword,
  hasExportModuleSpecifier,
  hasImportModuleSpecifier,
  hasLiteralTextFragment,
  hasNullishCoalescingLiteral,
  hasPropertyAccessPath,
} from "../_shared/ast-helpers.js";

export { getTypeAliasPropertyNames, hasImportModuleSpecifier, hasLiteralTextFragment, hasNullishCoalescingLiteral, hasPropertyAccessPath };
export { hasCallExpression };

export const LAW_ID = "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2";
export const APP_SHELL_LAW_ID = "GRASSEYE-LOCAL-APP-SHELL-002-V1";
export const AUDIT_LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";

export const ROOT = "src/features/commander-console";
export const SCORECARD_PATH = "docs/audit/commander-console-user-love-scorecard.md";
export const LEGACY_SHELL_PATH = `${ROOT}/CommanderConsoleShell.ts`;
export const APP_SHELL_PATH = `${ROOT}/CommanderAppShell.ts`;
export const APP_ROUTER_PATH = `${ROOT}/CommanderAppRouter.ts`;
export const TYPES_PATH = `${ROOT}/types.ts`;
export const APP_TYPES_PATH = `${ROOT}/commander-app.types.ts`;
export const APP_VIEW_MODEL_PATH = `${ROOT}/commander-app.view-model.ts`;
export const SHELL_CLIENT_PATH = `${ROOT}/commander-console-shell-client.ts`;
export const VIEW_MODEL_PATH = `${ROOT}/commander-console-view-model.ts`;
export const COMPACT_STATUS_BAR_PATH = `${ROOT}/layout/CompactStatusBar.ts`;
export const BOTTOM_NAV_PATH = `${ROOT}/layout/BottomNav.ts`;
export const INSPECT_MODAL_PATH = `${ROOT}/layout/InspectModal.ts`;
export const STYLES_PATH = `${ROOT}/styles/commander-console-styles.ts`;
export const HOME_PAGE_PATH = `${ROOT}/pages/HomeStartPage.ts`;
export const MISSION_PAGE_PATH = `${ROOT}/pages/MissionPage.ts`;
export const RESULTS_PAGE_PATH = `${ROOT}/pages/ResultsPage.ts`;
export const REVIEW_PAGE_PATH = `${ROOT}/pages/ReviewPage.ts`;
export const HEALTH_PAGE_PATH = `${ROOT}/pages/HealthPage.ts`;
export const DEVELOPER_PAGE_PATH = `${ROOT}/pages/DeveloperPage.ts`;
export const TASK_TEMPLATE_LAUNCHER_PATH = `${ROOT}/modules/TaskTemplateLauncher.ts`;
export const RUN_LIMIT_MINI_FORM_PATH = `${ROOT}/modules/RunLimitMiniForm.ts`;
export const SAFETY_CONTROLS_PATH = `${ROOT}/modules/SafetyControls.ts`;
export const CURRENT_MISSION_CARD_PATH = `${ROOT}/modules/CurrentMissionCard.ts`;
export const CURRENT_STEP_CARD_PATH = `${ROOT}/modules/CurrentStepCard.ts`;
export const RESULT_SUMMARY_CARD_PATH = `${ROOT}/modules/ResultSummaryCard.ts`;
export const REVIEW_SUMMARY_CARD_PATH = `${ROOT}/modules/ReviewSummaryCard.ts`;
export const ACTIONABLE_ERROR_BANNER_PATH = `${ROOT}/modules/ActionableErrorBanner.ts`;
export const DEBUG_DRILLDOWN_BUTTON_PATH = `${ROOT}/modules/DebugDrilldownButton.ts`;
export const CAPABILITY_HEALTH_LIST_PATH = `${ROOT}/modules/CapabilityHealthList.ts`;
export const STRUCTURED_LOG_LIST_PATH = `${ROOT}/modules/StructuredLogList.ts`;
export const PAGE_RENDER_PATH = "src/lib/local-app-shell/render-commander-console-page.ts";
export const CREATE_SERVER_PATH = "src/app/create-workbench-server.ts";
export const TASK_HANDLER_PATH = "src/app/task-api-handlers.ts";
export const CANDIDATE_HANDLER_PATH = "src/app/candidate-api-handlers.ts";
export const RUNTIME_HANDLER_PATH = "src/app/runtime-api-handlers.ts";

export const HOME_SURFACE_FILES = [
  HOME_PAGE_PATH,
  TASK_TEMPLATE_LAUNCHER_PATH,
  RUN_LIMIT_MINI_FORM_PATH,
  SAFETY_CONTROLS_PATH,
  CURRENT_MISSION_CARD_PATH,
  RESULT_SUMMARY_CARD_PATH,
  ACTIONABLE_ERROR_BANNER_PATH,
] as const;

export const REQUIRED_EXPORTS = [
  { path: APP_SHELL_PATH, exportName: "renderCommanderAppShell" },
  { path: APP_ROUTER_PATH, exportName: "buildCommanderAppPageHtmlMap" },
  { path: APP_ROUTER_PATH, exportName: "renderCommanderAppRouter" },
  { path: APP_VIEW_MODEL_PATH, exportName: "buildCommanderAppViewModel" },
  { path: COMPACT_STATUS_BAR_PATH, exportName: "renderCompactStatusBar" },
  { path: BOTTOM_NAV_PATH, exportName: "renderBottomNav" },
  { path: INSPECT_MODAL_PATH, exportName: "renderInspectModal" },
  { path: HOME_PAGE_PATH, exportName: "renderHomeStartPage" },
  { path: MISSION_PAGE_PATH, exportName: "renderMissionPage" },
  { path: RESULTS_PAGE_PATH, exportName: "renderResultsPage" },
  { path: REVIEW_PAGE_PATH, exportName: "renderReviewPage" },
  { path: HEALTH_PAGE_PATH, exportName: "renderHealthPage" },
  { path: DEVELOPER_PAGE_PATH, exportName: "renderDeveloperPage" },
  { path: TASK_TEMPLATE_LAUNCHER_PATH, exportName: "renderTaskTemplateLauncherModule" },
  { path: RUN_LIMIT_MINI_FORM_PATH, exportName: "renderRunLimitMiniForm" },
  { path: SAFETY_CONTROLS_PATH, exportName: "renderSafetyControls" },
  { path: CURRENT_MISSION_CARD_PATH, exportName: "renderCurrentMissionCard" },
  { path: CURRENT_STEP_CARD_PATH, exportName: "renderCurrentStepCard" },
  { path: RESULT_SUMMARY_CARD_PATH, exportName: "renderResultSummaryCard" },
  { path: REVIEW_SUMMARY_CARD_PATH, exportName: "renderReviewSummaryCard" },
  { path: ACTIONABLE_ERROR_BANNER_PATH, exportName: "renderActionableErrorBanner" },
  { path: DEBUG_DRILLDOWN_BUTTON_PATH, exportName: "renderDebugDrilldownButton" },
  { path: CAPABILITY_HEALTH_LIST_PATH, exportName: "renderCapabilityHealthList" },
  { path: STRUCTURED_LOG_LIST_PATH, exportName: "renderStructuredLogList" },
].sort((left, right) => left.path.localeCompare(right.path));

export const SCORECARD_ITEMS = [
  "State Clarity / 3 秒看懂状态",
  "Two-Step Launch / 30 秒内启动任务",
  "No System Fields / 主界面不暴露系统字段",
  "Human Language / 每个步骤都是人话",
  "Actionable Errors / 出错知道发生什么、为什么、怎么办",
  "Debug Without Pressure / Debug 透明但不压迫主界面",
  "Result Visibility / 跑完能看到结果",
  "Safety Control / 暂停、停止、急停、运行限制清晰",
  "Density Control / 主界面低密度、不蚂蚁化",
  "Normal / Developer Mode Separation / 普通模式与开发者模式分离",
  "User Control Feeling / 用户感觉能控制机器",
  "App Shell Readiness / 未来 App 化承载友好",
  "App Compact Viewport / 三分之一屏幕可用性",
] as const;

export const FORBIDDEN_FIELD_LITERALS = [
  "selectedMapId",
  "requestedPlatformId",
  "targetProfileRef",
  "mapId",
  "stepId",
  "childCapabilityId",
  "proofRef",
  "runtimeProof",
  "nerveBusEnvelopeId",
] as const;

export const FORBIDDEN_IMPORT_MARKERS = [
  "/lib/local-runtime/",
  "/lib/browser/",
  "/capabilities/commander-console/children/",
  "/capabilities/commander-console/runtime/",
  "/capabilities/orchestration/runtime/",
  "/capabilities/nerve-bus/runtime/",
  "/capabilities/ai/",
  "/capabilities/open/",
  "/capabilities/screenshot/",
  "/capabilities/mouse-click/",
  "/capabilities/mouse-scroll/",
  "/capabilities/forensics-persistence/",
] as const;

const SCORECARD_START = "<!-- COMMANDER_CONSOLE_USER_LOVE_SCORECARD_JSON_START -->";
const SCORECARD_END = "<!-- COMMANDER_CONSOLE_USER_LOVE_SCORECARD_JSON_END -->";

export type ScorecardItem = {
  name: string;
  score: number;
  evidence: string[];
  failedReasons: string[];
  filesInspected: string[];
  touchedFiles: string[];
  screenshotsOrDomEvidence: string[];
  proof: string[];
  userFacingAcceptance: string;
  developerFacingAcceptance: string;
  requiredFix: string;
  currentVerdict: "PASS" | "FAIL";
};

export type ScorecardData = {
  generatedAt: string;
  result: string;
  missingReferences: string[];
  items: ScorecardItem[];
};

export function createCommanderConsoleUserLoveProject(): Project {
  return createAuditProject();
}

export function getUserLoveSourceFile(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export function getExportedNames(sourceFile: SourceFile): Set<string> {
  return new Set(sourceFile.getExportedDeclarations().keys());
}

export async function pathExists(repoRelativePath: string): Promise<boolean> {
  return fileExists(pathFromRepoRoot(repoRelativePath));
}

export async function readScorecardData(): Promise<ScorecardData> {
  const content = await readFile(pathFromRepoRoot(SCORECARD_PATH), "utf8");
  const start = content.indexOf(SCORECARD_START);
  const end = content.indexOf(SCORECARD_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Commander Console User Love scorecard JSON block is missing.");
  }

  const json = content.slice(start + SCORECARD_START.length, end).trim();
  return JSON.parse(json) as ScorecardData;
}

export function getUiFeatureSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

export function hasForbiddenImport(sourceFile: SourceFile): boolean {
  return FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker) || hasExportModuleSpecifier(sourceFile, marker));
}

export function hasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport());
}

export function hasUnsafeEscape(sourceFile: SourceFile): boolean {
  const text = sourceFile.getFullText();
  return hasAnyKeyword(sourceFile)
    || text.includes("as any")
    || text.includes("as unknown as")
    || text.includes("@ts-ignore")
    || text.includes("@ts-expect-error")
    || text.includes("eslint-disable")
    || hasExportStar(sourceFile);
}

export function hasStartRequiredBothCondition(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => {
    const expression = statement.getExpression();
    return Node.isBinaryExpression(expression)
      && expression.getOperatorToken().getKind() === SyntaxKind.BarBarToken
      && isNegatedPath(expression.getLeft(), ["requestedPlatformId"])
      && isNegatedPath(expression.getRight(), ["selectedMapId"]);
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

function flattenPropertyAccess(node: Node | undefined): string[] {
  if (!node) {
    return [];
  }

  if (Node.isPropertyAccessExpression(node)) {
    return [...flattenPropertyAccess(node.getExpression()), node.getName()];
  }

  if (Node.isIdentifier(node)) {
    return [node.getText()];
  }

  return [];
}