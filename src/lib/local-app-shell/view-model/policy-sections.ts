import type { Locale } from "../../localization/dictionaries.js";
import type { AppRunLimitSettings } from "../../local-runtime/app-run-limit-settings-types.js";

import { localizeCommanderText } from "../locale.js";
import type { CommanderConsoleExportRequest, CommanderConsolePolicyCheck, CommanderConsoleViewModel } from "../types.js";

type PolicyDefinition = {
  id: string;
  zhLabel: string;
  enLabel: string;
  status: CommanderConsolePolicyCheck["status"];
  zhDetail: string;
  enDetail: string;
};

function toPolicyCheck(locale: Locale, definition: PolicyDefinition): CommanderConsolePolicyCheck {
  return {
    id: definition.id,
    label: localizeCommanderText(locale, definition.zhLabel, definition.enLabel),
    status: definition.status,
    detail: localizeCommanderText(locale, definition.zhDetail, definition.enDetail),
  };
}

const SAFETY_LOCKS: PolicyDefinition[] = [
  { id: "no-silent-default", zhLabel: "禁止静默默认值", enLabel: "No silent defaults", status: "ok", zhDetail: "指挥启动必须同时显式提交 map 与 platform。", enDetail: "Mission start must explicitly submit both map and platform." },
  { id: "emergency-stop-ready", zhLabel: "急停通路", enLabel: "Emergency stop path", status: "ok", zhDetail: "保留独立 emergency-stop command transport。", enDetail: "Dedicated emergency-stop command transport remains available." },
];

const APP_SHELL_READINESS: PolicyDefinition[] = [
  { id: "local-shell-only", zhLabel: "本地壳边界", enLabel: "Local shell boundary", status: "ok", zhDetail: "当前 Commander Console 仍为本地 HTTP app shell，不引入 SaaS / browser extension 形态。", enDetail: "Commander Console stays as a local HTTP app shell without SaaS or extension drift." },
  { id: "inspect-drawer-ready", zhLabel: "Inspect Drawer", enLabel: "Inspect drawer", status: "ok", zhDetail: "右侧抽屉承接深信息，主工作区不再塞满日志与原始记录。", enDetail: "The right drawer absorbs deep details so the main workspace is no longer a packed dashboard." },
];

export function buildSafetyLocks(locale: Locale): CommanderConsolePolicyCheck[] {
  return SAFETY_LOCKS.map((definition) => toPolicyCheck(locale, definition));
}

export function buildRunLimits(locale: Locale, settings: AppRunLimitSettings): CommanderConsolePolicyCheck[] {
  return [
    {
      id: "run-limit-owner",
      label: localizeCommanderText(locale, "默认值归属", "Default owner"),
      status: "ok",
      detail: localizeCommanderText(
        locale,
        "运行时长与最多处理的默认值只归 APP 设置所有，地图包不得携带或钳制这两个字段。",
        "Run duration and max-items defaults belong only to app settings; map packages must neither carry nor clamp them.",
      ),
    },
    {
      id: "run-limit-defaults",
      label: localizeCommanderText(locale, "当前默认值", "Current defaults"),
      status: "ok",
      detail: localizeCommanderText(
        locale,
        `当前默认值为 ${settings.defaultMaxMinutes} 分钟 / ${settings.defaultMaxRounds} 轮；用户可在开始页任意改写。`,
        `Current defaults are ${settings.defaultMaxMinutes} minutes / ${settings.defaultMaxRounds} rounds; operators may override them freely on the start page.`,
      ),
    },
  ];
}

export function buildAppShellReadiness(locale: Locale): CommanderConsolePolicyCheck[] {
  return APP_SHELL_READINESS.map((definition) => toPolicyCheck(locale, definition));
}

export function buildExportSummary(locale: Locale): CommanderConsoleViewModel["exportSummary"] {
  const exportItem: CommanderConsoleExportRequest = {
    id: "candidate-summary",
    label: localizeCommanderText(locale, "候选摘要导出", "Candidate summary export"),
    status: localizeCommanderText(locale, "当前构建未开放", "Unavailable in this build"),
    detail: localizeCommanderText(locale, "当前构建尚未实现 governed export request，所以页面不再把导出显示为可执行动作。", "Governed export requests are not implemented in this build, so the page no longer presents export as an executable action."),
  };

  return [exportItem];
}