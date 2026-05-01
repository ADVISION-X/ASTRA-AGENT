import type { Locale } from "../../localization/dictionaries.js";

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

const RUN_LIMITS: PolicyDefinition[] = [
  { id: "max-rounds", zhLabel: "最大轮次", enLabel: "Max rounds", status: "ok", zhDetail: "默认 3 轮，可在起始草案中显式修改。", enDetail: "Defaults to 3 rounds and must be explicitly set in the start draft." },
  { id: "max-minutes", zhLabel: "最大分钟数", enLabel: "Max minutes", status: "ok", zhDetail: "默认 20 分钟，用于约束本地长跑。", enDetail: "Defaults to 20 minutes to bound local execution." },
];

const APP_SHELL_READINESS: PolicyDefinition[] = [
  { id: "local-shell-only", zhLabel: "本地壳边界", enLabel: "Local shell boundary", status: "ok", zhDetail: "当前 Commander Console 仍为本地 HTTP app shell，不引入 SaaS / browser extension 形态。", enDetail: "Commander Console stays as a local HTTP app shell without SaaS or extension drift." },
  { id: "inspect-drawer-ready", zhLabel: "Inspect Drawer", enLabel: "Inspect drawer", status: "ok", zhDetail: "右侧抽屉承接深信息，主工作区不再塞满日志与原始记录。", enDetail: "The right drawer absorbs deep details so the main workspace is no longer a packed dashboard." },
];

export function buildSafetyLocks(locale: Locale): CommanderConsolePolicyCheck[] {
  return SAFETY_LOCKS.map((definition) => toPolicyCheck(locale, definition));
}

export function buildRunLimits(locale: Locale): CommanderConsolePolicyCheck[] {
  return RUN_LIMITS.map((definition) => toPolicyCheck(locale, definition));
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