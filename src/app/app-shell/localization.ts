import { renderLocalizationClientRuntime } from "./localization-client-runtime.js";

export const supportedAppShellLocales = ["zh", "en"] as const;
export type AppShellLocale = (typeof supportedAppShellLocales)[number];

export const defaultAppShellLocale: AppShellLocale = "zh";
export const appShellLocaleCookieName = "grasseye-app-locale";
export const appShellLocaleSearchParamName = "locale";

const appShellZhCopyEntries = [
  ["GrassEye AGENT Workbench", "玄学 AI 工作台"],
  ["AGENT Workbench", "玄学 AI 工作台"],
  ["Skill Registry", "功能"],
  ["Browser pairing", "浏览器配对"],
  ["Language", "语言"],
  ["Chinese", "中文"],
  ["health", "健康"],
  ["mode", "模式"],
  ["Inspector", "检查器"],
  ["Runtime Console", "运行控制台"],
  ["Refresh shell", "刷新工作台"],
  ["Toggle sidebar", "切换侧边栏"],
  ["Toggle inspector", "切换检查器"],
  ["Toggle console", "切换控制台"],
  ["Local-only whole-order control", "仅限本地的整单控制"],
  ["Order ID", "订单 ID"],
  ["Expected revision", "预期修订号"],
  ["Request ID", "请求 ID"],
  ["Reason", "原因"],
  ["intervention state", "介入状态"],
  ["last safe checkpoint", "最后安全检查点"],
  ["order status", "订单状态"],
  ["revision", "修订号"],
  ["玄学 AI 生产", "玄学 AI 生产"],
] as const;

export const appShellZhCopy: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(appShellZhCopyEntries));

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
