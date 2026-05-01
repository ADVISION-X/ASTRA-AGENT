export const LAW_IDS = {
  DOMAIN: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2",
  APP_SHELL: "GRASSEYE-LOCAL-APP-SHELL-002-V1",
  AUDIT: "GRASSEYE-AUDIT-SYSTEM-001-V1",
} as const;

export const PATHS = {
  ROOT: "src/features/commander-console",
  SCORECARD: "docs/audit/commander-console-mac-app-shell-scorecard.md",
  ATOMIC_QUALITY: "docs/audit/commander-console-ui-atomic-quality.md",
  MISSING_BLUEPRINT: "docs/法案辅助文件/GrassEye Commander Console 总司令页面施工图.md",
  PAGE_RENDER: "src/lib/local-app-shell/render-commander-console-page.ts",
  MAC_SHELL: "src/features/commander-console/CommanderMacShell.ts",
  APP_ROUTER: "src/features/commander-console/CommanderAppRouter.ts",
  APP_TYPES: "src/features/commander-console/commander-app.types.ts",
  APP_VIEW_MODEL: "src/features/commander-console/commander-app.view-model.ts",
  COPY: "src/features/commander-console/commander-console.copy.ts",
  TOKENS: "src/features/commander-console/commander-console.tokens.ts",
  SHELL_CLIENT: "src/features/commander-console/commander-console-shell-client.ts",
  STYLES: "src/features/commander-console/styles/commander-console-styles.ts",
  HOME_PAGE: "src/features/commander-console/pages/HomeStartPage.ts",
  TASK_TEMPLATE_LAUNCHER: "src/features/commander-console/modules/TaskTemplateLauncher.ts",
  LEFT_SIDEBAR: "src/features/commander-console/layout/LeftSidebar.ts",
  MAC_TITLEBAR: "src/features/commander-console/layout/MacTitleBar.ts",
  MAC_TOOLBAR: "src/features/commander-console/layout/MacToolbar.ts",
  MAIN_WORKSPACE: "src/features/commander-console/layout/MainWorkspace.ts",
  RIGHT_INSPECTOR: "src/features/commander-console/layout/RightInspector.ts",
  RUNTIME_STATUS_STRIP: "src/features/commander-console/layout/RuntimeStatusStrip.ts",
  CREATE_SERVER: "src/app/create-workbench-server.ts",
  TASK_HANDLER: "src/app/task-api-handlers.ts",
  CANDIDATE_HANDLER: "src/app/candidate-api-handlers.ts",
  RUNTIME_HANDLER: "src/app/runtime-api-handlers.ts",
} as const;

export const REQUIRED_EXPORTS = [
  { path: PATHS.MAC_SHELL, exportName: "renderCommanderMacShell" },
  { path: PATHS.COPY, exportName: "buildCommanderConsoleShellCopy" },
  { path: PATHS.TOKENS, exportName: "renderCommanderTokenCss" },
  { path: PATHS.LEFT_SIDEBAR, exportName: "renderLeftSidebar" },
  { path: PATHS.MAC_TITLEBAR, exportName: "renderMacTitleBar" },
  { path: PATHS.MAC_TOOLBAR, exportName: "renderMacToolbar" },
  { path: PATHS.MAIN_WORKSPACE, exportName: "renderMainWorkspace" },
  { path: PATHS.RIGHT_INSPECTOR, exportName: "renderRightInspector" },
  { path: PATHS.RUNTIME_STATUS_STRIP, exportName: "renderRuntimeStatusStrip" },
].sort((left, right) => left.path.localeCompare(right.path));

export const SCORECARD_ITEMS = [
  "Mac Toolbar / 顶部工具栏主控",
  "Sidebar First Navigation / 左侧主导航",
  "Single Active Workspace / 单活动页面工作区",
  "Right Inspector Closed By Default / 右侧检查面默认关闭",
  "Desktop Start Surface / 桌面启动面布局",
  "No Phone Bottom Nav / 首壳去手机底栏",
  "Desktop 4:3 Proof / 4:3 窗口实证",
  "Human Copy Hygiene / 人话文案洁净度",
] as const;

export const ATOMIC_QUALITY_ITEMS = [
  "Mac Shell Composition / Toolbar Sidebar Workspace Inspector",
  "Start Page Atomic Layout / 启动页原子分栏",
  "Copy Surface Hygiene / 普通模式文案与字段洁净度",
  "Desktop Proof Recording / 桌面证明记录",
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