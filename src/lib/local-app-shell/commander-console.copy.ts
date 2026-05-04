import type { Locale } from "../localization/dictionaries.js";

import type { CommanderAppPageId } from "./commander-app.types.js";
import { localizeCommanderText } from "./locale.js";

export type CommanderConsoleShellCopy = {
  windowTitle: string;
  windowSubtitle: string;
  navigationTitle: string;
  navigationHint: string;
  workspaceTitle: string;
  runtimeStripLabel: string;
  runtimeStripHint: string;
  nav: Record<CommanderAppPageId, { label: string; helper: string }>;
};

export function buildCommanderConsoleShellCopy(locale: Locale): CommanderConsoleShellCopy {
  const t = (zh: string, en: string) => localizeCommanderText(locale, zh, en);

  return {
    windowTitle: t("GrassEye Commander Console", "GrassEye Commander Console"),
    windowSubtitle: t("本地 Mac Agent 控制台", "Local Mac Agent Console"),
    navigationTitle: t("工作区", "Workspace"),
    navigationHint: t("只保留用户真正会使用的主路径。", "Only the user-facing paths stay here."),
    workspaceTitle: t("主工作区", "Main Workspace"),
    runtimeStripLabel: t("运行带", "Runtime Strip"),
    runtimeStripHint: t("底部只保留状态脉冲，不重复主内容。", "The footer keeps runtime pulse only, not a second dashboard."),
    nav: {
      home: { label: t("开始", "Start"), helper: t("启动任务与运行边界", "Start mission and set limits") },
      "map-lab": { label: t("地图工坊", "Map Lab"), helper: t("描述需求并生成可审批地图草稿", "Describe goals and generate reviewable map drafts") },
      mission: { label: t("运行", "Mission"), helper: t("观察当前运行过程", "Track active mission flow") },
      results: { label: t("结果", "Results"), helper: t("查看证据、导出与失败项", "Review evidence, export, and misses") },
      review: { label: t("复核", "Review"), helper: t("处理人工复核队列", "Handle operator review queue") },
      settings: { label: t("设置", "Settings"), helper: t("AI、语言和本地运行设置", "AI, language, and local runtime settings") },
      health: { label: t("诊断", "Diagnostics"), helper: t("状态、阻断和日志摘要", "Status, blockers, and log summaries") },
    },
  };
}
