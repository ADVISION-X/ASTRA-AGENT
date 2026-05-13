import { localizeCommanderText } from "./locale.js";
import type { CommanderConsoleViewModel } from "./types.js";
import type { CommanderAppNavItem, CommanderAppPageId, CommanderAppTabGroup, CommanderAppViewModel } from "./commander-app.types.js";
import { buildActionableErrors } from "./view-helper-actionable-errors.js";

const COMMANDER_APP_PAGE_IDS = new Set<CommanderAppPageId>(["mission", "results", "review", "settings", "health"]);
const COMMANDER_SETTINGS_ALIAS_PAGE_IDS = new Set(["ai-provider-settings", "developer"]);

function parseCommanderAppPageId(value: string | null | undefined): CommanderAppPageId {
  if (COMMANDER_APP_PAGE_IDS.has(value as CommanderAppPageId)) {
    return value as CommanderAppPageId;
  }

  if (COMMANDER_SETTINGS_ALIAS_PAGE_IDS.has(value ?? "")) {
    return "settings";
  }

  return "home";
}

function createCommanderAppNavItems(t: (zh: string, en: string) => string): CommanderAppNavItem[] {
  return [
    { pageId: "home", label: t("开始", "Start"), shortLabel: t("开始", "Start") },
    { pageId: "mission", label: t("运行", "Mission"), shortLabel: t("运行", "Run") },
    { pageId: "results", label: t("结果", "Results"), shortLabel: t("结果", "Results") },
    { pageId: "review", label: t("复核", "Review"), shortLabel: t("复核", "Review") },
    { pageId: "settings", label: t("设置", "Settings"), shortLabel: t("设置", "Set") },
    { pageId: "health", label: t("诊断", "Diagnostics"), shortLabel: t("诊断", "Diag") },
  ];
}

function createCommanderAppTabGroups(t: (zh: string, en: string) => string): CommanderAppTabGroup[] {
  return [
    {
      pageId: "mission",
      groupId: "mission",
      defaultTabId: "mission-overview",
      options: [
        { id: "mission-overview", label: t("总览", "Overview") },
        { id: "mission-timeline", label: t("时间线", "Timeline") },
        { id: "mission-proof", label: t("证明摘要", "Proof Summary") },
      ],
    },
    {
      pageId: "results",
      groupId: "results",
      defaultTabId: "results-summary",
      options: [
        { id: "results-summary", label: t("摘要", "Summary") },
        { id: "results-evidence", label: t("证据包", "Evidence") },
        { id: "results-browse", label: t("Browse Ledger", "Browse") },
        { id: "results-failed", label: t("失败记录", "Failed") },
        { id: "results-export", label: t("导出", "Export") },
      ],
    },
    {
      pageId: "health",
      groupId: "health",
      defaultTabId: "health-capabilities",
      options: [
        { id: "health-capabilities", label: t("状态", "Status") },
        { id: "health-failures", label: t("阻断", "Blocks") },
        { id: "health-logs", label: t("日志摘要", "Log Summary") },
      ],
    },
  ];
}

export function buildCommanderAppViewModel(viewModel: CommanderConsoleViewModel, options?: {
  initialPageId?: string | null;
}): CommanderAppViewModel {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return {
    initialPageId: parseCommanderAppPageId(options?.initialPageId),
    navItems: createCommanderAppNavItems(t),
    tabGroups: createCommanderAppTabGroups(t),
    viewportGate: {
      minWidth: 900,
      maxWidth: 1366,
      idealWidthMin: 1024,
      idealWidthMax: 1280,
      minHeight: 675,
      maxHeight: 920,
      checkpoints: [
        { width: 900, height: 675 },
        { width: 960, height: 720 },
        { width: 1024, height: 768 },
        { width: 1100, height: 825 },
        { width: 1280, height: 900 },
        { width: 1366, height: 900 },
      ],
    },
    actionableErrors: buildActionableErrors(viewModel),
  };
}
