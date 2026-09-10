import { renderLocalizationClientRuntime } from "./localization-client-runtime.js";

export const supportedAppShellLocales = ["zh", "en"] as const;
export type AppShellLocale = (typeof supportedAppShellLocales)[number];

export const defaultAppShellLocale: AppShellLocale = "zh";
export const appShellLocaleCookieName = "grasseye-app-locale";
export const appShellLocaleSearchParamName = "locale";

const appShellZhCopyEntries = [
  ["GrassEye", "GrassEye"],
  ["GrassEye AGENT Workbench", "GrassEye AGENT 工作台"],
  ["AGENT Workbench", "AGENT 工作台"],
  ["Skill Registry", "技能注册表"],
  ["Toggle sidebar", "切换侧边栏"],
  ["Collapse sidebar", "收起侧边栏"],
  ["Toggle inspector", "切换检查器"],
  ["Toggle console", "切换控制台"],
  ["Refresh shell", "刷新工作台"],
  ["Language", "语言"],
  ["Chinese", "中文"],
  ["English", "English"],
  ["health", "健康"],
  ["mode", "模式"],
  ["Inspector", "检查器"],
  ["No selection", "未选择"],
  ["empty", "空"],
  ["Open Detail When Needed", "需要时打开详情"],
  ["Whole-order status, evidence, exceptions, and runtime events use this detail surface. It stays closed until the operator selects a record.", "整单状态、证据、异常和运行事件使用此详情面板；操作员选择记录前它保持关闭。"],
  ["Task Snapshot", "任务快照"],
  ["Status", "状态"],
  ["Step", "步骤"],
  ["Reason", "原因"],
  ["Owner", "责任方"],
  ["Evidence", "证据"],
  ["Raw record", "原始记录"],
  ["Runtime Console", "运行控制台"],
  ["ready", "就绪"],
  ["Waiting for runtime events.", "等待运行事件。"],
  ["Loading runtime events...", "正在加载运行事件……"],
  ["Runtime event stream unavailable.", "运行事件流不可用。"],
  ["manual_required events appear here.", "需要人工处理的事件显示在这里。"],
  ["failed events appear here.", "失败事件显示在这里。"],
  ["Local-only whole-order status and safe intervention surface.", "仅限本地的整单状态与安全介入界面。"],
  ["一次读取 Website、AGENT、Browser、Outbox 与日志各自权威；不领取、不重试、不恢复。", "一次读取网站、执行器、浏览器、发件箱与日志各自权威；不领取、不重试、不恢复。"],
] as const;

export const appShellZhCopy: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(appShellZhCopyEntries),
);

export const renderLocaleToggle = (): string => `
<div class="locale-toggle" data-locale-toggle aria-label="Language">
  <span>Language</span>
  <button class="locale-button" type="button" data-locale-choice="zh" aria-pressed="true">中文</button>
  <button class="locale-button" type="button" data-locale-choice="en" aria-pressed="false">English</button>
</div>`;

export const renderAppShellLocalizationClient = (): string => renderLocalizationClientRuntime({
  supportedLocales: supportedAppShellLocales,
  defaultLocale: defaultAppShellLocale,
  cookieName: appShellLocaleCookieName,
  searchParamName: appShellLocaleSearchParamName,
  zhCopy: appShellZhCopy,
});
