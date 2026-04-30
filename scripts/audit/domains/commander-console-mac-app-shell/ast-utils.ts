import { readFile } from "node:fs/promises";

import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import {
  createAuditProject,
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

export const LAW_ID = "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2";
export const APP_SHELL_LAW_ID = "GRASSEYE-LOCAL-APP-SHELL-002-V1";
export const AUDIT_LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";

export const ROOT = "src/features/commander-console";
export const SCORECARD_PATH = "docs/audit/commander-console-mac-app-shell-scorecard.md";
export const ATOMIC_QUALITY_PATH = "docs/audit/commander-console-ui-atomic-quality.md";
export const MISSING_BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Commander Console 总司令页面施工图.md";

export const PAGE_RENDER_PATH = "src/lib/local-app-shell/render-commander-console-page.ts";
export const MAC_SHELL_PATH = `${ROOT}/CommanderMacShell.ts`;
export const APP_SHELL_PATH = `${ROOT}/CommanderAppShell.ts`;
export const APP_ROUTER_PATH = `${ROOT}/CommanderAppRouter.ts`;
export const APP_TYPES_PATH = `${ROOT}/commander-app.types.ts`;
export const APP_VIEW_MODEL_PATH = `${ROOT}/commander-app.view-model.ts`;
export const COPY_PATH = `${ROOT}/commander-console.copy.ts`;
export const TOKENS_PATH = `${ROOT}/commander-console.tokens.ts`;
export const SHELL_CLIENT_PATH = `${ROOT}/commander-console-shell-client.ts`;
export const VIEW_MODEL_PATH = `${ROOT}/commander-console-view-model.ts`;
export const STYLES_PATH = `${ROOT}/styles/commander-console-styles.ts`;
export const HOME_PAGE_PATH = `${ROOT}/pages/HomeStartPage.ts`;
export const TASK_TEMPLATE_LAUNCHER_PATH = `${ROOT}/modules/TaskTemplateLauncher.ts`;
export const LEFT_SIDEBAR_PATH = `${ROOT}/layout/LeftSidebar.ts`;
export const MAC_TITLEBAR_PATH = `${ROOT}/layout/MacTitleBar.ts`;
export const MAC_TOOLBAR_PATH = `${ROOT}/layout/MacToolbar.ts`;
export const MAIN_WORKSPACE_PATH = `${ROOT}/layout/MainWorkspace.ts`;
export const RIGHT_INSPECTOR_PATH = `${ROOT}/layout/RightInspector.ts`;
export const RUNTIME_STATUS_STRIP_PATH = `${ROOT}/layout/RuntimeStatusStrip.ts`;
export const CREATE_SERVER_PATH = "src/app/create-workbench-server.ts";
export const TASK_HANDLER_PATH = "src/app/task-api-handlers.ts";
export const CANDIDATE_HANDLER_PATH = "src/app/candidate-api-handlers.ts";
export const RUNTIME_HANDLER_PATH = "src/app/runtime-api-handlers.ts";

export const REQUIRED_EXPORTS = [
  { path: MAC_SHELL_PATH, exportName: "renderCommanderMacShell" },
  { path: COPY_PATH, exportName: "buildCommanderConsoleShellCopy" },
  { path: TOKENS_PATH, exportName: "renderCommanderTokenCss" },
  { path: LEFT_SIDEBAR_PATH, exportName: "renderLeftSidebar" },
  { path: MAC_TITLEBAR_PATH, exportName: "renderMacTitleBar" },
  { path: MAC_TOOLBAR_PATH, exportName: "renderMacToolbar" },
  { path: MAIN_WORKSPACE_PATH, exportName: "renderMainWorkspace" },
  { path: RIGHT_INSPECTOR_PATH, exportName: "renderRightInspector" },
  { path: RUNTIME_STATUS_STRIP_PATH, exportName: "renderRuntimeStatusStrip" },
].sort((left, right) => left.path.localeCompare(right.path));

export const SCORECARD_ITEMS = [
  "Mac Toolbar / 顶部工具栏主控",
  "Sidebar First Navigation / 左侧主导航",
  "Single Active Workspace / 单活动页面工作区",
  "Right Inspector Closed By Default / 右侧检查面默认关闭",
  "Desktop Start Surface / 桌面启动面布局",
  "No Phone Bottom Nav / 首壳去手机底栏",
  "Desktop 4:3 Proof / 4:3 窗口实证",
  "Human Copy Hygiene / 人话文案洁净度"
] as const;

export const ATOMIC_QUALITY_ITEMS = [
  "Mac Shell Composition / Toolbar Sidebar Workspace Inspector",
  "Start Page Atomic Layout / 启动页原子分栏",
  "Copy Surface Hygiene / 普通模式文案与字段洁净度",
  "Desktop Proof Recording / 桌面证明记录"
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
  "/capabilities/forensics-persistence/"
] as const;

const SCORECARD_START = "<!-- COMMANDER_CONSOLE_MAC_APP_SHELL_SCORECARD_JSON_START -->";
const SCORECARD_END = "<!-- COMMANDER_CONSOLE_MAC_APP_SHELL_SCORECARD_JSON_END -->";
const ATOMIC_QUALITY_START = "<!-- COMMANDER_CONSOLE_UI_ATOMIC_QUALITY_JSON_START -->";
const ATOMIC_QUALITY_END = "<!-- COMMANDER_CONSOLE_UI_ATOMIC_QUALITY_JSON_END -->";

export type AuditItem = {
  name: string;
  score: number;
  evidence: string[];
  filesInspected: string[];
  touchedFiles: string[];
  proof: string[];
  failedReasons: string[];
  requiredFix: string;
  currentVerdict: "PASS" | "FAIL";
};

export type StructuredAuditDoc = {
  generatedAt: string;
  result: string;
  missingReferences: string[];
  items: AuditItem[];
};

export function createCommanderConsoleMacShellProject(): Project {
  return createAuditProject();
}

export function getMacShellSourceFile(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export function getExportedNames(sourceFile: SourceFile): Set<string> {
  return new Set(sourceFile.getExportedDeclarations().keys());
}

export async function pathExists(repoRelativePath: string): Promise<boolean> {
  return fileExists(pathFromRepoRoot(repoRelativePath));
}

async function readStructuredAuditDoc(path: string, startMarker: string, endMarker: string): Promise<StructuredAuditDoc> {
  const content = await readFile(pathFromRepoRoot(path), "utf8");
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Structured JSON block is missing in ${path}.`);
  }

  const json = content.slice(start + startMarker.length, end).trim();
  return JSON.parse(json) as StructuredAuditDoc;
}

export function getUiFeatureSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

export function hasForbiddenImport(sourceFile: SourceFile): boolean {
  return FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker) || hasExportModuleSpecifier(sourceFile, marker));
}

export function hasUnsafeEscape(sourceFile: SourceFile): boolean {
  const text = sourceFile.getFullText();
  return hasAnyKeyword(sourceFile)
    || text.includes("as any")
    || text.includes("as unknown as")
    || text.includes("@ts-ignore")
    || text.includes("@ts-expect-error")
    || text.includes("eslint-disable")
    || sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport());
}

export function hasNamedImport(sourceFile: SourceFile, marker: string, importName: string): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    if (!specifier.includes(marker)) {
      return false;
    }

    return declaration.getNamedImports().some((namedImport) => namedImport.getName() === importName || namedImport.getAliasNode()?.getText() === importName);
  });
}

export function hasSourceTextFragment(sourceFile: SourceFile, fragment: string): boolean {
  return sourceFile.getFullText().includes(fragment);
}

export async function readScorecardData(): Promise<StructuredAuditDoc> {
  return readStructuredAuditDoc(SCORECARD_PATH, SCORECARD_START, SCORECARD_END);
}

export async function readAtomicQualityData(): Promise<StructuredAuditDoc> {
  return readStructuredAuditDoc(ATOMIC_QUALITY_PATH, ATOMIC_QUALITY_START, ATOMIC_QUALITY_END);
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